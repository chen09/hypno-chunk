# HypnoChunk Web 服务器部署指南

## 前置要求

1. **安装 Docker 和 Docker Compose**
   ```bash
   # 安装 Docker
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   
   # 将当前用户添加到 docker 组（避免每次都用 sudo）
   sudo usermod -aG docker $USER
   # 需要重新登录才能生效
   
   # 安装 Docker Compose
   sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
   sudo chmod +x /usr/local/bin/docker-compose
   ```

2. **创建音频文件目录**
   ```bash
   sudo mkdir -p /var/www/hypnochunk/data/2_audio_output
   sudo chown -R ubuntu:www-data /var/www/hypnochunk
   ```

3. **上传音频文件**
   - 将音频文件（`*_merged_final.mp3`）和字幕文件（`*_merged_final.srt`）上传到：
     `/var/www/hypnochunk/data/2_audio_output/`
   - 可以使用 `scp` 或 `rsync` 上传

## 部署步骤

1. **上传部署文件到服务器**
   ```bash
   # 从本地执行
   scp docker-compose.yml deploy.sh ubuntu@133.125.45.147:~/
   ```

2. **在服务器上执行部署**
   ```bash
   # SSH 到服务器
   ssh ubuntu@133.125.45.147
   
   # 进入用户目录
   cd ~
   
   # 运行部署脚本
   ./deploy.sh
   ```

3. **配置 Nginx（如果还没有）**
   ```nginx
   # /etc/nginx/sites-available/hypnochunk.com
   server {
       listen 80;
       server_name hypnochunk.com;
       
       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
       
       location /audio/ {
           proxy_pass http://localhost:3000/api/audio/;
           proxy_http_version 1.1;
           proxy_set_header Host $host;
           proxy_set_header Range $http_range;
           proxy_set_header If-Range $http_if_range;
       }
   }
   ```

4. **重载 Nginx**
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

## 更新流程

当有新的代码合并到 main 分支后：

1. **在服务器上运行更新脚本**
   ```bash
   ./deploy.sh
   ```

   或者手动执行：
   ```bash
   docker pull chen920/hypnochunk-web:latest
   docker-compose up -d
   ```

## 常用命令

- **查看容器日志**：`docker-compose logs -f`
- **查看容器状态**：`docker-compose ps`
- **重启容器**：`docker-compose restart`
- **停止容器**：`docker-compose down`
- **查看镜像**：`docker images | grep hypnochunk`

## 故障排查

- **容器无法启动**：检查日志 `docker-compose logs`
- **无法访问服务**：检查端口 3000 是否被占用 `netstat -tlnp | grep 3000`
- **音频文件找不到**：检查 volume 挂载 `docker-compose exec web ls -la /app/audio`
- **权限问题**：确保音频目录权限正确 `sudo chown -R ubuntu:www-data /var/www/hypnochunk`

