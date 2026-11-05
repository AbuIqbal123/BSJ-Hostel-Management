#!/usr/bin/env bash
# Read-only: is this verify instance worth driving?
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
state="${BSJ_VERIFY_STATE:-}"
if [ -z "$state" ] && [ -f "$here/../.last-state" ]; then
  state="$(cat "$here/../.last-state")"
fi
if [ -z "${state:-}" ] || [ ! -d "$state" ]; then
  echo "doctor: no BSJ_VERIFY_STATE (run launch.sh first)" >&2
  exit 2
fi
port="$(cat "$state/port")"
base="http://127.0.0.1:$port"
if [ "$port" = "8000" ] || [ "$port" = "8010" ]; then
  echo "doctor: refuse reserved port $port" >&2
  exit 2
fi
pid_file="$state/uvicorn.pid"
if [ ! -f "$pid_file" ]; then
  echo "doctor: missing pid file" >&2
  exit 1
fi
pid="$(cat "$pid_file")"
if ! kill -0 "$pid" 2>/dev/null; then
  echo "doctor: process $pid is not running" >&2
  exit 1
fi
body="$(curl -fsS "$base/health")"
echo "$body" | grep -q '"status":"ok"' || { echo "doctor: health not ok: $body" >&2; exit 1; }
echo "$body" | grep -q '"e2e_scratch":true' || { echo "doctor: not a scratch hall: $body" >&2; exit 1; }
ready="$(curl -fsS "$base/ready")"
echo "$ready" | grep -q '"status":"ready"' || { echo "doctor: ready failed: $ready" >&2; exit 1; }
if [ ! -f "$state/seed-accounts.txt" ]; then
  echo "doctor: missing seed-accounts.txt" >&2
  exit 1
fi
echo "doctor: ok base=$base pid=$pid scratch=true"
