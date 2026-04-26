#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
    kill "$SERVER_PID"
    wait "$SERVER_PID" || true
  fi
}

trap cleanup EXIT

echo "📦 Building client for production..."
npm run build:client

echo "🚀 Starting E2E server with MongoMemoryServer..."
PORT=3000 NODE_ENV=production npx tsx server/src/e2eServer.ts &
SERVER_PID=$!

BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"
echo "Waiting for ${BASE_URL} to become ready..."
for i in {1..60}; do
  if curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
    echo "App is up."
    break
  fi
  sleep 2
done

if ! curl -fsS "${BASE_URL}/api/health" >/dev/null 2>&1; then
  echo "App did not become ready in time."
  exit 1
fi

echo "Running UI e2e tests..."
E2E_BASE_URL="${BASE_URL}" npx playwright test "$@"
