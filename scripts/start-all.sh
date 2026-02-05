#!/usr/bin/env bash
# Start all PAGI Core Sola services: backend (Rust), bridge (Python), frontend (Vite).
# Run from repo root: ./scripts/start-all.sh   or   bash scripts/start-all.sh
# Optional: copy .env.example to .env and set PAGI_HTTP_PORT, PAGI_GRPC_PORT, PAGI_FRONTEND_PORT.

set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Load .env if present
if [ -f .env ]; then
  set -a
  # shellcheck source=/dev/null
  . ./.env
  set +a
  echo "Loaded .env"
fi

PAGI_HTTP_PORT="${PAGI_HTTP_PORT:-8000}"
PAGI_GRPC_PORT="${PAGI_GRPC_PORT:-50051}"
PAGI_FRONTEND_PORT="${PAGI_FRONTEND_PORT:-3000}"

echo "Starting PAGI Core Sola (backend :$PAGI_GRPC_PORT, bridge :$PAGI_HTTP_PORT, frontend :$PAGI_FRONTEND_PORT)..."

cleanup() {
  echo "Stopping services..."
  for pid in $ORCH_PID $BRIDGE_PID $FRONT_PID; do [ -n "$pid" ] && kill "$pid" 2>/dev/null || true; done
  exit 0
}
trap cleanup SIGINT SIGTERM

# 1) Rust orchestrator
if [ -f pagi-core-orchestrator/Cargo.toml ]; then
  ( cd pagi-core-orchestrator && cargo run --release ) &
  ORCH_PID=$!
  echo "  Started orchestrator (gRPC :$PAGI_GRPC_PORT) PID $ORCH_PID"
  sleep 2
else
  ORCH_PID=""
  echo "  Skipped orchestrator (Cargo.toml not found)"
fi

# 2) Python bridge
if [ -f pagi-intelligence-bridge/pyproject.toml ]; then
  ( cd pagi-intelligence-bridge && poetry run uvicorn src.main:app --port "$PAGI_HTTP_PORT" --reload ) &
  BRIDGE_PID=$!
  echo "  Started bridge (HTTP :$PAGI_HTTP_PORT) PID $BRIDGE_PID"
  sleep 2
else
  BRIDGE_PID=""
  echo "  Skipped bridge (pyproject.toml not found)"
fi

# 3) Frontend (Vite) - run in foreground so Ctrl+C triggers cleanup
if [ -f pagi-frontend/package.json ]; then
  echo "  Starting frontend (port $PAGI_FRONTEND_PORT)..."
  echo ""
  echo "Open http://localhost:$PAGI_FRONTEND_PORT for the UI."
  echo "Set Settings -> PAGI Bridge URL to http://127.0.0.1:$PAGI_HTTP_PORT"
  echo "Optional: run Qdrant for L4 memory (e.g. docker run -p 6334:6334 qdrant/qdrant)."
  echo "Press Ctrl+C to stop all services."
  ( cd pagi-frontend && npm run dev ) &
  FRONT_PID=$!
  wait $FRONT_PID
else
  echo "  Skipped frontend (package.json not found)"
  wait
fi
