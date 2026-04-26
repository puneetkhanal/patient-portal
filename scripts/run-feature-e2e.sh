#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

docker compose -f docker-compose.unified.yml down

cleanup() {
  docker compose -f docker-compose.unified.yml down
}

trap cleanup EXIT
docker compose -f docker-compose.unified.yml up -d app --build

BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"

echo "Waiting for ${BASE_URL} to become ready..."
for i in {1..60}; do
  if curl -fsS "${BASE_URL}" >/dev/null 2>&1; then
    echo "App is up."
    break
  fi
  sleep 2
done

if ! curl -fsS "${BASE_URL}" >/dev/null 2>&1; then
  echo "App did not become ready in time."
  exit 1
fi

E2E_BASE_URL="${BASE_URL}" npx playwright test \
  e2e/weekly-requests.spec.ts \
  e2e/weekly-plan.spec.ts \
  e2e/weekly-summary.spec.ts \
  e2e/transfusion-confirmation.spec.ts \
  e2e/reports-dashboard.spec.ts
