#!/bin/bash
set -e

# Configuration
SERVICE_NAME="sora-studio"
REGION="us-central1" # Change if needed

echo "🚀 Starting deployment for $SERVICE_NAME..."

# 1. Check if gcloud is installed
if ! command -v gcloud &> /dev/null; then
    echo "❌ Error: gcloud CLI is not installed."
    echo "Please install Google Cloud SDK: https://cloud.google.com/sdk/docs/install"
    exit 1
fi

# 2. Build and Deploy
echo "📦 Building and Deploying to Cloud Run..."
# Using --source . allows Cloud Run to build the container remotely using the Dockerfile
gcloud run deploy $SERVICE_NAME \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080

echo "✅ Deployment successful!"
