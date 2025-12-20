# Dockerfile for backend service

# 第一阶段：构建环境
FROM node:20-alpine as builder

# 设置工作目录
WORKDIR /app

# 复制后端依赖文件并安装
COPY backend/package*.json ./
RUN npm install

# 复制后端源代码
COPY backend/ .

# 编译 TypeScript
RUN npm run build

# 第二阶段：运行环境
FROM node:20-alpine

# 设置工作目录
WORKDIR /app

# 从第一阶段复制编译后的代码和依赖
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules

# Cloud Run 默认提供 PORT 环境变量 (默认为 8080)
ENV PORT=3001

# 暴露端口
EXPOSE 3001

# 启动服务
CMD ["node", "dist/server.js"]