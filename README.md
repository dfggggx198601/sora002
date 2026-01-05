# GenVideo Studio (Sora/Gemini) - System Documentation

## 1. 项目概述 (Project Overview)
GenVideo Studio 是一个基于 Google Gemini 和 Sora 模型的高级视频/图片生成平台。
本项目采用 **混合架构 (Hybrid Architecture)**：核心计算与服务托管在 **Google Cloud Run** (Serverless)，而流量入口通过一台 **高性能 VPS 代理服务器** 进行加速，以解决直连 Google Cloud 的速度和网络限制问题。

## 2. 系统架构 (Architecture)

### 流量链路 (Traffic Flow)
```mermaid
graph LR
    User[用户浏览器] -->|1. 访问 http://ai.440700.xyz| Mailcow[VPS Port 80 (Mailcow Nginx)]
    Mailcow -->|2. 本地转发 (Proxy Pass)| Proxy[VPS Port 8000 (Custom Nginx)]
    Proxy -->|3. 加速通道 (HTTP/2)| CloudRun[Google Cloud Run (Asia-East1)]
    CloudRun -->|4. 调用| GoogleAPI[Google Gemini/Sora API]
    CloudRun -->|5. 存储/读取| GCS[Google Cloud Storage]
```

### 关键组件
1.  **Frontend (React/Vite)**: 用户界面，自适应相对路径 `/api` 以支持代理。
2.  **Backend (Node/Express)**: 处理业务逻辑、鉴权、支付、以及 **AI 媒体代理 (Media Proxy)**。
3.  **Proxy Server (Nginx)**: 部署在 `141.147.147.229`。
    *   **Port 80**: 由 Mailcow 占用，但已配置转发规则 (`ai_proxy.conf`) 将 `ai.440700.xyz` 转发给 Port 8000。
    *   **Port 8000**: 我们的核心加速代理，负责将流量清洗并转发给 Google Cloud Run。

---

## 3. 核心技术亮点 (Key Features)

### 🚀 全链路代理加速 (Full Proxy Coverage)
为了解决 "加载慢" 和 "Network Error" 问题，系统强制所有流量走代理：
*   **API 请求**: 前端使用相对路径 `/api`，自动经由 VPS 转发。
*   **视频播放**: 后端生成视频时，返回相对路径 `/api/ai/proxy?url=...`，确保视频流也走 VPS 加速 (支持断点续传/拖拽)。
*   **图片加速**: 后端生成的图片 URL 会自动被包装为 `/api/ai/proxy?url=GCS_URL`，解决 Google 存储链接加载慢和 CORS 跨域问题。

### 💾 状态持久化与防丢失 (State Persistence)
*   **问题**: 早期版本刷新页面后任务变回 "生成中"。
*   **解决方案**: 图片生成逻辑已移至后端 (`AiController`)。
    *   后端直接将 Base64 图片上传到 Google Cloud Storage (GCS)。
    *   后端直接更新数据库状态为 `COMPLETED`。
    *   前端仅负责展示，不再承担上传大文件的风险。

### 🛡️ 稳定性与错误处理
*   **超时优化**: Nginx 代理超时已设置为 **600秒 (10分钟)**，防止长视频生成时出现 504 Gateway Timeout。
*   **CORS 修复**: 后端 `server.ts` 对 CORS Origin 做了通配符处理，允许代理服务器 IP 访问。
*   **双重提交防护**: 前端增加 `isSubmitting` 锁，防止用户重复点击生成导致扣费异常。

---

## 4. 部署指南 (Deployment Guide)

### A. 全栈部署 (Cloud Run)
一键部署前端和后端代码到 Google Cloud Run：
```bash
./deploy-fullstack.sh
```

### B. 代理服务器部署 (VPS)
如果需要更新代理配置 (Nginx)：
```bash
# 自动通过 SSH 部署到 141.147.147.229:8000
expect deploy_proxy_8000.exp
```
*配置文件位于: `proxy_install.sh`*

### C. 域名转发配置 (Mailcow Integration)
如果需要修改 80 端口的转发规则 (例如绑定新域名)：
1. 修改 `sora_mailcow_proxy.conf`。
2. 运行部署脚本：
```bash
expect deploy_mailcow_proxy.exp
```
*这会将配置上传到 `/opt/mailcow-dockerized/data/conf/nginx/` 并重载 Mailcow。*

---

## 5. 常用命令与排查

*   **查看远程 Docker 状态**: `ssh root@141... "docker ps | grep 8000"`
*   **测试代理连通性**: `curl -v http://141.147.147.229:8000/api/health`
*   **Git 提交**: `git add . && git commit -m "update" && git push`

## 6. 版本历史
*   **v0.45**: 完整代理支持，CORS 修复。
*   **Rev 35-39**: 图片持久化修复，GCS 代理加速优化，域名端口转发支持.

---
*Created by Antigravity Agent*
