# Sora 创意工坊 - 后端 API 文档

## 🎯 新增功能

### 完整的后端系统
- ✅ Express + TypeScript RESTful API
- ✅ Google Cloud Firestore 数据库
- ✅ JWT 用户认证
- ✅ 跨设备数据同步
- ✅ Docker Compose 一键部署

---

## 📦 项目结构更新

```
sora002/
├── backend/                    # 新增：后端服务
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts    # Firestore 连接
│   │   ├── controllers/
│   │   │   ├── authController.ts  # 认证控制器
│   │   │   └── taskController.ts  # 任务控制器
│   │   ├── middleware/
│   │   │   └── auth.ts        # JWT 认证中间件
│   │   ├── models/
│   │   │   ├── User.ts        # 用户模型
│   │   │   └── Task.ts        # 任务模型
│   │   ├── routes/
│   │   │   ├── auth.ts        # 认证路由
│   │   │   └── tasks.ts       # 任务路由
│   │   └── server.ts          # 主服务器
│   ├── Dockerfile             # 后端 Docker 配置
│   ├── package.json
│   └── tsconfig.json
├── services/
│   └── apiService.ts          # 新增：前端 API 客户端
├── docker-compose.yml         # 新增：完整服务编排
└── ... (原有文件)
```

---

## 🚀 快速开始

### 方式一：Docker Compose

```bash
# 1. 克隆项目
cd /Users/apple/sora002

# 2. 启动服务（后端 + 前端）
# 注意：需要配置 Google Cloud 凭证才能连接 Firestore
docker-compose up -d

# 3. 查看日志
docker-compose logs -f

# 4. 停止服务
docker-compose down
```

访问地址：
- 前端：http://localhost:8080
- 后端 API：http://localhost:3001
- 健康检查：http://localhost:3001/health

### 方式二：本地开发

#### 准备工作
确保你已经安装 gcloud CLI 并登录，且项目已启用 Firestore API。
```bash
gcloud auth application-default login
```

#### 启动后端
```bash
cd backend
npm install
npm run dev  # 开发模式
# 或
npm run build && npm start  # 生产模式
```

#### 启动前端
```bash
npm install
npm run dev
```

---

## 📚 API 文档

### Base URL
```
http://localhost:3001/api
```

### 认证相关

#### 1. 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password",
  "username": "用户名"
}
```

响应：
```json
{
  "message": "User registered successfully",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "...",
    "email": "user@example.com",
    "username": "用户名",
    "quota": {
      "dailyVideoLimit": 10,
      "dailyImageLimit": 50,
      "videoCount": 0,
      "imageCount": 0
    }
  }
}
```

#### 2. 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "secure_password"
}
```

#### 3. 获取用户信息
```http
GET /api/auth/profile
Authorization: Bearer <token>
```

---

### 任务管理（需要认证）

#### 1. 获取所有任务
```http
GET /api/tasks
Authorization: Bearer <token>
```

响应：
```json
{
  "tasks": [
    {
      "_id": "...",
      "type": "VIDEO",
      "status": "COMPLETED",
      "prompt": "描述...",
      "model": "sora-video-landscape-10s",
      "videoUrl": "https://...",
      "createdAt": "2025-12-17T...",
      "completedAt": "2025-12-17T..."
    }
  ]
}
```

#### 2. 创建任务
```http
POST /api/tasks
Authorization: Bearer <token>
Content-Type: application/json

{
  "type": "VIDEO",
  "prompt": "一只在霓虹灯下奔跑的赛博朋克猫",
  "model": "sora-video-landscape-10s",
  "imagePreviewUrl": "data:image/png;base64,..."
}
```

#### 3. 更新任务状态
```http
PUT /api/tasks/:taskId
Authorization: Bearer <token>
Content-Type: application/json

{
  "status": "COMPLETED",
  "videoUrl": "https://...",
  "error": null
}
```

#### 4. 删除任务
```http
DELETE /api/tasks/:taskId
Authorization: Bearer <token>
```

#### 5. 同步任务（跨设备）
```http
POST /api/tasks/sync
Authorization: Bearer <token>
Content-Type: application/json

{
  "tasks": [...],
  "lastSyncTime": "2025-12-17T..."
}
```

#### 6. 获取配额信息
```http
GET /api/tasks/quota
Authorization: Bearer <token>
```

---

## 🔐 前端集成示例

