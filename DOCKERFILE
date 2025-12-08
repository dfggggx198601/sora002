# 第一阶段：构建环境
FROM node:20-alpine as builder

# 设置工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install

# 复制所有源代码
COPY . .

# 执行构建 (默认生成到 /dist 目录)
RUN npm run build

# 第二阶段：运行环境
FROM node:20-alpine

# 安装轻量级静态文件服务工具 'serve'
RUN npm install -g serve

# 设置工作目录
WORKDIR /app

# 从第一阶段复制构建产物到当前目录
COPY --from=builder /app/dist .

# Cloud Run 默认提供 PORT 环境变量 (默认为 8080)
ENV PORT=8080

# 暴露端口
EXPOSE 8080

# 启动服务
# -s: 单页应用模式 (Single Page Application)，确保刷新不 404
# -l: 监听指定端口
CMD ["sh", "-c", "serve -s . -l $PORT"]
