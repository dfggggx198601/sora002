#!/bin/bash
set -e

echo "🚀 部署 Sora Studio 完整系统到 Cloud Run"

# 自动获取项目 ID
CURRENT_PROJECT=$(gcloud config get-value project)
if [ -z "$CURRENT_PROJECT" ]; then
    echo "❌ 未设置 gcloud 项目，请运行 'gcloud config set project [PROJECT_ID]'"
    exit 1
fi

PROJECT_ID=$CURRENT_PROJECT
REGION="asia-east1"
BACKEND_SERVICE="sora-backend"
FRONTEND_SERVICE="sora-studio-v2"
BUCKET_NAME="${PROJECT_ID}-assets"

echo "📋 当前项目: $PROJECT_ID"
echo "📍 部署区域: $REGION"

# 启用必要的 API
echo "🔌 启用必要的 Google Cloud API..."
gcloud services enable \
    run.googleapis.com \
    artifactregistry.googleapis.com \
    cloudbuild.googleapis.com \
    firestore.googleapis.com \
    storage.googleapis.com

# 部署后端
echo ""
echo "🗄️ 准备 Cloud Storage 存储桶..."
if gsutil ls -b gs://$BUCKET_NAME &>/dev/null; then
  echo "✅ 存储桶已存在: $BUCKET_NAME"
else
  echo "📦 创建存储桶: $BUCKET_NAME"
  gsutil mb -p $PROJECT_ID -l $REGION gs://$BUCKET_NAME
  echo "🔓 设置公共只读权限..."
  gsutil iam ch allUsers:objectViewer gs://$BUCKET_NAME
fi

echo "🔧 部署后端服务..."
cd backend

# JWT Secret 处理（优先从现有服务读取以保持稳定性）
echo "🔍 正在检查现有配置..."
EXISTING_SECRET=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(spec.template.spec.containers[0].env[?(@.name=="JWT_SECRET")].value)' 2>/dev/null)

if [ -n "$EXISTING_SECRET" ]; then
    JWT_SECRET=$EXISTING_SECRET
    echo "✅ 沿用现有 JWT Secret"
elif [ -z "$JWT_SECRET" ]; then
    echo "💡 提示：未设置 JWT_SECRET 且未找到现有配置，将自动生成一个强随机密钥。"
    if command -v openssl &> /dev/null; then
        JWT_SECRET=$(openssl rand -hex 32)
    else
        JWT_SECRET="sora_secret_$(date +%s)_$RANDOM"
    fi
    echo "✅ 已生成 JWT Secret"
fi

# 部署后端到 Cloud Run
gcloud run deploy $BACKEND_SERVICE \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars JWT_SECRET="$JWT_SECRET",NODE_ENV=production,GCP_PROJECT_ID="$PROJECT_ID",GCS_BUCKET_NAME="$BUCKET_NAME" \
  --memory 512Mi \
  --cpu 1 \
  --timeout=600 \
  --max-instances 10

# 获取后端 URL
# 获取后端 URL (强制指定正确地址，防止解析错误)
# BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
BACKEND_URL="https://sora-backend-qul5vdkegq-de.a.run.app"
echo "✅ 后端部署完成: $BACKEND_URL"

# 部署前端
echo ""
echo "🎨 部署前端服务..."
cd ../frontend
echo "📂 Current Directory: $(pwd)"
ls -la


# 注入环境变量到 .env (供 Docker 构建上下文使用)
echo "VITE_GOOGLE_API_KEY=" > .env
echo "VITE_API_URL=$BACKEND_URL" >> .env


# 构建并部署前端到 Cloud Run
# Local build removed as Docker handles it
# VITE_API_URL="$BACKEND_URL" npm run build
# rm -rf build_artifacts
# mv dist build_artifacts

# Build Container Image explicitly with Unique Tag
TIMESTAMP=$(date +%Y%m%d%H%M%S)
IMAGE_TAG="gcr.io/$PROJECT_ID/$FRONTEND_SERVICE:v$TIMESTAMP"
echo "🔨 构建 Docker 镜像: $IMAGE_TAG"
gcloud builds submit --tag $IMAGE_TAG .

# Deploy the Image
echo "🚀 发布镜像到 Cloud Run..."
gcloud run deploy $FRONTEND_SERVICE \
  --image $IMAGE_TAG \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars VITE_API_URL="$BACKEND_URL" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10

# 返回根目录
cd ..

# 获取前端 URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)')

# 更新后端 CORS (非常重要)
echo ""
echo "🔄 更新后端 CORS 配置以匹配前端地址..."
gcloud run services update $BACKEND_SERVICE \
  --region $REGION \
  --update-env-vars CORS_ORIGIN="*"

echo ""
echo "🎉 部署完成！"
echo ""
echo "📍 访问地址:"
echo "   前端: $FRONTEND_URL"
echo "   后端: $BACKEND_URL"
echo "   健康检查: $BACKEND_URL/health"
echo ""
echo "🔐 安全提示:"
echo "   JWT Secret 已配置。请务必在后台管理中确认 Firestore 规则。"
echo ""
