#!/usr/bin/env bash
# Run TLC on Presence.tla. Downloads nothing if tools/tla2tools.jar already exists.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
jar="$here/tools/tla2tools.jar"
if [ ! -f "$jar" ]; then
  mkdir -p "$here/tools"
  curl -fsSL -o "$jar" \
    'https://github.com/tlaplus/tlaplus/releases/download/v1.8.0/tla2tools.jar'
fi
cd "$here"
java -Xmx512m -cp "$jar" tlc2.TLC -config Presence.cfg Presence.tla "$@"