### 1. 用户注册/登录
```typescript
import { apiService } from './services/apiService';

// 注册
const handleRegister = async () => {
  try {
    const result = await apiService.register(
      'user@example.com',
      'password123',
      'Username'
    );
    console.log('Registered:', result.user);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// 登录
const handleLogin = async () => {
  try {
    const result = await apiService.login(
      'user@example.com',
      'password123'
    );
    console.log('Logged in:', result.user);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// 检查登录状态
if (apiService.isAuthenticated()) {
  console.log('User is logged in');
}
```

### 2. 任务同步
```typescript
// 创建任务并同步到服务器
const createTask = async (taskData) => {
  try {
    const result = await apiService.createTask({
      type: 'VIDEO',
      prompt: 'Amazing video',
      model: 'sora-video-landscape-10s'
    });
    
    console.log('Task created:', result.task);
    console.log('Remaining quota:', result.quota);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// 获取所有任务
const loadTasks = async () => {
  try {
    const result = await apiService.getTasks();
    console.log('Tasks:', result.tasks);
  } catch (error) {
    console.error('Error:', error.message);
  }
};

// 跨设备同步
const syncTasks = async () => {
  try {
    const lastSyncTime = localStorage.getItem('lastSyncTime') || new Date(0);
    const localTasks = await dbService.loadTasks();
    
    const result = await apiService.syncTasks(localTasks, new Date(lastSyncTime));
    
    // 更新本地数据
    await dbService.saveTasks(result.tasks);
    localStorage.setItem('lastSyncTime', result.syncTime);
  } catch (error) {
    console.error('Sync error:', error.message);
  }
};
```

---

## 🌐 部署到 Cloud Run

### 部署后端

```bash
# 1. 创建后端服务
cd backend
gcloud run deploy sora-backend \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 3001 \
  --set-env-vars JWT_SECRET=your-secret
# Firestore 凭证会自动通过 ADC (Application Default Credentials) 获取

# 2. 获取后端 URL
BACKEND_URL=$(gcloud run services describe sora-backend --region asia-east1 --format='value(status.url)')
echo $BACKEND_URL
```

### 更新前端环境变量

创建 `.env.production`：
```
VITE_API_URL=https://sora-backend-xxx.run.app
```

### 重新部署前端

```bash
cd ..
gcloud run deploy sora-studio \
  --source . \
  --region asia-east1 \
  --allow-unauthenticated \
  --port 8080 \
  --set-env-vars VITE_API_URL=$BACKEND_URL
```

---

## 💾 数据库管理

### Google Cloud Firestore

项目使用 Google Cloud Firestore NoSQL 数据库。

1. 在 Google Cloud Console 中启用 Firestore。
2. 创建一个 Firestore 数据库（Native 模式）。
3. Cloud Run 服务账号会自动拥有访问权限。

---

## 🔒 安全建议

### 生产环境必须修改

1. **JWT_SECRET**: 使用强随机字符串
   ```bash
   # 生成安全的 secret
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

2. **CORS 配置**: 限制允许的来源
   ```
   CORS_ORIGIN=https://your-frontend-domain.com
   ```

3. **HTTPS**: Cloud Run 自动提供，本地开发建议使用反向代理

---

## 📊 功能对比

| 功能 | 之前 | 现在 |
|-----|------|------|
| 数据存储 | 仅 IndexedDB（本地） | Firestore（云端） + IndexedDB（本地缓存） |
| 用户系统 | ❌ 无 | ✅ 完整认证系统 |
| 配额管理 | 仅前端 | 后端强制执行 |
| 跨设备同步 | ❌ 不支持 | ✅ 完全支持 |
| 数据安全 | 无加密 | JWT + HTTPS |
| 多用户 | ❌ 不支持 | ✅ 支持 |

---

## 🐛 故障排除

### 1. 无法连接 Firestore
```bash
# 检查是否启用了 Firestore API
gcloud services list | grep firestore

# 检查服务账号权限
# Cloud Run 的默认服务账号应具有 Cloud Datastore User 角色
```

### 2. 后端启动失败
```bash
# 检查环境变量
cat backend/.env

# 查看后端日志
cd backend && npm run dev
```

### 3. 前端无法连接后端
```bash
# 检查 CORS 配置
# 确保后端 CORS_ORIGIN 包含前端地址

# 检查网络
curl http://localhost:3001/health
```

---

完整的后端系统已搭建完成！🎉
