#!/usr/bin/env bash
# Tear down the verify instance this run started. Keeps artifacts.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
state="${BSJ_VERIFY_STATE:-}"
if [ -z "$state" ] && [ -f "$here/../.last-state" ]; then
  state="$(cat "$here/../.last-state")"
fi
if [ -z "${state:-}" ] || [ ! -d "$state" ]; then
  echo "cleanup: nothing to stop"
  exit 0
fi
if [ -f "$state/uvicorn.pid" ]; then
  pid="$(cat "$state/uvicorn.pid")"
  if kill -0 "$pid" 2>/dev/null; then
    kill "$pid"
    for _ in $(seq 1 20); do
      kill -0 "$pid" 2>/dev/null || break
      sleep 0.1
    done
    kill -9 "$pid" 2>/dev/null || true
  fi
  rm -f "$state/uvicorn.pid"
fi
# Scratch DB and seeds go away; venv kept for faster relaunch; artifacts untouched.
rm -f "$state"/hostel.db* "$state/seed-accounts.txt" "$state/uvicorn.stdout" "$state/uvicorn.stderr"
rm -f "$here/../.last-state"
echo "cleanup: stopped verify hall at $state (artifacts kept)"
