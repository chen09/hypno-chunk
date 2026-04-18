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

4. **配置 Fail2Ban（安全防护，推荐）**
   ```bash
   # 从本地上传 fail2ban 配置
   scp -r fail2ban/ ubuntu@133.125.45.147:~/
   
   # SSH 到服务器并安装
   ssh ubuntu@133.125.45.147
   cd ~/fail2ban
   sudo bash install-fail2ban.sh
   ```
   
   详细说明请参考 `fail2ban/README.md`

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

## 安全配置

### 2026-04 安全事件与硬性约束（必须遵守）

> 安全与运维策略的权威来源为 `AGENTS.md`（SSOT）。本节仅保留部署执行摘要。

1. **端口暴露策略**
   - 仅允许 `127.0.0.1:3000`，外部访问统一通过 Nginx。

2. **Docker 日志轮转**
   - 在 `docker-compose.yml` 保持 `max-size` / `max-file`，防止日志导致磁盘打满与 502。

3. **容器加固基线**
   - 持续保留 `read_only`、`security_opt`、`cap_drop`、资源限制（CPU/内存）。

4. **音频可追溯性**
   - 发布时同步维护：
     - `data/2_audio_output/output_input_mapping.csv`
     - `data/2_audio_output/output_input_mapping.md`

5. **变更流程**
   - 先更新 `AGENTS.md`，再同步本节摘要；如有冲突，以 `AGENTS.md` 为准。

### Fail2Ban 防护

Fail2Ban 用于防止暴力破解和恶意攻击，保护以下服务：

- **SSH**: 3 次登录失败封禁 2 小时
- **Nginx 恶意扫描**: 5 次恶意请求封禁 1 小时
- **Nginx 脚本注入**: 3 次尝试封禁 1 小时
- **Nginx 恶意爬虫**: 2 次检测封禁 24 小时

**常用命令**：
```bash
# 查看状态
sudo fail2ban-client status

# 查看被封禁的 IP
sudo fail2ban-client status sshd

# 手动解封 IP（如果误封）
sudo fail2ban-client set sshd unbanip <IP地址>
```

详细配置和使用说明请参考 `fail2ban/README.md`

## 故障排查

- **容器无法启动**：检查日志 `docker-compose logs`
- **无法访问服务**：检查端口 3000 是否被占用 `netstat -tlnp | grep 3000`
- **音频文件找不到**：检查 volume 挂载 `docker-compose exec web ls -la /app/audio`
- **权限问题**：确保音频目录权限正确 `sudo chown -R ubuntu:www-data /var/www/hypnochunk`
- **SSH 被误封**：使用 `sudo fail2ban-client set sshd unbanip <IP>` 解封，或从其他 IP 访问

