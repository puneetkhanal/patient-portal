#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.e2e-memory.yml"
BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"

cleanup() {
  docker compose -f "$COMPOSE_FILE" down
}

trap cleanup EXIT

echo "🔍 Discovering e2e tests..."
TESTS=()
if [ "$#" -gt 0 ]; then
  for arg in "$@"; do
    TESTS+=("$arg")
  done
else
  while IFS= read -r file; do
    TESTS+=("$file")
  done < <(rg --files -g "e2e/*.spec.ts" e2e)
fi

if [ ${#TESTS[@]} -eq 0 ]; then
  echo "No e2e tests found."
  exit 1
fi

echo "Running tests individually..."

for test_file in "${TESTS[@]}"; do
  echo ""
  echo "▶️  ${test_file}"
  docker compose -f "$COMPOSE_FILE" up -d app --build

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

  if ! E2E_BASE_URL="${BASE_URL}" npx playwright test "${test_file}"; then
    echo "❌ Failed: ${test_file}"
  else
    echo "✅ Passed: ${test_file}"
  fi

  docker compose -f "$COMPOSE_FILE" down
done
