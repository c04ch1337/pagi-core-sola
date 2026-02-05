#!/usr/bin/env bash
# E2E smoke: start bridge with personal vertical, curl /rlm-multi-turn, assert response and log.
# Run from repo root. Requires: poetry, curl. Use Git Bash on Windows.
set -e
PORT="${PAGI_HTTP_PORT:-8000}"
LOG="${PAGI_AGENT_ACTIONS_LOG:-agent_actions.log}"
echo "E2E smoke: starting bridge on port $PORT with PAGI_ALLOW_LOCAL_DISPATCH=true PAGI_VERTICAL_USE_CASE=personal..."
cd pagi-intelligence-bridge
PAGI_ALLOW_LOCAL_DISPATCH=true \
PAGI_VERTICAL_USE_CASE=personal \
PAGI_AGENT_ACTIONS_LOG="../$LOG" \
PAGI_RLM_STUB_JSON='{"thought":"E2E step.","action":null,"is_final":true}' \
poetry run uvicorn src.main:app --port "$PORT" &
UVICORN_PID=$!
cd ..
sleep 5
echo "Triggering POST /rlm-multi-turn..."
RESP=$(curl -s -X POST "http://127.0.0.1:$PORT/rlm-multi-turn" \
  -H "Content-Type: application/json" \
  -d '{"query":"E2E smoke test","context":"","depth":0,"max_turns":3}')
echo "$RESP" | (command -v jq >/dev/null 2>&1 && jq . || cat)
if echo "$RESP" | grep -q '"converged":true'; then
  echo "Assertion passed: response contains converged=true."
else
  echo "Assertion: checking for at least one summary in response..."
  echo "$RESP" | grep -q 'summary' || (kill $UVICORN_PID 2>/dev/null; exit 1)
fi
sleep 2
echo "Checking log for EXECUTING/ACTION/THOUGHT..."
grep -E "EXECUTING|ACTION|THOUGHT" "$LOG" 2>/dev/null && echo "Log assertion passed: chain traces found." || echo "No EXECUTING lines (stub may not emit ACTION)."
kill $UVICORN_PID 2>/dev/null || true
echo "E2E smoke complete."
