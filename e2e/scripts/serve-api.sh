#!/usr/bin/env bash
# Starts a throwaway BSJ API for the e2e run: fresh SQLite hall, dev accounts,
# mock SMS, a random secret. Nothing touches backend/.env or backend/data.
# The runner starts this through app.command and stops it when the run ends.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
backend="$here/../../backend"
state="${BSJ_E2E_STATE:-${TMPDIR:-/tmp}/bsj-e2e}"
port="${BSJ_E2E_API_PORT:-8010}"
mkdir -p "$state"
chmod 700 "$state"
if [ ! -x "$state/venv/bin/uvicorn" ]; then
  python3 -m venv "$state/venv"
  "$state/venv/bin/pip" install -q -r "$backend/requirements.txt"
fi
rm -f "$state"/hostel.db*
export ENVIRONMENT=development SMS_DRIVER=mock DATABASE_PATH="$state/hostel.db"
APP_SECRET_KEY="$(head -c 48 /dev/urandom | base64)"
export APP_SECRET_KEY
cd "$backend"
umask 077
# Holds the dev passwords; support/accounts.ts reads it at fill time. Never print it.
"$state/venv/bin/python" -m app.dev_seed > "$state/seed-accounts.txt"
exec "$state/venv/bin/uvicorn" app.main:app --host 127.0.0.1 --port "$port"
