#!/usr/bin/env bash
set -Eeuo pipefail

pid="$1"
current="$2"
staged="$3"
log="$4"

mkdir -p "$(dirname "$log")"
exec >>"$log" 2>&1

echo "===== Ryanova updater: $(date -Is) ====="
echo "PID: $pid"
echo "Current: $current"
echo "Staged: $staged"

trap 'echo "ERROR at line $LINENO, exit code $?"' ERR

[[ "$pid" =~ ^[0-9]+$ ]]
[[ -f "$current" ]]
[[ -s "$staged" ]]
[[ "$current" != "$staged" ]]

# A zombie has exited even if kill -0 still succeeds.
process_alive() {
  [[ -d "/proc/$pid" ]] || return 1

  local state
  state=$(ps -o stat= -p "$pid" 2>/dev/null | tr -d ' ') || return 1

  [[ -n "$state" ]] || return 1
  [[ "$state" != Z* ]] && [[ "$state" != X* ]]
}

echo "Waiting for old Electron process..."

for ((i=0; i<120; i++)); do
  if ! process_alive; then
    echo "Old process exited."
    break
  fi
  sleep 1
done

if process_alive; then
  echo "ERROR: Old process still alive after 120 seconds."
  exit 1
fi

# Stage replacement in the same directory as the target.
# This avoids cross-filesystem rename problems.
directory=$(dirname "$current")
temporary=$(mktemp "$directory/.ryanova-update-XXXXXXXX")
backup="${current}.previous"

cleanup() {
  rm -f -- "$temporary"
}
trap cleanup EXIT

echo "Copying verified update into target directory..."
cp -- "$staged" "$temporary"
chmod 755 "$temporary"

# The browser already verified the download SHA256.
# Verify the copied bytes again before replacement.
source_hash=$(sha256sum "$staged" | cut -d' ' -f1)
copy_hash=$(sha256sum "$temporary" | cut -d' ' -f1)

if [[ "$source_hash" != "$copy_hash" ]]; then
  echo "ERROR: Copied AppImage checksum mismatch."
  exit 1
fi

echo "Backup previous AppImage..."

# Keep an existing backup until the new backup is ready.
if [[ -e "$backup" ]]; then
  mv -- "$backup" "${backup}.older"
fi

mv -- "$current" "$backup"

echo "Installing new AppImage..."

if ! mv -- "$temporary" "$current"; then
  echo "ERROR: Replacement failed. Rolling back."
  mv -- "$backup" "$current"
  exit 1
fi

echo "Installed SHA256: $(sha256sum "$current")"

echo "Launching updated browser..."

# Launch independently and record startup diagnostics.
nohup "$current" >>"$log" 2>&1 </dev/null &
new_pid=$!

echo "Launch PID: $new_pid"

sleep 3

if kill -0 "$new_pid" 2>/dev/null; then
  echo "Restart process still present."
else
  echo "WARNING: Restart process exited early."
fi

echo "Updater handoff completed."
