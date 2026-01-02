#!/bin/bash
set -e

# Configuration
FRONTEND_URL="https://sora-studio-v2-718161097168.asia-east1.run.app"
BACKEND_URL="https://sora-backend-718161097168.asia-east1.run.app"

echo "🚀 Sora Studio Proxy Installer"
echo "------------------------------"

# 1. Install Docker if missing
if ! command -v docker &> /dev/null; then
    echo "📦 Installing Docker..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

# 2. Setup Directory
mkdir -p ~/sora-proxy
cd ~/sora-proxy

# 3. Create Nginx Config
echo "📝 Creating nginx.conf..."
cat > nginx.conf <<EOF
events {
    worker_connections 1024;
}

http {
    include       mime.types;
    default_type  application/octet-stream;
    
    # Optimizations
    sendfile        on;
    keepalive_timeout  65;
    client_max_body_size 50M;
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    server {
        listen 8000;
        server_name _; # Catch all

        # Optimizations for Proxy
        resolver 8.8.8.8 1.1.1.1 valid=300s;
        resolver_timeout 5s;

        # Proxy to Frontend
        location / {
            proxy_pass $FRONTEND_URL;
            proxy_ssl_server_name on;
            proxy_set_header Host sora-studio-v2-718161097168.asia-east1.run.app;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto \$scheme;
        }

        # Proxy to Backend API
        location /api/ {
            proxy_pass $BACKEND_URL;
            proxy_ssl_server_name on;
            proxy_set_header Host sora-backend-718161097168.asia-east1.run.app;
            proxy_set_header X-Real-IP \$remote_addr;
            proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        }
    }
}
EOF

# 4. Create Docker Compose (Host Mode)
echo "📝 Creating docker-compose.yml..."
cat > docker-compose.yml <<EOF
version: '3'
services:
  nginx:
    image: nginx:alpine
    network_mode: "host" # Use Host Networking to bypass Docker Bridge/MTU issues
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    restart: always
EOF

# 5. Start
echo "🔥 Starting Proxy..."
docker compose up -d

echo "------------------------------"
echo "✅ Proxy Deployed at http://$(curl -s ifconfig.me)"
echo "   (Make sure port 80 is open in firewall)"
echo "💡 To use this proxy:"
echo "   1. Point your domain A record to this IP."
echo "   2. Visit http://your-domain.com"
echo "------------------------------"
