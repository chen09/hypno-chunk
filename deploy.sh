#!/bin/bash

# HypnoChunk Web Docker 部署脚本

set -e

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== HypnoChunk Web 部署脚本 ==="
echo "工作目录: $SCRIPT_DIR"

# 检查 docker-compose.yml 是否存在
if [ ! -f "docker-compose.yml" ]; then
    echo "错误: 找不到 docker-compose.yml 文件"
    echo "请确保 docker-compose.yml 和 deploy.sh 在同一个目录"
    exit 1
fi

# 1. 拉取最新镜像
echo "1. 拉取最新 Docker 镜像..."
docker pull chen920/hypnochunk-web:latest

# 2. 停止旧容器（如果存在）
echo "2. 停止旧容器..."
docker-compose -f "$SCRIPT_DIR/docker-compose.yml" down 2>/dev/null || true

# 3. 启动新容器
echo "3. 启动新容器..."
docker-compose -f "$SCRIPT_DIR/docker-compose.yml" up -d

# 4. 等待容器启动
echo "4. 等待容器启动..."
sleep 5

# 5. 检查容器状态
echo "5. 检查容器状态..."
docker-compose -f "$SCRIPT_DIR/docker-compose.yml" ps

# 6. 清理旧镜像（可选）
echo "6. 清理未使用的镜像..."
docker image prune -f

echo ""
echo "=== 部署完成 ==="
echo "容器应该正在运行，可以通过以下命令查看日志："
echo "  docker-compose logs -f"
echo ""
echo "检查服务状态："
echo "  curl http://localhost:3000/api/files"

