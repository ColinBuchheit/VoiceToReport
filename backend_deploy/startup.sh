#!/bin/bash
# Azure App Service startup script
set -euo pipefail

echo "🚀 Starting SpeechToReport API on Azure..."

# Ensure we run from the directory containing this script (the deployed app root)
cd "$(cd -- "$(dirname -- "$0")" && pwd)"
echo "📂 Working directory: $(pwd)"

# Ensure Python can import local packages (e.g., services)
export PYTHONPATH="${PYTHONPATH:+$PYTHONPATH:}$(pwd)"
echo "📦 PYTHONPATH: $PYTHONPATH"

# Install dependencies
pip install --no-cache-dir -r requirements-azure.txt

# Start Gunicorn with Uvicorn workers
gunicorn main:app \
    --workers 4 \
    --worker-class uvicorn.workers.UvicornWorker \
    --bind 0.0.0.0:8000 \
    --timeout 120 \
    --access-logfile - \
    --error-logfile - \
    --log-level info