"""MAVSDK offboard controller: one quadcopter flown with a tail-sitter-style profile.

Phase sequence (mirrors PX4 VTOL tail-sitter states, airframe stays a quad):

    TAKEOFF -> MC_ALIGN -> FRONT_TRANSITION -> FW_CRUISE (laps)
            -> BACK_TRANSITION -> MC_RETURN -> LANDING -> LANDED

Any quad-chute condition -> ABORT (MC hover) -> MC_RETURN -> LANDING.
"""

from __future__ import annotations

import asyncio
import csv
import logging
import math
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Optional, Sequence, Tuple

try:  # gRPC wrapper was renamed to mavsdk-grpc; same API
    from mavsdk_grpc import System
    from mavsdk_grpc.offboard import Attitude, OffboardError, PositionNedYaw, VelocityNedYaw
except ImportError:  # mavsdk < 4
    from mavsdk import System
    from mavsdk.offboard import Attitude, OffboardError, PositionNedYaw, VelocityNedYaw

from .profile import (
    FlightPhase,
    TailsitterProfile,
    acceptance_radius,
    altitude_hold_thrust,
    back_transition_pitch,
    back_transition_status,
    braking_distance,
    course_deg,
    effective_fw_pitch,
    forward_speed,
    front_transition_pitch,
    front_transition_status,
    fw_guidance,
    racetrack,
    wrap_deg,
)

LOOP_HZ = 25.0


@dataclass
class VehicleMission:
    index: int
    address: str                 # e.g. udpin://0.0.0.0:14541
    grpc_port: int               # unique mavsdk_server port per vehicle
    alt_m: float                 # cruise / transition altitude (layered per vehicle)
    heading_deg: float           # transition heading, also the sector of its circuit
    leg_length_m: float = 120.0
    leg_width_m: float = 60.0
    laps: int = 1
    start_delay_s: float = 0.0


@dataclass
class _State:
    n: float = 0.0
    e: float = 0.0
    d: float = 0.0
    vn: float = 0.0
    ve: float = 0.0
    vd: float = 0.0
    roll: float = 0.0
    pitch: float = 0.0
    yaw: float = 0.0
    in_air: bool = False
    stamp: float = field(default_factory=time.monotonic)


