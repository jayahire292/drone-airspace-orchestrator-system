# Tail-sitter-style flight on standard PX4 quads

The four drones keep their **normal quadcopter setup** (x500 / `SYS_AUTOSTART=4001`,
multicopter mixer and controllers). They don't use a VTOL airframe or `VT_*` params.
An offboard controller (MAVSDK) flies each quad through the same **flight
transitions a PX4 tail-sitter uses**:

```
TAKEOFF ─► MC_ALIGN ─► FRONT_TRANSITION ─► FW_CRUISE ─► BACK_TRANSITION ─► MC_RETURN ─► LANDING
 (vertical)  (yaw onto     (nose pitches down,   (fixed-wing-like   (nose-up flare,     (hover over
             heading)       thrust 1/cos(θ),      circuit, yaw =     pitch scheduled     the pad,
                            accelerate to          course, bank-      on speed, brake     land)
                            transition speed)      limited arcs)      to hover)
                 any quad-chute condition ─► ABORT (level + brake + hover) ─► MC_RETURN
```

| Phase | What the quad does | PX4 tail-sitter param it mimics |
|---|---|---|
| Takeoff | Vertical climb to the vehicle's own layer | `MIS_TAKEOFF_ALT` |
| Front transition | Smoothstep nose-down pitch over `--front-trans-dur`, altitude held by tilt-compensated thrust, done at `--transition-speed` | `VT_F_TRANS_DUR`, `VT_ARSP_TRANS`, `VT_TRANS_TIMEOUT` |
| FW cruise | Always moving forward (≥ min speed), yaw locked to course (no crabbing), turn rate ≤ g·tan(bank)/V | `FW_AIRSPD_MIN/TRIM`, `FW_R_LIM` |
| Back transition | Nose-up flare to brake, eased out as speed drops so it never flies backwards; multicopter control takes over at timeout | `VT_B_TRANS_DUR`, `VT_B_TRANS_RAMP` |
| Quad-chute | Altitude below `--min-alt` or front-transition timeout → abort to hover | `VT_FW_MIN_ALT`, `VT_TRANS_TIMEOUT` |

The nose-down pitch is automatically limited to what the motors can hold
altitude at: `θmax = acos(hover·1.2 / 0.95)` using the vehicle's `MPC_THR_HOVER`
(about 41° for an x500 with hover thrust 0.6).

### Keeping the 4 drones apart

| Drone | MAVLink port | Altitude | Transition heading / circuit sector | Start |
|---|---|---|---|---|
| 0 | 14540 | 15 m | 0° (N) → Q1 | t+0 s |
| 1 | 14541 | 20 m | 90° (E) → Q2 | t+5 s |
| 2 | 14542 | 25 m | 180° (S) → Q3 | t+10 s |
| 3 | 14543 | 30 m | 270° (W) → Q4 | t+15 s |

Each drone flies a rectangular circuit inside its own 90° sector at its own
altitude, so the circuits never share airspace.

## Run in SITL

```bash
# 1. PX4 (once)
cd ~/PX4-Autopilot && make px4_sitl

# 2. Four x500 quads in Gazebo
PX4_DIR=~/PX4-Autopilot ./scripts/launch_sitl_4x.sh 4

# 3. Fly them
pip install -r requirements.txt
python -m tailsitter_emulation --vehicles 4 --apply-params --log-dir logs
```

Useful flags: `--only 0` (fly a single drone), `--laps 3`, `--cruise-speed 14`,
`--fw-pitch 35`, `--front-trans-dur 2.5`, `--back-trans-dur 4`, `--max-bank 35`,
`--stagger 8`. Run `--help` to see all of them.

`--apply-params` raises `MPC_XY_VEL_MAX`, `MPC_TILTMAX_AIR`, `MPC_ACC_HOR(_MAX)`,
and `MPC_JERK_AUTO` so the quad's velocity controller can sustain the
"fixed-wing" legs. The same values are in `params/quad_tailsitter_style.params`
for loading through QGroundControl. Load that file per vehicle, because each
SITL instance has its own `MAV_SYS_ID`.

`--log-dir` writes `quadN.csv` with the phase, position, velocity, attitude,
and commanded attitude/thrust at 25 Hz. Use it to plot the pitch-over and flare.

## Tests

```bash
python -m pytest tests
```

The tests run offline (no PX4 needed). They use a point-mass quad sim to check
that the front transition reaches transition speed with < 1 m altitude sag,
that the back transition brakes without going backwards, that turns stay within
the bank limit, and that each of the four circuits stays in its own sector.

## Safety notes

* Fly this in SITL first. The transition and flare pitch angles are much larger
  than normal multicopter flight, and on real hardware they need tuning for
  thrust headroom (`MPC_THR_HOVER`) and attitude-controller gains.
* On any exception the script stops offboard mode and commands RTL.
* Keep an RC/QGC operator ready to take over. Leave PX4's offboard-loss
  failsafe (`COM_OBL_RC_ACT`) enabled.
