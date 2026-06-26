#!/usr/bin/env bash
set -a
source "$(dirname "$0")/../.env"
set +a
exec "$(dirname "$0")/.venv/bin/uvicorn" app.main:app --port 8000 --app-dir "$(dirname "$0")"