class TailsitterStyleQuad:
    def __init__(
        self,
        mission: VehicleMission,
        profile: TailsitterProfile,
        log_dir: Optional[Path] = None,
        apply_params: bool = False,
    ) -> None:
        self.m = mission
        self.p = profile
        self.log = logging.getLogger(f"quad{mission.index}")
        self.drone = System(port=mission.grpc_port)
        self.s = _State()
        self.phase = FlightPhase.PREFLIGHT
        self.hover_thrust = 0.5
        self.home_ne: Tuple[float, float] = (0.0, 0.0)
        self.home_d = 0.0
        self.cmd = (0.0, 0.0, 0.0, 0.0)  # roll, pitch, yaw, thrust (for logging)
        self._apply_params = apply_params
        self._log_dir = log_dir
        self._csv = None
        self._csv_writer = None
        self._tasks: List[asyncio.Task] = []

    # ------------------------------------------------------------ telemetry

    @property
    def alt(self) -> float:
        return -(self.s.d - self.home_d)

    @property
    def climb(self) -> float:
        return -self.s.vd

    @property
    def ground_speed(self) -> float:
        return math.hypot(self.s.vn, self.s.ve)

    async def _watch_pos_vel(self) -> None:
        async for pv in self.drone.telemetry.position_velocity_ned():
            self.s.n, self.s.e, self.s.d = pv.position.north_m, pv.position.east_m, pv.position.down_m
            self.s.vn, self.s.ve, self.s.vd = pv.velocity.north_m_s, pv.velocity.east_m_s, pv.velocity.down_m_s
            self.s.stamp = time.monotonic()

    async def _watch_attitude(self) -> None:
        async for a in self.drone.telemetry.attitude_euler():
            self.s.roll, self.s.pitch, self.s.yaw = a.roll_deg, a.pitch_deg, a.yaw_deg

    async def _watch_in_air(self) -> None:
        async for flag in self.drone.telemetry.in_air():
            self.s.in_air = flag

    # ------------------------------------------------------------ setup

    async def connect(self) -> None:
        self.log.info("connecting %s (grpc %d)", self.m.address, self.m.grpc_port)
        await self.drone.connect(system_address=self.m.address)
        async for st in self.drone.core.connection_state():
            if st.is_connected:
                break
        self.log.info("waiting for position estimate")
        async for h in self.drone.telemetry.health():
            if h.is_global_position_ok and h.is_home_position_ok and h.is_local_position_ok:
                break
        await self.drone.telemetry.set_rate_position_velocity_ned(50.0)
        await self.drone.telemetry.set_rate_attitude_euler(50.0)
        self._tasks = [
            asyncio.create_task(self._watch_pos_vel()),
            asyncio.create_task(self._watch_attitude()),
            asyncio.create_task(self._watch_in_air()),
        ]
        try:
            self.hover_thrust = await self.drone.param.get_param_float("MPC_THR_HOVER")
        except Exception:  # noqa: BLE001 - fall back to a sane default
            self.log.warning("could not read MPC_THR_HOVER, assuming %.2f", self.hover_thrust)
        if self._apply_params:
            await self._set_params()
        self.log.info(
            "hover thrust %.2f -> nose-down pitch limit %.1f deg",
            self.hover_thrust, effective_fw_pitch(self.hover_thrust, self.p),
        )
        if self._log_dir:
            self._log_dir.mkdir(parents=True, exist_ok=True)
            self._csv = open(self._log_dir / f"quad{self.m.index}.csv", "w", newline="")
            self._csv_writer = csv.writer(self._csv)
            self._csv_writer.writerow(
                ["t", "phase", "n", "e", "alt", "vn", "ve", "vd", "gs",
                 "roll", "pitch", "yaw", "cmd_roll", "cmd_pitch", "cmd_yaw", "cmd_thrust"]
            )

    async def _set_params(self) -> None:
        """Let the quad's position controller fly fast, high-tilt 'fixed-wing' legs."""
        params = {
            "MPC_XY_VEL_MAX": max(12.0, self.p.cruise_speed_ms + 3.0),
            "MPC_TILTMAX_AIR": max(45.0, self.p.fw_pitch_deg + 5.0),
            "MPC_ACC_HOR_MAX": 5.0,
            "MPC_ACC_HOR": 5.0,
            "MPC_JERK_AUTO": 8.0,
        }
        for name, value in params.items():
            try:
                await self.drone.param.set_param_float(name, float(value))
                self.log.info("param %s = %.2f", name, value)
            except Exception as exc:  # noqa: BLE001
                self.log.warning("param %s not set: %s", name, exc)

    # ------------------------------------------------------------ helpers

    def _set_phase(self, phase: FlightPhase) -> None:
        if phase != self.phase:
            self.log.info("%s -> %s  (alt %.1f m, gs %.1f m/s, pitch %.1f)",
                          self.phase.value, phase.value, self.alt, self.ground_speed, self.s.pitch)
            self.phase = phase

    def _record(self) -> None:
        if not self._csv_writer:
            return
        s = self.s
        self._csv_writer.writerow([
            f"{time.monotonic():.3f}", self.phase.value,
            f"{s.n:.2f}", f"{s.e:.2f}", f"{self.alt:.2f}",
            f"{s.vn:.2f}", f"{s.ve:.2f}", f"{s.vd:.2f}", f"{self.ground_speed:.2f}",
            f"{s.roll:.1f}", f"{s.pitch:.1f}", f"{s.yaw:.1f}",
            *(f"{c:.3f}" for c in self.cmd),
        ])

    async def _tick(self) -> float:
        self._record()
        await asyncio.sleep(1.0 / LOOP_HZ)
        return 1.0 / LOOP_HZ

    async def _attitude(self, roll: float, pitch: float, yaw: float, target_alt: float) -> None:
        thrust = altitude_hold_thrust(self.hover_thrust, target_alt - self.alt, self.climb, pitch, roll, self.p)
        self.cmd = (roll, pitch, yaw, thrust)
        await self.drone.offboard.set_attitude(Attitude(roll, pitch, yaw, thrust))

    def _ned_d(self, alt: float) -> float:
        return self.home_d - alt

    # ------------------------------------------------------------ phases

    async def _takeoff(self) -> None:
        self._set_phase(FlightPhase.TAKEOFF)
        self.home_ne = (self.s.n, self.s.e)
        self.home_d = self.s.d
        await self.drone.action.set_takeoff_altitude(self.m.alt_m)
        await self.drone.action.arm()
        await self.drone.action.takeoff()
        while self.alt < self.m.alt_m - 1.0:
            await self._tick()

    async def _start_offboard(self) -> None:
        # Offboard requires a setpoint to be streaming before start().
        await self.drone.offboard.set_position_ned(
            PositionNedYaw(self.s.n, self.s.e, self._ned_d(self.m.alt_m), self.s.yaw))
        try:
            await self.drone.offboard.start()
        except OffboardError as exc:
            raise RuntimeError(f"offboard start failed: {exc._result.result}") from exc

    async def _mc_align(self) -> None:
        """Tail-sitters rotate onto the transition heading while still hovering."""
        self._set_phase(FlightPhase.MC_ALIGN)
        n, e = self.s.n, self.s.e
        sp = PositionNedYaw(n, e, self._ned_d(self.m.alt_m), self.m.heading_deg)
        settled = 0.0
        while settled < 1.0:
            await self.drone.offboard.set_position_ned(sp)
            ok = abs(wrap_deg(self.s.yaw - self.m.heading_deg)) < 5.0 and self.ground_speed < 0.5
            settled = settled + 1.0 / LOOP_HZ if ok else 0.0
            await self._tick()

    async def _front_transition(self) -> bool:
        self._set_phase(FlightPhase.FRONT_TRANSITION)
        t = 0.0
        while True:
            fwd = forward_speed(self.s.vn, self.s.ve, self.m.heading_deg)
            status = front_transition_status(t, fwd, self.alt, self.p)
            if status == "complete":
                return True
            if status == "abort":
                self.log.warning("front transition abort (t=%.1fs fwd=%.1f alt=%.1f)", t, fwd, self.alt)
                return False
            pitch = front_transition_pitch(t, self.hover_thrust, self.p)
            await self._attitude(0.0, pitch, self.m.heading_deg, self.m.alt_m)
            t += await self._tick()

    async def _fw_cruise(self, waypoints: Sequence[Tuple[float, float]]) -> bool:
        """Fly the circuit like a fixed-wing, then head home until braking distance."""
        self._set_phase(FlightPhase.FW_CRUISE)
        course = course_deg(self.s.vn, self.s.ve)
        speed = self.ground_speed
        plan = list(waypoints) * self.m.laps + [self.home_ne]
        idx = 0
        while True:
            if self.alt < self.p.min_alt_m:
                self.log.warning("quad-chute: altitude %.1f below %.1f", self.alt, self.p.min_alt_m)
                return False
            target = plan[idx]
            dist = math.hypot(target[0] - self.s.n, target[1] - self.s.e)
            final = idx == len(plan) - 1
            if final and dist <= braking_distance(self.ground_speed, self.p) + 2.0:
                return True
            if not final and dist <= acceptance_radius(self.p.cruise_speed_ms, self.p):
                idx += 1
                continue
            # accelerate smoothly from transition speed to cruise speed
            speed = min(self.p.cruise_speed_ms, speed + 2.0 / LOOP_HZ)
            vn, ve, vd, course = fw_guidance(
                (self.s.n, self.s.e), course, target, self.alt, self.m.alt_m,
                1.0 / LOOP_HZ, self.p, speed)
            self.cmd = (0.0, 0.0, course, 0.0)
            await self.drone.offboard.set_velocity_ned(VelocityNedYaw(vn, ve, vd, course))
            await self._tick()

    async def _back_transition(self) -> None:
        self._set_phase(FlightPhase.BACK_TRANSITION)
        heading = self.s.yaw
        t = 0.0
        while True:
            fwd = forward_speed(self.s.vn, self.s.ve, heading)
            if back_transition_status(t, fwd, self.p) == "complete":
                return
            await self._attitude(0.0, back_transition_pitch(t, fwd, self.p), heading, self.m.alt_m)
            t += await self._tick()

    async def _abort(self) -> None:
        self._set_phase(FlightPhase.ABORT)
        # Level out and brake exactly like a back-transition, then hold.
        await self._back_transition()
        self._set_phase(FlightPhase.ABORT)
        hold = PositionNedYaw(self.s.n, self.s.e, self._ned_d(max(self.alt, self.p.min_alt_m)), self.s.yaw)
        for _ in range(int(2 * LOOP_HZ)):
            await self.drone.offboard.set_position_ned(hold)
            await self._tick()

    async def _mc_return(self) -> None:
        self._set_phase(FlightPhase.MC_RETURN)
        hn, he = self.home_ne
        sp = PositionNedYaw(hn, he, self._ned_d(self.m.alt_m), self.s.yaw)
        while math.hypot(hn - self.s.n, he - self.s.e) > 1.0 or self.ground_speed > 0.5:
            await self.drone.offboard.set_position_ned(sp)
            await self._tick()

    async def _land(self) -> None:
        self._set_phase(FlightPhase.LANDING)
        await self.drone.offboard.stop()
        await self.drone.action.land()
        while self.s.in_air:
            await self._tick()
        self._set_phase(FlightPhase.LANDED)

    # ------------------------------------------------------------ entry

    async def fly(self) -> None:
        await self.connect()
        if self.m.start_delay_s:
            self.log.info("staggered start: waiting %.0fs", self.m.start_delay_s)
            await asyncio.sleep(self.m.start_delay_s)
        try:
            await self._takeoff()
            await self._start_offboard()
            await self._mc_align()
            circuit = racetrack(self.home_ne, self.m.heading_deg, self.m.leg_length_m, self.m.leg_width_m)
            if await self._front_transition() and await self._fw_cruise(circuit):
                await self._back_transition()
            else:
                await self._abort()
            await self._mc_return()
            await self._land()
        except BaseException:
            self.log.exception("failure in phase %s -> RTL", self.phase.value)
            try:
                await self.drone.offboard.stop()
            except Exception:  # noqa: BLE001
                pass
            try:
                await self.drone.action.return_to_launch()
            except Exception:  # noqa: BLE001
                self.log.error("RTL command failed")
            raise
        finally:
            for t in self._tasks:
                t.cancel()
            if self._csv:
                self._csv.close()
