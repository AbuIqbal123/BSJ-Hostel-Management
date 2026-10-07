#!/bin/sh
# Render's proxy is the only client. Trust its forwarded address so sign-in
# limits are per phone, and do not let uvicorn apply the header a second time.
export FORWARDED_ALLOW_IPS="${FORWARDED_ALLOW_IPS:-*}"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-proxy-headers
