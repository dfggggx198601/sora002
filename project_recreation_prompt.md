# 大师级提示词：Sora Studio AI 视频平台复刻指南

**角色设定**: 专家级全栈云架构师 & AI 工程师
**任务目标**: 构建一个生产级、可商用的 AI 视频/图片生成平台 ("Sora Studio")，采用混合云架构。

## 1. 技术栈要求 (Mandatory Tech Stack)
-   **前端 (Frontend)**: React (Vite) + TypeScript + Tailwind CSS。
    -   *设计风格*: 高端 "赛博朋克/未来主义" 美学。深色模式、玻璃拟态 (Glassmorphism)、流畅的微交互动画。
-   **后端 (Backend)**: Node.js + Express + TypeScript。
    -   *托管环境*: Google Cloud Run (Serverless)。
-   **数据库 (Database)**: MongoDB (Atlas 或 自建)。
-   **存储 (Storage)**: Google Cloud Storage (GCS) 用于存储媒体资源。
-   **基础设施 (Infrastructure)**: **混合架构 (Hybrid Architecture)**。
    -   核心应用部署在 Cloud Run。
    *   **反向代理 (Reverse Proxy)**: 必须在独立 VPS 上部署 Nginx，用于全球加速并将流量无缝转发至 Cloud Run，绕过区域限制。

## 2. 核心功能需求

### A. AI 生成引擎
1.  **视频生成**: 集成 Sora (或模拟/代理 API)。支持 文生视频 (Text-to-Video) 和 图生视频 (Image-to-Video)。
2.  **图片生成**: 集成 Google Gemini (如 Gemini 3 Pro)。
3.  **对话助手**: 多模态对话界面，使用 Gemini 1.5 Pro。
4.  **关键要求**: 所有 AI 生成必须是 **异步的 (Asynchronous)**。后端必须能处理长达 5-10 分钟的长任务，且不能超时。

### B. 健壮的状态管理 (至关重要)
*   **持久化优先 (Persistence First)**: 绝不要依赖前端状态来处理耗时任务。
    *   *错误示范*: 前端等待 10秒获取 Base64 图片，然后由前端传回后端保存。(这会导致用户刷新页面后数据丢失)。
    *   *正确做法*: 后端生成 -> 后端直接上传 GCS -> 后端写入数据库 -> 后端返回 "任务完成" 给前端。
*   **任务队列**: 实现完整的状态流转：`PENDING` (排队中) -> `GENERATING` (生成中) -> `COMPLETED` (完成)/`FAILED` (失败)。

### C. 混合代理架构 (核心秘籍)
为了保证全球访问速度和稳定性，必须设计一套特殊的代理层：
1.  **前端逻辑**: 前端必须能自动识别当前是运行在 Cloud Run 官方域名还是自定义代理域名。
    *   如果是代理域名：API 请求必须使用相对路径 (`/api/...`)，以便流量通过 VPS 的 Nginx 转发。
2.  **后端逻辑**:
    *   **媒体代理 (Media Proxy)**: 不要直接返回 GCS/S3 的原始链接 (可能会被墙或速度慢)。必须返回一个 **代理链接** (例如：`/api/ai/proxy?url=...`)。
    *   **Range 请求支持**: 后端的媒体代理接口 **必须** 支持 HTTP `Range` 头 (206 Partial Content)，否则 iOS 设备无法播放视频，也无法拖拽进度条。
3.  **Nginx 配置**:
    *   `proxy_read_timeout` 必须设置至少 **600秒 (10分钟)**，防止视频生成时连接中断。
    *   必须允许大文件传输 (`client_max_body_size 50M+`)。

### D. 用户系统与商业化
1.  **鉴权**: 基于 JWT 的 邮箱/密码 登录 (+ Google OAuth 可选)。
2.  **配额系统**: 对视频、图片、对话进行每日额度限制。
    *   *商业化*: 实现 "积分" 系统，用户购买套餐后增加额度。
3.  **管理后台**: 全面的管理员面板，可管理用户、任务、订单和系统设置 (支持热更新 API Key，无需重新部署)。

## 3. 实现步骤 (指导 AI 逐步执行)

**第一步：基建 (The Foundation)**
- 初始化仓库 (Monorepo 结构: `/frontend`, `/backend`)。
- 定义共享类型 (ITask, IUser)。
- 搭建 "赛博朋克"UI 框架 (侧边栏、玻璃质感头部)。

**第二步：后端核心 (The Backend Core)**
- 配置 Express 和 MongoDB 连接。
- 实现 `AiController` 处理生成请求。
- **立刻实现** `StorageService`：任何生成的资源必须立刻上传 GCS，不能在内存停留。

**第三步：代理逻辑 (The Proxy Logic)**
- 编写 `proxy_install.sh` 脚本，用于在 VPS 上自动部署 Docker Nginx。
- 配置 Nginx 规则：`/` 转发到前端 Cloud Run，`/api` 转发到后端 Cloud Run。

**第四步：前端开发 (Frontend Development)**
- 构建 "视频生成"、"图片生成"、"对话" 三大模块。
- 实现 `apiService.ts`，加入动态 Base URL 检测逻辑。
- **图片加速**: 确保所有图片 `<img>` 标签都经过 `/api/ai/proxy` 路由加载，以实现秒开。

## 4. 关键 "避坑指南" (命令 AI 严格遵守)
-   *禁止* 将巨大的 Base64 字符串直接返回给前端，这会撑爆浏览器内存并导致数据库保存失败。
-   *禁止* 忘记设置 Nginx 的 `proxy_read_timeout`。默认的 60秒是不够的，我们需要 600秒。
-   *禁止* 对视频流使用简单的 `fetch` 下载。你必须使用 `pipe` 流式传输。
-   *禁止* 忽略 CORS。后端必须允许来自 VPS 代理 IP 的跨域请求。

---
**Prompt End (提示词结束)**
请使用上述规范和架构设计，生成/复刻该项目代码。
