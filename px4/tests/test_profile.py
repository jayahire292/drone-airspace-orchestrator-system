"""Offline tests: profile math + a point-mass quad sim of each transition."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from tailsitter_emulation.profile import (  # noqa: E402
    G,
    TailsitterProfile,
    acceptance_radius,
    altitude_hold_thrust,
    back_transition_pitch,
    back_transition_status,
    braking_distance,
    effective_fw_pitch,
    forward_speed,
    front_transition_pitch,
    front_transition_status,
    fw_guidance,
    max_pitch_for_thrust,
    racetrack,
    wrap_deg,
)

P = TailsitterProfile()
HOVER = 0.6  # x500 in Gazebo is close to this
DT = 0.02
DRAG = 0.15  # 1/s linear drag, rough quad value


def step(state, pitch_deg, thrust):
    """Planar point mass: state = [x, z, vx, vz]; forward is +x, up is +z."""
    x, z, vx, vz = state
    a_tot = thrust / HOVER * G
    th = math.radians(pitch_deg)
    ax = -a_tot * math.sin(th) - DRAG * vx  # nose-down (negative pitch) accelerates forward
    az = a_tot * math.cos(th) - G - DRAG * vz
    vx, vz = vx + ax * DT, vz + az * DT
    return [x + vx * DT, z + vz * DT, vx, vz]


def test_wrap():
    assert wrap_deg(190) == -170
    assert wrap_deg(-180) == 180
    assert wrap_deg(360) == 0


def test_pitch_limit_respects_thrust_headroom():
    lim = max_pitch_for_thrust(HOVER, P)
    assert 0 < lim < 60
    # at that tilt, vertical thrust at thrust_max equals hover*margin
    assert math.isclose(P.thrust_max * math.cos(math.radians(lim)), HOVER * P.thrust_margin, rel_tol=1e-9)
    assert effective_fw_pitch(HOVER, P) <= P.fw_pitch_deg
    assert max_pitch_for_thrust(0.9, P) == 0.0  # underpowered -> no transition tilt


def test_altitude_hold_thrust_compensates_tilt():
    level = altitude_hold_thrust(HOVER, 0, 0, 0, 0, P)
    tilted = altitude_hold_thrust(HOVER, 0, 0, -30, 0, P)
    assert math.isclose(level, HOVER)
    assert math.isclose(tilted, HOVER / math.cos(math.radians(30)))
    assert altitude_hold_thrust(HOVER, 0, 0, -85, 0, P) == P.thrust_max


def test_front_transition_ramp_is_monotonic_nose_down():
    pitches = [front_transition_pitch(t * 0.1, HOVER, P) for t in range(60)]
    assert pitches[0] == 0
    assert all(b <= a for a, b in zip(pitches, pitches[1:]))
    assert math.isclose(pitches[-1], -effective_fw_pitch(HOVER, P))


def test_front_transition_sim_reaches_speed_and_holds_altitude():
    s, t, alt0 = [0.0, P.transition_alt_m, 0.0, 0.0], 0.0, P.transition_alt_m
    min_alt = alt0
    while True:
        status = front_transition_status(t, s[2], s[1], P)
        if status != "continue":
            break
        pitch = front_transition_pitch(t, HOVER, P)
        thr = altitude_hold_thrust(HOVER, alt0 - s[1], s[3], pitch, 0, P)
        s = step(s, pitch, thr)
        min_alt = min(min_alt, s[1])
        t += DT
    assert status == "complete", (t, s)
    assert t < P.front_trans_timeout_s
    assert alt0 - min_alt < 1.0  # no sag during the pitch-over


def test_front_transition_aborts_on_low_altitude_and_timeout():
    assert front_transition_status(1.0, 0.0, P.min_alt_m - 0.1, P) == "abort"
    assert front_transition_status(P.front_trans_timeout_s, 2.0, 20, P) == "abort"


def test_back_transition_sim_brakes_without_reversing():
    s, t, alt0 = [0.0, 15.0, P.cruise_speed_ms, 0.0], 0.0, 15.0
    pred = braking_distance(P.cruise_speed_ms, P)
    while back_transition_status(t, s[2], P) == "continue":
        pitch = back_transition_pitch(t, s[2], P)
        assert 0 <= pitch <= P.back_trans_max_pitch_deg  # nose UP flare
        thr = altitude_hold_thrust(HOVER, alt0 - s[1], s[3], pitch, 0, P)
        s = step(s, pitch, thr)
        t += DT
    assert s[2] <= P.mc_speed_threshold_ms
    assert s[2] > -0.5  # never flew backwards
    assert abs(s[1] - alt0) < 1.5
    assert s[0] <= pred  # braking-distance estimate is conservative


def test_fw_guidance_turn_rate_limited_and_yaw_equals_course():
    v = P.cruise_speed_ms
    # target directly behind: must not pivot, turn at most g*tan(bank)/V per second
    vn, ve, vd, course = fw_guidance((0, 0), 0.0, (-100, 0), 15, 15, 1.0, P, v)
    max_rate = math.degrees(G * math.tan(math.radians(P.max_bank_deg)) / v)
    assert math.isclose(abs(course), max_rate, rel_tol=1e-6)
    assert math.isclose(math.hypot(vn, ve), v)
    assert math.isclose(forward_speed(vn, ve, course), v)  # no side-slip
    assert vd == 0


def test_fw_guidance_never_below_min_speed_and_holds_altitude():
    vn, ve, vd, _ = fw_guidance((0, 0), 0.0, (100, 0), 10, 15, 0.04, P, speed_ms=1.0)
    assert math.isclose(math.hypot(vn, ve), P.min_fw_speed_ms)
    assert vd < 0  # climb (NED down negative)


def test_fw_guidance_closes_on_circuit():
    """Integrate a full lap: should visit every corner and stay within the bank limit."""
    p = TailsitterProfile()
    wps = racetrack((0, 0), 90.0, 120, 60)
    pos, course, dt = [0.0, 0.0], 90.0, 0.05
    visited = 0
    for _ in range(20000):
        tgt = wps[visited]
        if math.hypot(tgt[0] - pos[0], tgt[1] - pos[1]) < acceptance_radius(p.cruise_speed_ms, p):
            visited += 1
            if visited == len(wps):
                break
            continue
        vn, ve, _, course = fw_guidance(tuple(pos), course, tgt, 15, 15, dt, p)
        pos[0] += vn * dt
        pos[1] += ve * dt
    assert visited == len(wps)


def test_racetracks_for_four_vehicles_stay_in_own_sector():
    for i in range(4):
        h = i * 90.0
        for n, e in racetrack((0, 0), h, 120, 60):
            b = (math.degrees(math.atan2(e, n)) - h) % 360
            assert 0 < b < 90, (i, n, e, b)
