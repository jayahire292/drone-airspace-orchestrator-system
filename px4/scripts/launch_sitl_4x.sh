#!/usr/bin/env bash
# Start N (default 4) PX4 SITL quadcopters (gz_x500) side by side in Gazebo.
# Usage: PX4_DIR=~/PX4-Autopilot ./launch_sitl_4x.sh [N]
# Instance i publishes MAVLink for offboard on UDP 14540+i.
set -euo pipefail
N="${1:-4}"
PX4_DIR="${PX4_DIR:-$HOME/PX4-Autopilot}"
BIN="$PX4_DIR/build/px4_sitl_default/bin/px4"
[ -x "$BIN" ] || { echo "Build PX4 first: cd $PX4_DIR && make px4_sitl"; exit 1; }

pids=()
trap 'kill "${pids[@]}" 2>/dev/null || true' EXIT INT TERM
for ((i = 0; i < N; i++)); do
  # 3 m spacing on a line, like the dock grid in the dashboard
  pose="0,$((i * 3))"
  extra=()
  [ "$i" -gt 0 ] && extra=(PX4_GZ_STANDALONE=1)   # instance 0 starts the gz server
  ( cd "$PX4_DIR" && env "${extra[@]}" PX4_SYS_AUTOSTART=4001 \
      PX4_SIM_MODEL=gz_x500 PX4_GZ_MODEL_POSE="$pose" "$BIN" -i "$i" -d \
      > "/tmp/px4_sitl_$i.log" 2>&1 ) &
  pids+=($!)
  echo "started instance $i (pose $pose) -> udp 1454$i, log /tmp/px4_sitl_$i.log"
  [ "$i" -eq 0 ] && sleep 10 || sleep 3
done
echo "All $N vehicles up. Ctrl-C to stop."
wait
