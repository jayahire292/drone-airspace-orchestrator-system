"""Pure flight-profile math for flying a standard PX4 quadcopter *like* a tail-sitter.

No MAVSDK imports here, so everything in this file is unit-testable offline.

A real PX4 tail-sitter (VT_TYPE=0) goes through these VTOL states:

    MC  -> TRANSITION_TO_FW -> FW -> TRANSITION_TO_MC -> MC

We reproduce that *flight behaviour* on an unmodified quad (keeping the
multicopter airframe, mixer and controllers):

* FRONT_TRANSITION – nose pitches down progressively over VT_F_TRANS_DUR-like
  time, thrust is raised by 1/cos(pitch) to hold altitude, and the vehicle
  accelerates until it reaches a "transition airspeed" (ground speed here).
* FW_CRUISE – "fixed-wing-like" guidance: always moving forward above a minimum
  speed, yaw locked to the course (no side-slip / crabbing), turn rate limited
  by a bank-angle limit (omega = g*tan(bank)/V), so turns are arcs, never
  pivot-in-place.
* BACK_TRANSITION – nose pitches *up* (flare) to brake, pitch scheduled on
  forward speed so it never flies backwards, until speed drops below the
  multicopter threshold or VT_B_TRANS_DUR-like timeout elapses.
* Quad-chute analogue – if altitude drops below a floor or the front transition
  times out, abort back to multicopter hover (like VT_FW_MIN_ALT / VT_TRANS_TIMEOUT).

Conventions: local NED frame, angles in degrees at the API boundary, PX4 pitch
positive = nose up (so forward acceleration uses *negative* pitch).
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from enum import Enum
from typing import Sequence, Tuple

G = 9.80665


class FlightPhase(str, Enum):
    PREFLIGHT = "preflight"
    TAKEOFF = "takeoff"              # vertical climb, multicopter
    MC_ALIGN = "mc_align"            # hover + yaw onto transition heading
    FRONT_TRANSITION = "front_transition"
    FW_CRUISE = "fw_cruise"
    BACK_TRANSITION = "back_transition"
    MC_RETURN = "mc_return"          # multicopter reposition over home
    LANDING = "landing"
    LANDED = "landed"
    ABORT = "abort"                  # quad-chute analogue -> MC hover, then return


@dataclass
class TailsitterProfile:
    """Tunables. Names in comments point at the PX4 VTOL parameter they mimic."""

    transition_alt_m: float = 15.0          # MIS_TAKEOFF_ALT
    front_trans_duration_s: float = 3.0     # VT_F_TRANS_DUR  (pitch ramp time)
    front_trans_timeout_s: float = 10.0     # VT_TRANS_TIMEOUT
    transition_speed_ms: float = 8.0        # VT_ARSP_TRANS   (ground speed proxy)
    fw_pitch_deg: float = 40.0              # requested nose-down pitch; clamped by thrust margin
    cruise_speed_ms: float = 12.0           # FW_AIRSPD_TRIM
    min_fw_speed_ms: float = 6.0            # FW_AIRSPD_MIN  (never hover while "fixed-wing")
    max_bank_deg: float = 30.0              # FW_R_LIM
    back_trans_duration_s: float = 5.0      # VT_B_TRANS_DUR
    back_trans_ramp_s: float = 1.0          # VT_B_TRANS_RAMP
    back_trans_max_pitch_deg: float = 25.0  # flare limit
    back_trans_pitch_per_ms: float = 3.0    # flare pitch scheduled on forward speed
    mc_speed_threshold_ms: float = 1.0      # done braking below this
    min_alt_m: float = 8.0                  # VT_FW_MIN_ALT   (quad-chute)
    thrust_max: float = 0.95                # keep headroom below MPC_THR_MAX
    thrust_min: float = 0.10
    thrust_margin: float = 1.20             # vertical-thrust reserve used to clamp pitch
    alt_kp: float = 1.0                     # 1/s^2, altitude hold (attitude phases)
    alt_kd: float = 1.6                     # 1/s
    alt_vel_kp: float = 0.8                 # 1/s, altitude hold (velocity phase)
    max_vert_accel: float = 3.0             # m/s^2
    max_vert_speed: float = 2.0             # m/s
    min_acceptance_m: float = 5.0


# ---------------------------------------------------------------- helpers

def wrap_deg(a: float) -> float:
    """Wrap angle to (-180, 180]."""
    a = math.fmod(a + 180.0, 360.0)
    if a <= 0.0:
        a += 360.0
    return a - 180.0


def smoothstep(x: float) -> float:
    x = min(1.0, max(0.0, x))
    return x * x * (3.0 - 2.0 * x)


def clamp(v: float, lo: float, hi: float) -> float:
    return lo if v < lo else hi if v > hi else v


def heading_unit(heading_deg: float) -> Tuple[float, float]:
    h = math.radians(heading_deg)
    return math.cos(h), math.sin(h)  # (north, east)


def forward_speed(vn: float, ve: float, heading_deg: float) -> float:
    un, ue = heading_unit(heading_deg)
    return vn * un + ve * ue


def course_deg(vn: float, ve: float) -> float:
    return math.degrees(math.atan2(ve, vn))


# ---------------------------------------------------------------- thrust / pitch

def max_pitch_for_thrust(hover_thrust: float, p: TailsitterProfile) -> float:
    """Largest tilt (deg) at which we can still hold altitude with margin.

    Vertical thrust component = T*cos(theta) must stay >= hover*margin.
    """
    ratio = hover_thrust * p.thrust_margin / p.thrust_max
    if ratio >= 1.0:
        return 0.0
    return math.degrees(math.acos(ratio))


def effective_fw_pitch(hover_thrust: float, p: TailsitterProfile) -> float:
    return min(p.fw_pitch_deg, max_pitch_for_thrust(hover_thrust, p))


def altitude_hold_thrust(
    hover_thrust: float,
    alt_err_m: float,
    climb_rate_ms: float,
    pitch_deg: float,
    roll_deg: float,
    p: TailsitterProfile,
) -> float:
    """Collective thrust that holds altitude while tilted.

    alt_err_m: target - current (positive = need to climb)
    climb_rate_ms: positive up
    """
    a = clamp(p.alt_kp * alt_err_m - p.alt_kd * climb_rate_ms, -p.max_vert_accel, p.max_vert_accel)
    tilt = math.cos(math.radians(pitch_deg)) * math.cos(math.radians(roll_deg))
    tilt = max(tilt, 0.2)
    return clamp(hover_thrust * (1.0 + a / G) / tilt, p.thrust_min, p.thrust_max)


# ---------------------------------------------------------------- transitions

def front_transition_pitch(t_s: float, hover_thrust: float, p: TailsitterProfile) -> float:
    """Nose-down pitch command (deg, negative) at time t into the front transition."""
    return -effective_fw_pitch(hover_thrust, p) * smoothstep(t_s / p.front_trans_duration_s)


def front_transition_status(t_s: float, fwd_speed_ms: float, alt_m: float, p: TailsitterProfile) -> str:
    """'continue' | 'complete' | 'abort'."""
    if alt_m < p.min_alt_m:
        return "abort"
    if t_s >= p.front_trans_duration_s and fwd_speed_ms >= p.transition_speed_ms:
        return "complete"
    if t_s >= p.front_trans_timeout_s:
        return "abort"
    return "continue"


def back_transition_pitch(t_s: float, fwd_speed_ms: float, p: TailsitterProfile) -> float:
    """Nose-up flare (deg, positive). Scheduled on speed so we don't fly backwards."""
    ramp = smoothstep(t_s / p.back_trans_ramp_s) if p.back_trans_ramp_s > 0 else 1.0
    sched = clamp(p.back_trans_pitch_per_ms * max(fwd_speed_ms, 0.0), 0.0, p.back_trans_max_pitch_deg)
    return ramp * sched


