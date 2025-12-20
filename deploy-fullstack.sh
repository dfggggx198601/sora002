#!/bin/bash
set -e

echo "🚀 部署 Sora Studio 完整系统到 Cloud Run"

# 配置
PROJECT_ID="genvideo-sora"
REGION="asia-east1"
BACKEND_SERVICE="sora-backend"
FRONTEND_SERVICE="sora-studio"

# 检查 gcloud
if ! command -v gcloud &> /dev/null; then
    echo "❌ gcloud CLI 未安装"
    exit 1
fi

# 设置项目
echo "📋 设置项目: $PROJECT_ID"
gcloud config set project $PROJECT_ID

# 部署后端
echo ""
echo "🔧 部署后端服务..."
cd backend

read -p "输入 JWT Secret (留空自动生成): " JWT_SECRET
if [ -z "$JWT_SECRET" ]; then
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    echo "✅ 生成 JWT Secret: $JWT_SECRET"
fi

gcloud run deploy $BACKEND_SERVICE \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 3001 \
  --set-env-vars JWT_SECRET="$JWT_SECRET",NODE_ENV=production,GCP_PROJECT_ID="$PROJECT_ID" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10

# 获取后端 URL
BACKEND_URL=$(gcloud run services describe $BACKEND_SERVICE --region $REGION --format='value(status.url)')
echo "✅ 后端部署完成: $BACKEND_URL"

# 部署前端
cd ..
echo ""
echo "🎨 部署前端服务..."

gcloud run deploy $FRONTEND_SERVICE \
  --source . \
  --region $REGION \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars VITE_API_URL="$BACKEND_URL" \
  --memory 512Mi \
  --cpu 1 \
  --max-instances 10

# 获取前端 URL
FRONTEND_URL=$(gcloud run services describe $FRONTEND_SERVICE --region $REGION --format='value(status.url)')
echo "✅ 前端部署完成: $FRONTEND_URL"

# 更新后端 CORS
echo ""
echo "🔄 更新后端 CORS 配置..."
gcloud run services update $BACKEND_SERVICE \
  --region $REGION \
  --update-env-vars CORS_ORIGIN="$FRONTEND_URL"

echo ""
echo "🎉 部署完成！"
echo ""
echo "📍 访问地址:"
echo "   前端: $FRONTEND_URL"
echo "   后端: $BACKEND_URL"
echo "   健康检查: $BACKEND_URL/health"
echo ""
echo "🔐 凭证信息:"
echo "   JWT Secret: $JWT_SECRET"
echo ""
echo "💡 提示: 请将以上凭证保存到安全的地方"
