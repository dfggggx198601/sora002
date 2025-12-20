# Cloud Run Deployment Guide

Since this project was originally designed for Google AI Studio / Project IDX, we have made adjustments to support standalone deployment on Google Cloud Run.

## Prerequisites

1.  **Google Cloud Project**: You need an active GCP project.
2.  **Google Cloud SDK**: Ensure `gcloud` CLI is installed and authenticated (`gcloud auth login`).
3.  **Gemini API Key**: You will need a valid Google Gemini API Key. Get one at [aistudio.google.com](https://aistudio.google.com/).

## Quick Deployment

We have provided a helper script `deploy.sh`.

1.  Run the script:
    ```bash
    ./deploy.sh
    ```
    *   This will check for `gcloud`, build the Docker image using Cloud Build (remote), and deploy it to Cloud Run.
    *   **Note**: You might be prompted to enable APIs (Cloud Build API, Run API) if this is your first time.

## Manual Deployment

If you prefer to run commands manually:

```bash
# 1. Set your Project ID (optional if already set)
gcloud config set project YOUR_PROJECT_ID

# 2. Deploy from source
gcloud run deploy sora-studio \
  --source . \
  --region us-central1 \
  --allow-unauthenticated \
  --port 8080
```

## Post-Deployment Setup

1.  Open the deployed URL (e.g., `https://sora-studio-xxxxx-uc.a.run.app`).
2.  The app will likely show "连接 Google 账号" (Connect Google Account).
3.  Click the button, or the Settings icon.
4.  In the configuration panel, paste your **Google API Key**.
5.  The app is now ready to use! Your key is stored locally in your browser.
