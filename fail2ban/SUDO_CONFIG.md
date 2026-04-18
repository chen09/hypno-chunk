# 配置 Ubuntu 用户无密码 sudo

## 方法 1: 使用配置脚本（推荐）

### 步骤 1: 上传脚本到服务器

```bash
# 从本地执行
scp fail2ban/configure-sudo-nopasswd.sh ubuntu@133.125.45.147:~/
```

### 步骤 2: 在服务器上执行

```bash
# SSH 到服务器
ssh ubuntu@133.125.45.147

# 执行配置脚本（需要当前 sudo 密码）
sudo bash ~/configure-sudo-nopasswd.sh
```

## 方法 2: 手动配置

### 步骤 1: SSH 到服务器

```bash
ssh ubuntu@133.125.45.147
```

### 步骤 2: 使用 visudo 创建配置文件

```bash
# 使用 visudo 创建配置文件（推荐，有语法检查）
sudo visudo -f /etc/sudoers.d/99-ubuntu-nopasswd
```

### 步骤 3: 添加以下内容

```
# 允许 ubuntu 用户无需密码使用 sudo
ubuntu ALL=(ALL) NOPASSWD: ALL
```

### 步骤 4: 保存并退出

- 如果使用 `visudo`：保存后会自动检查语法
- 如果使用其他编辑器：保存后运行 `sudo visudo -c` 检查语法

### 步骤 5: 设置正确的权限

```bash
sudo chmod 0440 /etc/sudoers.d/99-ubuntu-nopasswd
```

## 方法 3: 直接编辑（不推荐，但快速）

```bash
# 创建配置文件
echo "ubuntu ALL=(ALL) NOPASSWD: ALL" | sudo tee /etc/sudoers.d/99-ubuntu-nopasswd

# 设置权限
sudo chmod 0440 /etc/sudoers.d/99-ubuntu-nopasswd

# 验证语法
sudo visudo -c
```

## 验证配置

配置完成后，测试是否生效：

```bash
# 测试无密码 sudo
sudo -n whoami

# 应该输出: ubuntu（无需输入密码）
```

## 安全注意事项

⚠️ **重要提示**：

1. **仅限受信任的服务器**：无密码 sudo 会降低安全性，只应在受信任的服务器上使用
2. **限制范围**：如果需要更安全，可以限制特定命令：
   ```
   ubuntu ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose, /usr/bin/systemctl
   ```
3. **定期审查**：定期检查 `/etc/sudoers.d/` 目录下的文件
4. **备份**：配置前建议备份：
   ```bash
   sudo cp /etc/sudoers /etc/sudoers.backup
   ```

## 撤销配置

如果需要撤销无密码 sudo：

```bash
# 删除配置文件
sudo rm /etc/sudoers.d/99-ubuntu-nopasswd

# 或者注释掉内容
sudo visudo -f /etc/sudoers.d/99-ubuntu-nopasswd
```

## 故障排查

### 问题 1: 配置后仍然需要密码

```bash
# 检查文件是否存在
ls -la /etc/sudoers.d/99-ubuntu-nopasswd

# 检查文件权限（必须是 0440）
ls -l /etc/sudoers.d/99-ubuntu-nopasswd

# 检查语法
sudo visudo -c
```

### 问题 2: 语法错误导致无法使用 sudo

如果配置错误导致无法使用 sudo：

1. **使用 root 用户**（如果有 root 密码）：
   ```bash
   su -
   # 修复或删除配置文件
   rm /etc/sudoers.d/99-ubuntu-nopasswd
   ```

2. **从其他用户修复**（如果有其他 sudo 用户）

3. **单用户模式**：重启进入单用户模式修复

## 文件位置说明

- **主配置文件**: `/etc/sudoers`（不要直接编辑）
- **扩展配置目录**: `/etc/sudoers.d/`（推荐在这里添加配置）
- **配置文件命名**: 建议使用数字前缀（如 `99-ubuntu-nopasswd`）控制加载顺序
