#!/usr/bin/env bash
# HTTP call against the verify Hall API.
# Env: BSJ_VERIFY_STATE (or .last-state), optional BSJ_HTTP_TOKEN.
# Usage: http.sh METHOD PATH OUT_FILE [JSON_BODY]
# Prints status code on stdout. Body goes to OUT_FILE.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
state="${BSJ_VERIFY_STATE:-}"
if [ -z "$state" ] && [ -f "$here/../.last-state" ]; then
  state="$(cat "$here/../.last-state")"
fi
port="$(cat "${state:?}/port")"
base="http://127.0.0.1:$port"
method="${1:?method}"
path="${2:?path}"
out="${3:?out file}"
body="${4:-}"
mkdir -p "$(dirname "$out")"
args=(-sS -o "$out" -w "%{http_code}" -X "$method" "$base$path")
if [ -n "${BSJ_HTTP_TOKEN:-}" ]; then
  args+=(-H "Authorization: Bearer $BSJ_HTTP_TOKEN")
fi
if [ -n "$body" ]; then
  args+=(-H "Content-Type: application/json" -d "$body")
fi
curl "${args[@]}"
echo
