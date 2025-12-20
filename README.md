<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Sora 创意工坊 - AI 视频&图片生成平台

一个功能完整的 AI 创意生成应用，支持视频和图片生成，包含数据持久化、队列管理和配额控制。

## ✨ 核心功能

### 🎬 视频生成
- **文生视频**: 输入提示词直接生成视频
- **图生视频**: 上传参考图片生成视频
- **AI 辅助**: 使用 Gemini 3 Pro 自动生成参考图
- **多模型支持**:
  - Sora 兼容 API (横屏/竖屏，10秒/15秒)
  - Google Veo 3.1 Fast (官方SDK)

### 🖼️ 图片生成
- 使用 Gemini 3 Pro Image Preview 生成高质量图片
- 支持自定义 Base URL（中转/代理）

### 💾 数据持久化
- **IndexedDB 存储**: 所有任务历史自动保存
- 刷新页面不丢失数据
- 支持清空和单个删除

### 🔄 队列管理
- **智能队列**: 自动管理多个生成任务
- **并发控制**: 默认最多3个任务同时执行
- **实时状态**: 显示队列长度和进度

### 📊 配额管理
- **每日限额**: 
  - 视频生成: 10个/天
  - 图片生成: 50个/天
- **自动重置**: 每24小时自动重置配额
- **实时显示**: 侧边栏显示剩余配额

## 🚀 部署到 Cloud Run

### 在线访问
```
https://sora-studio-718161097168.asia-east1.run.app
```

### 本地运行

**前置要求**: Node.js

1. 安装依赖:
   ```bash
   npm install
   ```

2. 配置 API Key (可选):
   创建 `.env.local` 文件:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```

3. 启动开发服务器:
   ```bash
   npm run dev
   ```

### Cloud Run 部署

```bash
# 登录 Google Cloud
gcloud auth login

# 设置项目
gcloud config set project YOUR_PROJECT_ID

# 部署
./deploy.sh
```

## 📖 使用说明

1. **配置 API Key**: 
   - 点击右上角"连接 Google 账号"或"设置"图标
   - 粘贴你的 Gemini API Key
   - 获取 API Key: https://aistudio.google.com/app/apikey

2. **生成视频**:
   - 选择"视频生成"标签页
   - 输入提示词或上传图片
   - 选择模型（Sora 或 Veo）
   - 点击"开始生成视频"

3. **生成图片**:
   - 选择"图片生成"标签页
   - 输入图片描述
   - 点击"开始生成图片"

4. **查看历史**:
   - 左侧边栏显示所有任务
   - 点击任务查看详情
   - 支持下载和删除

## 🛠️ 技术栈

- **前端**: React 18 + TypeScript 5
- **构建**: Vite 5
- **样式**: TailwindCSS 3
- **AI SDK**: @google/genai
- **存储**: IndexedDB + Google Cloud Firestore
- **部署**: Docker + Google Cloud Run

## 📦 项目结构

```
├── components/          # React 组件
│   └── Icons.tsx       # SVG 图标
├── services/           # 核心服务
│   ├── customService.ts   # Sora API 服务
│   ├── googleService.ts   # Gemini 图片服务
│   ├── veoService.ts      # Veo 视频服务
│   ├── dbService.ts       # IndexedDB 服务
│   ├── queueService.ts    # 队列管理
│   └── quotaService.ts    # 配额管理
├── App.tsx            # 主应用
├── types.ts           # 类型定义
├── constants.ts       # 配置常量
└── Dockerfile         # 容器配置
```

## 🔧 配置说明

### 修改每日配额

编辑 `services/quotaService.ts`:

```typescript
const DEFAULT_QUOTA: QuotaConfig = {
  dailyVideoLimit: 10,    // 修改视频配额
  dailyImageLimit: 50,    // 修改图片配额
  maxConcurrentTasks: 3,  // 修改并发数
};
```

### 自定义 Sora API

编辑 `constants.ts`:

```typescript
export const DEFAULT_CUSTOM_CONFIG: CustomApiConfig = {
  baseUrl: "your-api-url",
  apiKey: "your-api-key",
  endpointPath: "/chat/completions"
};
```

## 🎨 特性亮点

- ✅ 现代化 UI/UX 设计
- ✅ 暗色主题
- ✅ 响应式布局（支持移动端）
- ✅ 实时状态更新
- ✅ 流式响应处理
- ✅ 错误处理和重试
- ✅ 数据持久化
- ✅ 智能队列管理
- ✅ 配额控制

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**部署信息**:
- 项目: genvideo-sora
- 区域: asia-east1 (台湾)
- 账号: xian20250131@gmail.com
