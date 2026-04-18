# Fail2Ban 安全防护配置

## 概述

Fail2Ban 是一个用于防止暴力破解攻击的工具，通过监控日志文件并自动封禁恶意 IP 地址。

## 规则一览（快速查阅）

| Jail 名称 | 功能 | 封禁条件 | 封禁时间 |
|-----------|------|---------|---------|
| `sshd` | SSH 暴力破解防护 | 5 分钟内 3 次失败 | 2 小时 |
| `nginx-limit-req` | 请求频率限制 | 1 分钟内 10 次 | 10 分钟 |
| `nginx-botsearch` | 恶意扫描（404 / 敏感路径） | 5 分钟内 5 次 | 1 小时 |
| `nginx-noscript` | 脚本注入攻击 | 5 分钟内 3 次 | 1 小时 |
| `nginx-badbots` | 恶意爬虫 User-Agent | 10 分钟内 2 次 | 24 小时 |
| `recidive` | 累犯（重复违规者） | 24 小时内 3 次封禁 | 24 小时 |

## 配置文件结构

```
fail2ban/
├── install-fail2ban.sh        # 一键安装脚本
├── configure-sudo-nopasswd.sh # sudo 免密配置脚本
├── jail.local                 # 主配置文件（规则定义）
├── nginx-botsearch.conf       # 过滤器：恶意扫描检测
├── nginx-badbots.conf         # 过滤器：恶意爬虫检测
├── nginx-noscript.conf        # 过滤器：脚本注入检测
├── README.md                  # 本文档
└── SUDO_CONFIG.md             # sudo 免密配置说明
```

## 保护范围

### 1. SSH 保护 (`sshd`)
- **触发条件**: 3 次登录失败
- **封禁时间**: 2 小时
- **时间窗口**: 5 分钟内

### 2. Nginx 限流保护 (`nginx-limit-req`)
- **触发条件**: 10 次请求错误（60 秒内）
- **封禁时间**: 10 分钟
- **用途**: 防止请求频率过高

### 3. Nginx 恶意扫描防护 (`nginx-botsearch`)
- **触发条件**: 5 次恶意请求（5 分钟内）
- **封禁时间**: 1 小时
- **检测内容**:
  - 404/403/400 错误（可能是扫描）
  - 尝试访问敏感路径（php, admin, wp-login, .env, config 等）
  - SQL 注入尝试
  - 脚本注入尝试

### 4. Nginx 脚本注入防护 (`nginx-noscript`)
- **触发条件**: 3 次脚本注入尝试（5 分钟内）
- **封禁时间**: 1 小时
- **检测内容**: 尝试执行脚本文件（.php, .asp, .exe, .pl, .cgi 等）

### 5. Nginx 恶意爬虫防护 (`nginx-badbots`)
- **触发条件**: 2 次恶意爬虫请求（10 分钟内）
- **封禁时间**: 24 小时
- **检测内容**: 恶意爬虫的 User-Agent（排除 Google、Bing 等正常爬虫）

### 6. 累犯保护 (`recidive`)
- **触发条件**: 3 次被封禁记录（24 小时内）
- **封禁时间**: 24 小时
- **用途**: 对多次违规的 IP 进行更长时间封禁

## 安装步骤

### 1. 上传配置文件到服务器

```bash
# 从本地执行
scp -r fail2ban/ ubuntu@133.125.45.147:~/
```

### 2. 在服务器上执行安装

```bash
# SSH 到服务器
ssh ubuntu@133.125.45.147

# 进入目录
cd ~/fail2ban

# 运行安装脚本（需要 sudo）
sudo bash install-fail2ban.sh
```

### 3. 验证安装

```bash
# 检查 fail2ban 状态
sudo fail2ban-client status

# 检查各个 jail 的状态
sudo fail2ban-client status sshd
sudo fail2ban-client status nginx-botsearch
sudo fail2ban-client status nginx-noscript
sudo fail2ban-client status nginx-badbots
```

预期 `sudo fail2ban-client status` 输出：

