#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ ! -f .env.production ]]; then
  echo "Missing .env.production. Copy .env.production.example and fill deploy values." >&2
  exit 1
fi

set -a
# shellcheck disable=SC1091
source .env.production
set +a

required_service_envs=(
  "${AUTH_ENV_FILE:-services/auth-service/.env}"
  "${COURSE_ENV_FILE:-services/course-service/.env}"
  "${PAYMENT_ENV_FILE:-services/payment-service/.env}"
  "${MEDIA_ENV_FILE:-services/media-service/.env}"
  "${NOTIFICATION_ENV_FILE:-services/notification-service/.env}"
  "${LEARNING_ENV_FILE:-services/learning-service/.env}"
  "${COMMUNITY_ENV_FILE:-services/community-service/.env}"
  "${AI_ENV_FILE:-services/ai-service/.env}"
)

for env_file in "${required_service_envs[@]}"; do
  if [[ ! -f "$env_file" ]]; then
    echo "Missing $env_file. Copy its .env.example and fill deploy values." >&2
    exit 1
  fi
done

bash scripts/render-kong-production.sh

corepack enable
pnpm install --frozen-lockfile
pnpm prisma:migrate:deploy:all
pnpm prisma:generate:all

compose=(docker compose --env-file .env.production -f docker-compose.yml -f docker-compose.production.yml)
"${compose[@]}" config --quiet
"${compose[@]}" up -d --build
"${compose[@]}" ps

echo "Deploy completed. Run: ${compose[*]} logs -f"
