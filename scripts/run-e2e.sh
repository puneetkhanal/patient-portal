#!/usr/bin/env bash
set -euo pipefail

# Usage information
usage() {
  echo "Usage: $0 [test_file...]"
  echo ""
  echo "Run e2e tests for the patient portal application."
  echo ""
  echo "Arguments:"
  echo "  test_file    Specific test files to run (optional)"
  echo "               If no arguments provided, runs all tests"
  echo ""
  echo "Examples:"
  echo "  $0                          # Run all tests"
  echo "  $0 e2e/auth-session.spec.ts # Run specific test"
  echo "  $0 e2e/*.spec.ts           # Run multiple tests with glob"
  echo "  $0 e2e/change-password.spec.ts e2e/navigation.spec.ts"
  exit 1
}

# Show usage if help is requested
if [ "${1:-}" = "-h" ] || [ "${1:-}" = "--help" ]; then
  usage
fi

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILE="docker-compose.e2e.yml"

docker compose -f "$COMPOSE_FILE" down --timeout 10

cleanup() {
  docker compose -f "$COMPOSE_FILE" down --timeout 10
}

trap cleanup EXIT
docker compose -f "$COMPOSE_FILE" up -d app --build

BASE_URL="${E2E_BASE_URL:-http://localhost:3000}"

echo "🚀 Starting e2e test environment..."
echo "📍 Target URL: ${BASE_URL}"
if [ $# -eq 0 ]; then
  echo "🧪 Test Scope: All tests"
else
  echo "🧪 Test Scope: Specific tests ($# file(s))"
fi
echo ""

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

# Check if test files are specified as arguments
if [ $# -eq 0 ]; then
  # No arguments provided, run all tests
  echo "Running all e2e tests..."
  E2E_BASE_URL="${BASE_URL}" npx playwright test --workers=1
else
  # Arguments provided, pass them directly to playwright
  echo "Running e2e tests with arguments: $@"
  E2E_BASE_URL="${BASE_URL}" npx playwright test --workers=1 "$@"
fi
