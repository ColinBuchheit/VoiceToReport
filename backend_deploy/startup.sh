#!/bin/bash
# Azure App Service startup script

echo "🚀 Starting SpeechToReport API on Azure..."

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