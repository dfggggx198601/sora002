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
FROM nginx:alpine

# 复制构建产物到 Nginx 静态文件目录
COPY --from=builder /app/dist /usr/share/nginx/html

# 复制 Nginx 配置文件
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Cloud Run 默认提供 PORT 环境变量 (默认为 8080)
ENV PORT=8080

# 暴露端口
EXPOSE 8080

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]