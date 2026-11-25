"""Fly N (default 4) PX4 quadcopters with tail-sitter-style transitions.

    python -m tailsitter_emulation --vehicles 4 --apply-params --log-dir logs

Vehicle i connects on udpin://0.0.0.0:(14540+i) (PX4 SITL instance -i i)
and gets:
  * its own altitude layer   : base_alt + i * alt_sep
  * its own 90-degree sector : heading = base_heading + i * 90  (Q1..Q4)
  * a staggered start        : i * stagger seconds
so circuits never share airspace.
"""

from __future__ import annotations

import argparse
import asyncio
import logging
from pathlib import Path

from .profile import TailsitterProfile
from .vehicle import TailsitterStyleQuad, VehicleMission


def build_parser() -> argparse.ArgumentParser:
    ap = argparse.ArgumentParser(prog="tailsitter_emulation", description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--vehicles", type=int, default=4)
    ap.add_argument("--first-instance", type=int, default=0, help="PX4 -i of the first vehicle")
    ap.add_argument("--host", default="0.0.0.0")
    ap.add_argument("--base-port", type=int, default=14540)
    ap.add_argument("--grpc-base-port", type=int, default=50051)
    ap.add_argument("--only", type=int, nargs="*", help="fly only these vehicle indices (0-based)")
    ap.add_argument("--base-alt", type=float, default=15.0)
    ap.add_argument("--alt-sep", type=float, default=5.0)
    ap.add_argument("--base-heading", type=float, default=0.0)
    ap.add_argument("--leg-length", type=float, default=120.0)
    ap.add_argument("--leg-width", type=float, default=60.0)
    ap.add_argument("--laps", type=int, default=1)
    ap.add_argument("--stagger", type=float, default=5.0)
    ap.add_argument("--cruise-speed", type=float, default=12.0)
    ap.add_argument("--transition-speed", type=float, default=8.0)
    ap.add_argument("--fw-pitch", type=float, default=40.0, help="requested nose-down pitch (deg)")
    ap.add_argument("--front-trans-dur", type=float, default=3.0)
    ap.add_argument("--back-trans-dur", type=float, default=5.0)
    ap.add_argument("--max-bank", type=float, default=30.0)
    ap.add_argument("--min-alt", type=float, default=8.0)
    ap.add_argument("--apply-params", action="store_true",
                    help="raise MPC_XY_VEL_MAX / MPC_TILTMAX_AIR etc. on each vehicle")
    ap.add_argument("--log-dir", type=Path)
    ap.add_argument("-v", "--verbose", action="store_true")
    return ap


def build_missions(args: argparse.Namespace) -> list[VehicleMission]:
    missions = []
    for i in range(args.vehicles):
        if args.only is not None and i not in args.only:
            continue
        inst = args.first_instance + i
        missions.append(VehicleMission(
            index=i,
            address=f"udpin://{args.host}:{args.base_port + inst}",
            grpc_port=args.grpc_base_port + i,
            alt_m=args.base_alt + i * args.alt_sep,
            heading_deg=(args.base_heading + i * 90.0) % 360.0,
            leg_length_m=args.leg_length,
            leg_width_m=args.leg_width,
            laps=args.laps,
            start_delay_s=len(missions) * args.stagger,
        ))
    return missions


def build_profile(args: argparse.Namespace) -> TailsitterProfile:
    return TailsitterProfile(
        transition_alt_m=args.base_alt,
        cruise_speed_ms=args.cruise_speed,
        transition_speed_ms=args.transition_speed,
        fw_pitch_deg=args.fw_pitch,
        front_trans_duration_s=args.front_trans_dur,
        back_trans_duration_s=args.back_trans_dur,
        max_bank_deg=args.max_bank,
        min_alt_m=args.min_alt,
    )


async def run(args: argparse.Namespace) -> int:
    profile = build_profile(args)
    quads = [TailsitterStyleQuad(m, profile, args.log_dir, args.apply_params) for m in build_missions(args)]
    results = await asyncio.gather(*(q.fly() for q in quads), return_exceptions=True)
    failed = [(q.m.index, r) for q, r in zip(quads, results) if isinstance(r, BaseException)]
    for idx, err in failed:
        logging.error("vehicle %d failed: %r", idx, err)
    return 1 if failed else 0


def main() -> None:
    args = build_parser().parse_args()
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(name)-6s %(levelname)-7s %(message)s")
    raise SystemExit(asyncio.run(run(args)))


if __name__ == "__main__":
    main()
