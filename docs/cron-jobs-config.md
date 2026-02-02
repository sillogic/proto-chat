# ProtoChat Cron Jobs 配置指南

## 环境变量

在 `.env` 中添加：

```bash
# Cron Job 验证密钥（随机字符串，用于验证请求合法性）
CRON_SECRET=your-random-secret-key-here
```

---

## Cron 任务列表

| 任务 | 路径 | 北京时间 | 说明 |
|------|------|----------|------|
| 自动扣款 | `/api/cron/auto-deduct` | 09:00, 12:00 | 连续订阅自动扣款（两次尝试） |
| 订阅维护 | `/api/cron/subscription` | 14:00 | 积分发放、过期订阅降级 |
| 订单清理 | `/api/cron/cleanup-orders` | 周日 03:00 | 清理7天前的 pending/closed 订单 |
| 用户清理 | `/api/cron/cleanup-unverified-users` | 04:00 | 清理7天前未验证的僵尸用户 |

**执行顺序很重要**：自动扣款必须在订阅维护之前执行！

---

## 阿里云 Linux Crontab 配置

### 1. 编辑 crontab

```bash
crontab -e
```

### 2. 添加配置（北京时间 UTC+8）

```bash
# ================================================
# ProtoChat Cron Jobs
# 服务器时区：Asia/Shanghai (UTC+8)
# ================================================

# [重要] 自动扣款 - 连续订阅用户扣款
# 每天 09:00 第一次尝试，12:00 第二次尝试
# 两次都失败则降级为免费版
0 9,12 * * * curl -s -X POST "https://YOUR_DOMAIN/api/cron/auto-deduct" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1

# [重要] 订阅维护 - 积分发放 & 过期处理
# 每天 14:00 执行（必须在自动扣款之后）
# - 为到期用户发放每月积分
# - 处理一次性付费用户的过期降级
0 14 * * * curl -s -X POST "https://YOUR_DOMAIN/api/cron/subscription" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1

# 订单清理 - 清理7天前的 pending/closed 订单（paid 订单永久保留）
# 每周日凌晨 03:00 执行
0 3 * * 0 curl -s -X POST "https://YOUR_DOMAIN/api/cron/cleanup-orders" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1

# 用户清理 - 清理7天前未验证且从未使用的僵尸账号
# 每天凌晨 04:00 执行
0 4 * * * curl -s -X GET "https://YOUR_DOMAIN/api/cron/cleanup-unverified-users" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1
```

### 3. 替换变量

- `YOUR_DOMAIN` → 你的实际域名（如 `app.example.com`）
- `YOUR_CRON_SECRET` → 你在 `.env` 中设置的 `CRON_SECRET` 值

### 4. 保存并验证

```bash
# 查看已配置的任务
crontab -l

# 检查 cron 服务状态
systemctl status crond

# 查看日志
tail -f /var/log/protochat-cron.log
```

---

## 如果服务器时区是 UTC

如果服务器使用 UTC 时区，需要转换时间：

```bash
# UTC 时区配置
# 自动扣款: 01:00, 04:00 UTC = 09:00, 12:00 北京时间
0 1,4 * * * curl -s -X POST "https://YOUR_DOMAIN/api/cron/auto-deduct" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1

# 订阅维护: 06:00 UTC = 14:00 北京时间
0 6 * * * curl -s -X POST "https://YOUR_DOMAIN/api/cron/subscription" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1

# 订单清理: 周日 19:00 UTC = 周一 03:00 北京时间（或保持周日）
0 19 * * 6 curl -s -X POST "https://YOUR_DOMAIN/api/cron/cleanup-orders" -H "Authorization: Bearer YOUR_CRON_SECRET" >> /var/log/protochat-cron.log 2>&1
```

检查服务器时区：
```bash
timedatectl
```

---

## Vercel Cron 配置（备选）

如果使用 Vercel Pro，在 `vercel.json` 中添加：

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-deduct",
      "schedule": "0 1,4 * * *"
    },
    {
      "path": "/api/cron/subscription",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/cron/cleanup-orders",
      "schedule": "0 19 * * 6"
    }
  ]
}
```

> 注意：Vercel Cron 使用 UTC 时区，且 Hobby 版每天只能执行 1 次

---

## 任务执行流程

### 连续订阅用户（每日）

```
09:00  自动扣款第一次尝试
  ├─ 成功 → 续期，更新到期时间
  └─ 失败 → 记录失败，等待重试
       │
12:00  自动扣款第二次尝试
  ├─ 成功 → 续期，更新到期时间
  └─ 失败 → 降级为免费版
       │
14:00  订阅维护
  └─ 发放每月积分（已续期用户）
```

### 一次性付费用户（到期日）

```
14:00  订阅维护
  └─ 检测到已过期 → 降级为免费版，发放免费版积分
```

---

## 手动触发测试

```bash
# 测试自动扣款
curl -X POST "https://YOUR_DOMAIN/api/cron/auto-deduct" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 测试订阅维护
curl -X POST "https://YOUR_DOMAIN/api/cron/subscription" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# 测试订单清理
curl -X POST "https://YOUR_DOMAIN/api/cron/cleanup-orders" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 故障排查

### 1. 检查日志
```bash
tail -100 /var/log/protochat-cron.log
```

### 2. 检查 cron 是否运行
```bash
systemctl status crond
grep CRON /var/log/syslog  # Ubuntu
grep CRON /var/log/cron    # CentOS
```

### 3. 常见问题

| 问题 | 解决方案 |
|------|----------|
| 401 Unauthorized | 检查 CRON_SECRET 是否正确 |
| Connection refused | 检查域名和网络 |
| 任务没执行 | 检查 cron 服务状态和时区 |
