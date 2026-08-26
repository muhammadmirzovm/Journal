#!/usr/bin/env bash
# Server-side deploy script, invoked by CI (GitHub Actions) over SSH.
# Pulls the latest main, rebuilds and restarts the stack. Secrets live in
# the untracked .env on the server and are preserved (git never touches it).
set -euo pipefail

APP_DIR="/home/ubuntu/Journal"
cd "$APP_DIR"

echo "==> Fetch & hard-checkout origin/main"
git fetch --prune origin
git checkout -f -B main origin/main

echo "==> Build & (re)start containers"
docker compose up -d --build --remove-orphans

echo "==> Wait for backend to become healthy"
cid="$(docker compose ps -q backend || true)"
if [ -n "$cid" ]; then
  for i in $(seq 1 40); do
    h="$(docker inspect -f '{{.State.Health.Status}}' "$cid" 2>/dev/null || echo starting)"
    if [ "$h" = "healthy" ]; then echo "backend: healthy"; break; fi
    if [ "$i" = "40" ]; then echo "WARNING: backend not healthy after wait (status=$h)"; fi
    sleep 3
  done
fi

echo "==> One-time Telegram menu refresh (if pending)"
TG_MARKER=".telegram_menu_refreshed_nolesson"
if [ ! -f "$TG_MARKER" ]; then
  if docker compose exec -T backend python manage.py refresh_telegram_menu; then
    touch "$TG_MARKER"
  else
    echo "WARNING: telegram menu refresh failed, will retry next deploy"
  fi
fi

echo "==> Prune dangling images"
docker image prune -f >/dev/null 2>&1 || true

echo "==> Current state"
docker compose ps
echo "==> Deploy complete"
