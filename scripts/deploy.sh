#!/usr/bin/env bash
# Deploys the current main branch to production. Run on the server as the
# deploy user: /var/www/dzcp/scripts/deploy.sh
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Fetching latest main"
BEFORE=$(git rev-parse --short HEAD)
git fetch origin main
git checkout main
git reset --hard origin/main
AFTER=$(git rev-parse --short HEAD)

if [ "$BEFORE" = "$AFTER" ]; then
  echo "==> Already up to date at $AFTER"
else
  echo "==> Updated $BEFORE -> $AFTER"
fi

echo "==> Installing dependencies"
npm ci

echo "==> Applying database migrations"
npx prisma migrate deploy

echo "==> Building"
npm run build

echo "==> Restarting service"
sudo systemctl restart dzcp

sleep 2
echo "==> Health check"
if curl -sf -o /dev/null http://127.0.0.1:3000/login; then
  echo "==> OK: app responding on $AFTER"
else
  echo "==> WARNING: app not responding after restart — check: sudo systemctl status dzcp"
  exit 1
fi
