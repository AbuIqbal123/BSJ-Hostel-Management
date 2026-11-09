#!/bin/sh
# Hosted process only (Fly or Render). The hall database is Turso. This script
# does not create or open a SQLite file.
# The platform proxy is the only client. Trust the address it appends to
# X-Forwarded-For so sign-in limits are per phone. Only peers in
# FORWARDED_ALLOW_IPS may supply that header; "*" is for platform-only TCP.
# Uvicorn's own proxy handling stays off.
export TRUST_FORWARDED_FOR=1
export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-proxy-headers
