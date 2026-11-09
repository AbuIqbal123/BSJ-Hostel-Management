#!/bin/sh
# Hosted process only (Fly or Render). The hall database is Turso. This script
# does not create or open a SQLite file.
# On Fly, FLY_APP_NAME is already set and ForwardedClient uses Fly-Client-IP
# (edge-owned) for per-visitor sign-in limits. TRUST_FORWARDED_FOR and
# FORWARDED_ALLOW_IPS apply only off Fly (for example Render), where the last
# X-Forwarded-For hop is trusted only from an allowlisted TCP peer. Uvicorn's
# own proxy handling stays off.
export TRUST_FORWARDED_FOR=1
export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-proxy-headers
