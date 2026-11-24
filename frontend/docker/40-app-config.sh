#!/bin/sh
# Gera /config.js com as URLs do backend escolhido (executado na subida do Nginx).
set -eu
CONFIG_FILE=/usr/share/nginx/html/config.js
cat > "$CONFIG_FILE" <<EOF
window.__APP_CONFIG__ = { apiUrl: "${API_URL}", wsUrl: "${WS_URL}" };
EOF
echo "config.js gerado: apiUrl=${API_URL} wsUrl=${WS_URL}"
