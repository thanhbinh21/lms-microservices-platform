#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

: "${KONG_JWT_SECRET:?Set KONG_JWT_SECRET in .env.production}"
: "${APP_ORIGIN:?Set APP_ORIGIN in .env.production}"

escape_sed_replacement() {
  printf '%s' "$1" | sed 's/[&|]/\\&/g'
}

jwt_secret="$(escape_sed_replacement "$KONG_JWT_SECRET")"
app_origin="$(escape_sed_replacement "$APP_ORIGIN")"

sed \
  -e 's|http://host.docker.internal:3101|http://auth-service:3101|g' \
  -e 's|http://host.docker.internal:3002|http://course-service:3002|g' \
  -e 's|http://host.docker.internal:3003|http://payment-service:3003|g' \
  -e 's|http://host.docker.internal:3004|http://media-service:3004|g' \
  -e 's|http://host.docker.internal:3005|http://notification-service:3005|g' \
  -e 's|http://host.docker.internal:3006|http://learning-service:3006|g' \
  -e 's|http://host.docker.internal:3007|http://community-service:3007|g' \
  -e 's|http://host.docker.internal:3008|http://ai-service:3008|g' \
  -e "s|secret: lms-dev-gateway-secret-2026-min-32chars|secret: ${jwt_secret}|g" \
  -e "s|\"http://localhost:3000\"|\"${app_origin}\"|g" \
  kong.yml > kong.production.yml

echo "Rendered kong.production.yml"