```
Status
|- Number of jail:      6
`- Jail list:   nginx-badbots, nginx-botsearch, nginx-limit-req, nginx-noscript, recidive, sshd
```

预期安装脚本输出（成功）：

```
✅ fail2ban 安装完成
✅ 已备份现有 jail.local
✅ 已复制 jail.local
✅ 已复制 nginx-botsearch.conf
✅ 已复制 nginx-noscript.conf
✅ 已复制 nginx-badbots.conf
✅ Nginx 日志目录检查完成
✅ fail2ban 服务运行正常
```

## 常用命令

### 查看状态

```bash
# 查看所有 jail 状态
sudo fail2ban-client status

# 查看特定 jail 状态
sudo fail2ban-client status <jail-name>

# 查看被封禁的 IP
sudo fail2ban-client status <jail-name>
```

### 手动操作

```bash
# 手动封禁 IP
sudo fail2ban-client set <jail-name> banip <IP地址>

# 手动解封 IP
sudo fail2ban-client set <jail-name> unbanip <IP地址>

# 解封所有 IP（谨慎使用）
sudo fail2ban-client unban --all
```

### 查看日志

```bash
# 实时查看 fail2ban 日志
sudo tail -f /var/log/fail2ban.log

# 查看 Nginx 访问日志
sudo tail -f /var/log/nginx/access.log

# 查看 Nginx 错误日志
sudo tail -f /var/log/nginx/error.log
```

## 配置文件说明

### `jail.local`
主配置文件，定义所有 jail 的规则和参数。

### `nginx-botsearch.conf`
Nginx 恶意扫描过滤器，检测常见的攻击模式。

### `nginx-noscript.conf`
Nginx 脚本注入过滤器，检测脚本执行尝试。

### `nginx-badbots.conf`
Nginx 恶意爬虫过滤器，检测并阻止恶意爬虫。

## 自定义配置

如果需要调整封禁参数，编辑 `/etc/fail2ban/jail.local`：

```ini
[sshd]
maxretry = 3      # 最大重试次数
bantime = 7200   # 封禁时间（秒）
findtime = 300   # 时间窗口（秒）
```

修改后重启服务：

```bash
sudo systemctl restart fail2ban
```

## 注意事项

1. **白名单 IP**: 如果需要将某些 IP 加入白名单，编辑 `/etc/fail2ban/jail.local` 中的 `ignoreip` 参数。

2. **日志轮转**: 确保 Nginx 日志轮转不会影响 fail2ban，fail2ban 会自动处理日志轮转。

3. **测试**: 安装后建议测试一下，但不要在自己的 IP 上测试，避免被误封。

4. **监控**: 定期检查被封禁的 IP，确认规则正常工作。

5. **备份**: 安装脚本会自动备份现有配置，备份文件位于 `/etc/fail2ban/jail.local.backup.*`

## 故障排查

### fail2ban 无法启动

```bash
# 检查配置语法
sudo fail2ban-client -t

# 查看详细错误
sudo systemctl status fail2ban
sudo journalctl -u fail2ban -n 50
```

### 规则不生效

```bash
# 检查日志路径是否正确
sudo ls -la /var/log/nginx/access.log
sudo ls -la /var/log/nginx/error.log

# 测试过滤器
sudo fail2ban-client -d
```

### 误封问题

如果发现正常 IP 被误封：

```bash
# 立即解封
sudo fail2ban-client set <jail-name> unbanip <IP地址>

# 将 IP 加入白名单
# 编辑 /etc/fail2ban/jail.local，在对应 jail 的 ignoreip 中添加
```

## 更新配置

如果需要更新配置：

```bash
# 1. 上传新配置文件
scp fail2ban/jail.local ubuntu@133.125.45.147:~/fail2ban/

# 2. 在服务器上复制并重启
ssh ubuntu@133.125.45.147
sudo cp ~/fail2ban/jail.local /etc/fail2ban/jail.local
sudo systemctl restart fail2ban
```