def back_transition_status(t_s: float, fwd_speed_ms: float, p: TailsitterProfile) -> str:
    """'continue' | 'complete'. Like PX4, MC takes over at timeout regardless."""
    if fwd_speed_ms <= p.mc_speed_threshold_ms or t_s >= p.back_trans_duration_s:
        return "complete"
    return "continue"


def braking_distance(speed_ms: float, p: TailsitterProfile) -> float:
    """Distance needed to flare from speed to hover (+1 s ramp allowance)."""
    decel = G * math.tan(math.radians(p.back_trans_max_pitch_deg)) * 0.6  # avg of speed-scheduled flare
    return speed_ms * speed_ms / (2.0 * decel) + speed_ms * p.back_trans_ramp_s


# ---------------------------------------------------------------- fixed-wing-like guidance

def turn_radius(speed_ms: float, p: TailsitterProfile) -> float:
    return speed_ms * speed_ms / (G * math.tan(math.radians(p.max_bank_deg)))


def acceptance_radius(speed_ms: float, p: TailsitterProfile) -> float:
    return max(p.min_acceptance_m, turn_radius(speed_ms, p))


def fw_guidance(
    pos_ne: Tuple[float, float],
    course_prev_deg: float,
    target_ne: Tuple[float, float],
    alt_m: float,
    alt_target_m: float,
    dt_s: float,
    p: TailsitterProfile,
    speed_ms: float | None = None,
) -> Tuple[float, float, float, float]:
    """Coordinated-turn guidance. Returns (vn, ve, vd, yaw_deg).

    Course slews toward the target bearing no faster than g*tan(bank)/V,
    yaw == course (no crabbing), speed never below min_fw_speed.
    """
    v = max(p.min_fw_speed_ms, speed_ms if speed_ms is not None else p.cruise_speed_ms)
    bearing = math.degrees(math.atan2(target_ne[1] - pos_ne[1], target_ne[0] - pos_ne[0]))
    err = wrap_deg(bearing - course_prev_deg)
    max_rate = math.degrees(G * math.tan(math.radians(p.max_bank_deg)) / v)
    step = clamp(err, -max_rate * dt_s, max_rate * dt_s)
    course = wrap_deg(course_prev_deg + step)
    un, ue = heading_unit(course)
    vd = -clamp(p.alt_vel_kp * (alt_target_m - alt_m), -p.max_vert_speed, p.max_vert_speed)
    return v * un, v * ue, vd, course


def racetrack(
    home_ne: Tuple[float, float],
    heading_deg: float,
    length_m: float,
    width_m: float,
    turn_right: bool = True,
) -> Sequence[Tuple[float, float]]:
    """Rectangular circuit starting at home, first leg along heading.

    With heading = sector * 90 deg and turn_right=True, each vehicle's circuit
    stays inside its own 90-degree sector (matches the dashboard Q1..Q4 split).
    """
    side = 90.0 if turn_right else -90.0
    fn, fe = heading_unit(heading_deg)
    sn, se = heading_unit(heading_deg + side)
    hn, he = home_ne

    def pt(fwd: float, lat: float) -> Tuple[float, float]:
        return (hn + fn * fwd + sn * lat, he + fe * fwd + se * lat)

    # Circuit is offset from the pad so the vehicle never overflies other docks.
    near, lat0 = 0.25 * length_m, 0.25 * width_m
    return [
        pt(length_m, lat0),            # end of outbound leg
        pt(length_m, lat0 + width_m),  # cross leg
        pt(near, lat0 + width_m),      # inbound leg
        pt(near, lat0),                # close the loop
    ]
