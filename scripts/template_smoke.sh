#!/usr/bin/env bash
# Template smoke: one-command CI/quick verification (poetry + cargo + verify-all).
# Run from repo root. On Windows use Git Bash or WSL.

set -e
cd "$(dirname "$0")/.."

echo "Template smoke: installing bridge..."
cd pagi-intelligence-bridge && poetry install && cd ..

echo "Template smoke: building orchestrator..."
cd pagi-core-orchestrator && cargo build && cd ..

echo "Template smoke: running verify-all..."
make verify-all

echo "Template smoke complete."
