#!/usr/bin/env bash
# Drive the sign-in feature once and leave proof under artifacts/<run>/sign-in/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
"$here/launch.sh"
state="$(cat "$here/../.last-state")"
# shellcheck disable=SC1091
. "$state/env.sh"
"$here/doctor.sh"
artifacts="${BSJ_VERIFY_ARTIFACTS}/sign-in"
mkdir -p "$artifacts"
pass="$("$here/password.sh" "24-GLLB-118")"
status="$("$here/http.sh" POST /api/v1/auth/login "$artifacts/login.json" \
  "{\"username\":\"24-GLLB-118\",\"password\":\"$pass\"}")"
echo "$status" > "$artifacts/login.status"
if [ "$status" != "200" ]; then
  echo "prove-sign-in: expected 200, got $status" >&2
  cat "$artifacts/login.json" >&2 || true
  "$here/cleanup.sh" || true
  exit 1
fi
python3 - "$artifacts/login.json" <<'PY'
import json, sys
body = json.load(open(sys.argv[1]))
assert body.get("access_token"), body
assert body.get("user", {}).get("role") == "resident", body
assert body["user"].get("username") == "24-GLLB-118", body
open(sys.argv[1].replace("login.json", "proof.txt"), "w").write(
    f"signed_in username={body['user']['username']} role={body['user']['role']} token_len={len(body['access_token'])}\n"
)
PY
bad="$("$here/http.sh" POST /api/v1/auth/login "$artifacts/bad-login.json" \
  '{"username":"24-GLLB-118","password":"definitely-wrong-password"}')"
echo "$bad" > "$artifacts/bad-login.status"
if [ "$bad" != "401" ]; then
  echo "prove-sign-in: wrong password should be 401, got $bad" >&2
  "$here/cleanup.sh" || true
  exit 1
fi
"$here/cleanup.sh"
test -f "$artifacts/proof.txt"
test -f "$artifacts/login.json"
echo "prove-sign-in: ok artifacts=$artifacts"
