# HypnoChunk Web 应用部署里程碑

**日期**: 2025年11月23日

## 🎉 里程碑概述

成功完成 HypnoChunk Web 应用的完整生产环境部署，包括 CI/CD 流程、Docker 容器化、Nginx 反向代理配置。

## ✅ 完成的关键工作

### 1. CI/CD 流程建立
- **GitHub Actions CI**: 
  - 文件: `.github/workflows/ci.yml`
  - 触发: Pull Request 到 `main` 分支
  - 功能: 自动运行 lint、TypeScript 类型检查、构建测试
- **GitHub Actions CD**: 
  - 文件: `.github/workflows/docker-build.yml`
  - 触发: Merge 到 `main` 分支
  - 功能: 自动构建 Docker 镜像并推送到 Docker Hub (`chen920/hypnochunk-web:latest`)
  - 架构: 仅构建 `linux/amd64`（服务器为 x86_64）

### 2. Docker 容器化
- **Dockerfile**: `web/Dockerfile`
  - 多阶段构建（builder + runner）
  - 使用 Node.js 20 Alpine
  - 支持 Next.js standalone 模式
- **Docker Compose**: `docker-compose.yml`
  - 镜像: `chen920/hypnochunk-web:latest`
  - 端口映射: `3000:3000`
  - Volume 挂载: `/var/www/hypnochunk/data/2_audio_output:/app/audio:ro`
  - 环境变量: `AUDIO_DIR=/app/audio`, `NODE_ENV=production`
  - 健康检查: 自动检测服务状态

### 3. 服务器环境配置
- **服务器**: Ubuntu 24.04.3 LTS (x86_64)
- **IP**: 133.125.45.147
- **域名**: hypnochunk.com (HTTPS)
- **Docker**: 已安装并配置用户权限
- **音频文件目录**: `/var/www/hypnochunk/data/2_audio_output`
- **部署目录**: `~/hypnochunk/`

### 4. Nginx 配置
- **配置文件**: `/etc/nginx/sites-available/hypnochunk.com`
- **功能**:
  - HTTPS/SSL 支持（Let's Encrypt 证书）
  - 反向代理到 Docker 容器 (`localhost:3000`)
  - 音频文件流式播放支持（Range 请求）
  - 路径: `/audio/` → `/api/audio/`

### 5. 部署脚本
- **文件**: `deploy.sh`
- **功能**:
  - 自动拉取最新 Docker 镜像
  - 停止旧容器并启动新容器
  - 检查容器状态
  - 清理未使用的镜像
- **特点**: 支持放在任意子目录，自动检测脚本所在目录

### 6. 应用功能
- ✅ 音频播放器（固定顶部）
- ✅ 字幕显示（固定位置，同步播放）
- ✅ 音频文件列表（仅显示 `_merged_final.mp3`）
- ✅ 响应式设计（支持手机、平板）
- ✅ SRT 字幕解析和同步显示
- ✅ 音频流式播放（支持 Range 请求）

## 🛠️ 技术栈

- **前端**: Next.js 16.0.3, React, Tailwind CSS
- **音频播放**: react-h5-audio-player
- **容器化**: Docker, Docker Compose
- **CI/CD**: GitHub Actions
- **Web 服务器**: Nginx
- **SSL**: Let's Encrypt (Certbot)

## 📋 部署流程

1. 开发 → 推送代码到 GitHub
2. 创建 PR → CI 自动检查（lint, type check, build）
3. Merge 到 main → CD 自动构建并推送 Docker 镜像
4. 服务器部署: `cd ~/hypnochunk && ./deploy.sh`

## 📁 重要文件位置

### 本地
- `web/` - Next.js 应用源码
- `docker-compose.yml` - Docker Compose 配置
- `deploy.sh` - 部署脚本
- `.github/workflows/` - CI/CD 工作流

### 服务器
- `~/hypnochunk/` - 部署目录（包含 `docker-compose.yml` 和 `deploy.sh`）
- `/var/www/hypnochunk/data/2_audio_output/` - 音频文件目录
- `/etc/nginx/sites-available/hypnochunk.com` - Nginx 配置

## 🔧 后续维护

### 更新应用
```bash
# 在服务器上
cd ~/hypnochunk
./deploy.sh
```

### 查看日志
```bash
cd ~/hypnochunk
docker-compose logs -f
```

### 添加新音频文件
```bash
scp data/2_audio_output/*_merged_final.* ubuntu@133.125.45.147:/var/www/hypnochunk/data/2_audio_output/
```

## 🎯 里程碑意义

这是项目从开发环境到生产环境的完整部署，标志着：
- ✅ 自动化 CI/CD 流程建立
- ✅ 容器化部署方案成熟
- ✅ 生产环境稳定运行
- ✅ 可扩展的部署架构

## 🔑 相关配置信息

- **Docker Hub**: `chen920/hypnochunk-web:latest`
- **GitHub 仓库**: `chen09/hypno-chunk`
- **生产域名**: https://hypnochunk.com
- **服务器架构**: x86_64 (amd64)

