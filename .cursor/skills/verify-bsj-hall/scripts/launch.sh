#!/usr/bin/env bash
# Starts a throwaway Hall API for verification. Never touches backend/.env or backend/data.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../../.." && pwd)"
backend="$repo/backend"
run_id="${BSJ_VERIFY_RUN_ID:-$(date -u +%Y%m%dT%H%M%SZ)-$$}"
state="${BSJ_VERIFY_STATE:-${TMPDIR:-/tmp}/bsj-verify-$run_id}"
port="${BSJ_VERIFY_API_PORT:-8020}"
artifacts="$here/../artifacts/$run_id"

if [ "$port" = "8000" ] || [ "$port" = "8010" ]; then
  echo "refuse: port $port is reserved (8000 laptop hall, 8010 e2e). Use 8020+." >&2
  exit 2
fi

mkdir -p "$state" "$artifacts"
chmod 700 "$state"
echo "$run_id" > "$state/run_id"
echo "$port" > "$state/port"
echo "$artifacts" > "$state/artifacts_dir"
printf '%s\n' "$state" > "$here/../.last-state"

py=""
if [ -x "$backend/.venv/bin/python" ]; then
  py="$backend/.venv/bin/python"
elif command -v python3.14 >/dev/null 2>&1; then
  py="$(command -v python3.14)"
elif command -v python3.12 >/dev/null 2>&1; then
  py="$(command -v python3.12)"
else
  echo "launch: need backend/.venv or python3.14+" >&2
  exit 1
fi

if [ -x "$backend/.venv/bin/uvicorn" ]; then
  uv="$backend/.venv/bin/uvicorn"
  seed_py="$backend/.venv/bin/python"
else
  if [ ! -x "$state/venv/bin/uvicorn" ]; then
    "$py" -m venv "$state/venv"
    "$state/venv/bin/pip" install -q -U pip
    "$state/venv/bin/pip" install -q -r "$backend/requirements.txt"
  fi
  uv="$state/venv/bin/uvicorn"
  seed_py="$state/venv/bin/python"
fi

rm -f "$state"/hostel.db*
export ENVIRONMENT=development SMS_DRIVER=mock E2E_SCRATCH=1 DATABASE_PATH="$state/hostel.db"
APP_SECRET_KEY="$(head -c 48 /dev/urandom | base64)"
export APP_SECRET_KEY
cd "$backend"
umask 077
"$seed_py" -m app.dev_seed > "$state/seed-accounts.txt"
chmod 600 "$state/seed-accounts.txt"

"$uv" app.main:app --host 127.0.0.1 --port "$port" \
  >"$state/uvicorn.stdout" 2>"$state/uvicorn.stderr" &
echo $! > "$state/uvicorn.pid"

ready=0
for _ in $(seq 1 60); do
  if curl -fsS "http://127.0.0.1:$port/health" >/dev/null 2>&1; then
    ready=1
    break
  fi
  sleep 0.25
done
if [ "$ready" != 1 ]; then
  echo "launch failed: /health never answered on 127.0.0.1:$port" >&2
  echo "--- uvicorn.stderr ---" >&2
  tail -n 40 "$state/uvicorn.stderr" >&2 || true
  if [ -f "$state/uvicorn.pid" ]; then
    kill "$(cat "$state/uvicorn.pid")" 2>/dev/null || true
  fi
  exit 1
fi

cat > "$artifacts/launch.json" <<EOF
{"run_id":"$run_id","base":"http://127.0.0.1:$port","state":"$state","e2e_scratch":true}
EOF

cat > "$state/env.sh" <<EOF
export BSJ_VERIFY_RUN_ID='$run_id'
export BSJ_VERIFY_STATE='$state'
export BSJ_VERIFY_BASE='http://127.0.0.1:$port'
export BSJ_VERIFY_ARTIFACTS='$artifacts'
EOF

echo "BSJ_VERIFY_RUN_ID=$run_id"
echo "BSJ_VERIFY_STATE=$state"
echo "BSJ_VERIFY_BASE=http://127.0.0.1:$port"
echo "BSJ_VERIFY_ARTIFACTS=$artifacts"
echo "sourced via: . \"\$BSJ_VERIFY_STATE/env.sh\"  (or .last-state → env.sh)"
