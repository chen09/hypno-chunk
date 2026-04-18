#!/bin/bash
# Fail2Ban 安装和配置脚本
# 用于 HypnoChunk 服务器安全防护

set -e

echo "=========================================="
echo "Fail2Ban 安装和配置脚本"
echo "=========================================="

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "错误: 请使用 sudo 运行此脚本"
    exit 1
fi

# 1. 安装 fail2ban
echo ""
echo "[1/5] 安装 fail2ban..."
if ! command -v fail2ban-server &> /dev/null; then
    apt-get update
    apt-get install -y fail2ban
    echo "✅ fail2ban 安装完成"
else
    echo "✅ fail2ban 已安装"
fi

# 2. 备份现有配置
echo ""
echo "[2/5] 备份现有配置..."
if [ -f /etc/fail2ban/jail.local ]; then
    cp /etc/fail2ban/jail.local /etc/fail2ban/jail.local.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ 已备份现有 jail.local"
fi

# 3. 复制配置文件
echo ""
echo "[3/5] 复制配置文件..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# 复制主配置文件
cp "$SCRIPT_DIR/jail.local" /etc/fail2ban/jail.local
chmod 644 /etc/fail2ban/jail.local
echo "✅ 已复制 jail.local"

# 复制过滤器（如果存在）
if [ -f "$SCRIPT_DIR/nginx-botsearch.conf" ]; then
    cp "$SCRIPT_DIR/nginx-botsearch.conf" /etc/fail2ban/filter.d/nginx-botsearch.conf
    chmod 644 /etc/fail2ban/filter.d/nginx-botsearch.conf
    echo "✅ 已复制 nginx-botsearch.conf"
fi

if [ -f "$SCRIPT_DIR/nginx-noscript.conf" ]; then
    cp "$SCRIPT_DIR/nginx-noscript.conf" /etc/fail2ban/filter.d/nginx-noscript.conf
    chmod 644 /etc/fail2ban/filter.d/nginx-noscript.conf
    echo "✅ 已复制 nginx-noscript.conf"
fi

if [ -f "$SCRIPT_DIR/nginx-badbots.conf" ]; then
    cp "$SCRIPT_DIR/nginx-badbots.conf" /etc/fail2ban/filter.d/nginx-badbots.conf
    chmod 644 /etc/fail2ban/filter.d/nginx-badbots.conf
    echo "✅ 已复制 nginx-badbots.conf"
fi

# 4. 确保 Nginx 日志目录存在且可读
echo ""
echo "[4/5] 检查 Nginx 日志..."
if [ -d /var/log/nginx ]; then
    # 确保 fail2ban 可以读取日志
    chmod 644 /var/log/nginx/*.log 2>/dev/null || true
    echo "✅ Nginx 日志目录检查完成"
else
    echo "⚠️  警告: Nginx 日志目录不存在，某些规则可能无法工作"
fi

# 5. 启动和启用 fail2ban
echo ""
echo "[5/5] 启动 fail2ban 服务..."
systemctl daemon-reload
systemctl enable fail2ban
systemctl restart fail2ban

# 等待服务启动
sleep 2

# 检查服务状态
if systemctl is-active --quiet fail2ban; then
    echo "✅ fail2ban 服务运行正常"
else
    echo "❌ 错误: fail2ban 服务启动失败"
    systemctl status fail2ban
    exit 1
fi

# 显示状态
echo ""
echo "=========================================="
echo "安装完成！"
echo "=========================================="
echo ""
echo "查看 fail2ban 状态:"
echo "  sudo fail2ban-client status"
echo ""
echo "查看特定 jail 状态:"
echo "  sudo fail2ban-client status sshd"
echo "  sudo fail2ban-client status nginx-botsearch"
echo ""
echo "查看被封禁的 IP:"
echo "  sudo fail2ban-client status <jail-name>"
echo ""
echo "手动封禁 IP:"
echo "  sudo fail2ban-client set <jail-name> banip <IP>"
echo ""
echo "手动解封 IP:"
echo "  sudo fail2ban-client set <jail-name> unbanip <IP>"
echo ""
echo "查看日志:"
echo "  sudo tail -f /var/log/fail2ban.log"
echo ""
