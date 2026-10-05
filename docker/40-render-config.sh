#!/bin/sh
# Rendered by the nginx image's /docker-entrypoint.d runner before nginx starts.
# Writes config.js from environment so one image works in every environment.
#
# The file is written under /tmp (an emptyDir in k8s) so the container can run
# with a read-only root filesystem. nginx serves it via an `alias` on
# /config.js (see default.conf).
set -eu

: "${GYM_API_BASE:=/api/v1}"
: "${GOOGLE_CLIENT_ID:=}"
# Public app domain (Helm global.host) — e.g. etqadem.cloider.app.
: "${APP_HOST:=}"

dir="/tmp/gym-config"
mkdir -p "$dir"
target="$dir/config.js"
cat > "$target" <<EOF
/* generated at container start */
window.GYM_API_BASE = "${GYM_API_BASE}";
window.GOOGLE_CLIENT_ID = "${GOOGLE_CLIENT_ID}";
window.GYM_APP_HOST = "${APP_HOST}";
EOF

if [ -n "${GOOGLE_CLIENT_ID}" ]; then _s=yes; else _s=no; fi
echo "render-config: wrote $target (GYM_API_BASE=${GYM_API_BASE}, GOOGLE_CLIENT_ID set: ${_s}, APP_HOST=${APP_HOST})"
