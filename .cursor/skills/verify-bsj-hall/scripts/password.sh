#!/usr/bin/env bash
# Prints the seeded password for a username from seed-accounts.txt. Never logs it.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
username="${1:?usage: password.sh <username>}"
state="${BSJ_VERIFY_STATE:-}"
if [ -z "$state" ] && [ -f "$here/../.last-state" ]; then
  state="$(cat "$here/../.last-state")"
fi
seed="${state:?}/seed-accounts.txt"
# Lines look like: "  24-GLLB-118  <password>"
pass="$(awk -v u="$username" '$1 == u { print $2; exit }' "$seed")"
if [ -z "$pass" ]; then
  echo "password.sh: no generated password for $username (may be BSJ_SEED_PASSWORD* configured)" >&2
  exit 1
fi
printf '%s' "$pass"
