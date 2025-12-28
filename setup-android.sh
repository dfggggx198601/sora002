#!/bin/bash

# Exit on error
set -e

echo "🚀 开始为您构建 Android App 工程..."

cd frontend

# 1. Check/Install Dependencies
echo "📦 正在安装 Capacitor Android 依赖..."
npm install @capacitor/core @capacitor/cli @capacitor/android

# 2. Initialize (Check if already init)
if [ ! -f "capacitor.config.json" ] && [ ! -f "capacitor.config.ts" ]; then
    echo "⚙️ 初始化 Capacitor..."
    npx cap init "Sora Studio" "com.sorastudio.app" --web-dir dist
else
    echo "ℹ️ Capacitor 已初始化，跳过 init 步骤。"
fi

# 3. Build React App
echo "🏗️ 构建前端资源 (Vite Build)..."
npm run build

# 4. Add Android Platform
if [ ! -d "android" ]; then
    echo "🤖 添加 Android 平台..."
    npx cap add android
else
    echo "ℹ️ Android 平台已存在，执行同步..."
fi

# 5. Sync
echo "🔄 同步资源到 Android 工程..."
npx cap sync

echo "==========================================="
echo "✅ Android 工程已准备就绪！"
echo "==========================================="
echo "下一步操作："
echo "1. 打开 Android Studio"
echo "2. 选择 'Open' -> 浏览并选择项目中的 'frontend/android' 文件夹"
echo "3. 等待 Gradle Sync 完成"
echo "4. 点击顶部的 'Run' 按钮 (绿色三角形) 在模拟器或真机上运行"
echo "   或者点击 'Build' -> 'Build Bundle(s) / APK(s)' -> 'Build APK(s)' 来生成安装包"
