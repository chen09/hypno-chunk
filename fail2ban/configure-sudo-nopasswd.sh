#!/bin/bash
# 配置 Ubuntu 用户无密码 sudo
# 安全配置脚本

set -e

echo "=========================================="
echo "配置 Ubuntu 用户无密码 sudo"
echo "=========================================="

# 检查是否为 root 用户
if [ "$EUID" -ne 0 ]; then 
    echo "错误: 请使用 sudo 运行此脚本"
    exit 1
fi

# 检查 ubuntu 用户是否存在
if ! id "ubuntu" &>/dev/null; then
    echo "错误: ubuntu 用户不存在"
    exit 1
fi

# 创建 sudoers.d 配置文件
SUDOERS_FILE="/etc/sudoers.d/99-ubuntu-nopasswd"

echo ""
echo "创建配置文件: $SUDOERS_FILE"
echo ""

# 检查文件是否已存在
if [ -f "$SUDOERS_FILE" ]; then
    echo "⚠️  警告: 配置文件已存在"
    echo "备份现有配置..."
    cp "$SUDOERS_FILE" "${SUDOERS_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
fi

# 创建配置文件内容
cat > "$SUDOERS_FILE" << 'EOF'
# 允许 ubuntu 用户无需密码使用 sudo
# 此文件由 configure-sudo-nopasswd.sh 自动生成
# 修改时间: $(date)

ubuntu ALL=(ALL) NOPASSWD: ALL
EOF

# 设置正确的权限（sudoers 文件必须是 0440）
chmod 0440 "$SUDOERS_FILE"

# 验证配置语法
echo "验证配置语法..."
if visudo -c -f "$SUDOERS_FILE" 2>/dev/null; then
    echo "✅ 配置语法正确"
else
    echo "❌ 配置语法错误，已恢复备份"
    if [ -f "${SUDOERS_FILE}.backup" ]; then
        mv "${SUDOERS_FILE}.backup" "$SUDOERS_FILE"
    else
        rm -f "$SUDOERS_FILE"
    fi
    exit 1
fi

echo ""
echo "=========================================="
echo "配置完成！"
echo "=========================================="
echo ""
echo "ubuntu 用户现在可以无需密码使用 sudo"
echo ""
echo "测试命令："
echo "  su - ubuntu -c 'sudo -n whoami'"
echo ""
echo "配置文件位置: $SUDOERS_FILE"
echo ""
