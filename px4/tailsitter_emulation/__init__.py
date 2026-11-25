"""Fly standard PX4 quadcopters with tail-sitter-style VTOL transitions (no VTOL airframe needed)."""

from .profile import FlightPhase, TailsitterProfile

__all__ = ["FlightPhase", "TailsitterProfile"]
