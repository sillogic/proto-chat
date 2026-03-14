#!/bin/bash
# 安装 ProtoChat cron 任务到系统 crontab
#
# 使用方式：
#   bash scripts/install-cron.sh
#
# 前置条件：
#   - 已在 /etc/environment 或当前用户 ~/.profile 中设置 CRON_SECRET
#   - 主项目运行在 http://127.0.0.1:3010
#
# 包含的定时任务（北京时间）：
#   - 08:05  每天   订阅维护（积分发放 + 到期降级）
#   - 04:00  每天   用户清理（删除未验证僵尸账号）
#   - 03:00  每周日 订单清理（删除7天前的 pending/closed 订单）
#   - 09:00 / 12:00  每天（自动扣款，待支付宝接入后取消注释）

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_SCRIPT="$SCRIPT_DIR/cron-jobs.sh"
LOG_DIR="/var/log/protochat"
ENV_FILE="/etc/protochat-cron.env"

echo "========================================"
echo "  ProtoChat Cron 安装脚本"
echo "========================================"

# 检查脚本存在
[ ! -f "$CRON_SCRIPT" ] && { echo "错误: 找不到 $CRON_SCRIPT"; exit 1; }

# 创建日志目录
mkdir -p "$LOG_DIR"
echo "✓ 日志目录: $LOG_DIR"

# 读取 CRON_SECRET
if [ -z "${CRON_SECRET:-}" ]; then
  # 尝试从主项目 .env 读取
  MAIN_ENV="$SCRIPT_DIR/../.env"
  if [ -f "$MAIN_ENV" ]; then
    CRON_SECRET=$(grep '^CRON_SECRET=' "$MAIN_ENV" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  fi
fi

if [ -z "${CRON_SECRET:-}" ]; then
  echo ""
  echo "未找到 CRON_SECRET，请手动输入："
  read -r -s -p "CRON_SECRET: " CRON_SECRET
  echo ""
fi

[ -z "$CRON_SECRET" ] && { echo "错误: CRON_SECRET 不能为空"; exit 1; }

# 写入专用环境变量文件（避免 crontab 无法读取 .env）
cat > "$ENV_FILE" <<EOF
CRON_SECRET=$CRON_SECRET
PROTOCHAT_URL=http://127.0.0.1:3010
LOG_DIR=$LOG_DIR
EOF
chmod 600 "$ENV_FILE"
echo "✓ 环境变量文件: $ENV_FILE"

# 确保脚本可执行
chmod +x "$CRON_SCRIPT"
echo "✓ 脚本权限已设置"

# 生成 crontab 条目
CRON_CMD="source $ENV_FILE && bash $CRON_SCRIPT"
CRON_ENTRIES="
# ProtoChat - 订阅维护（每天 08:05 北京时间 = 00:05 UTC）
5 0 * * * $CRON_CMD subscription >> $LOG_DIR/cron.log 2>&1

# ProtoChat - 用户清理（每天 04:00 北京时间 = 20:00 UTC 前一天）
0 20 * * * $CRON_CMD cleanup-users >> $LOG_DIR/cron.log 2>&1

# ProtoChat - 订单清理（每周日 03:00 北京时间 = 周六 19:00 UTC）
0 19 * * 6 $CRON_CMD cleanup-orders >> $LOG_DIR/cron.log 2>&1

# ProtoChat - 自动扣款（待接入支付宝后取消注释）
# 0 1 * * * $CRON_CMD auto-deduct >> $LOG_DIR/cron.log 2>&1
# 0 4 * * * $CRON_CMD auto-deduct >> $LOG_DIR/cron.log 2>&1
"

# 备份并更新 crontab（清除旧的 ProtoChat 条目后重新写入）
TMPFILE=$(mktemp)
crontab -l 2>/dev/null | grep -v "ProtoChat" | grep -v "cron-jobs.sh" > "$TMPFILE" || true
echo "$CRON_ENTRIES" >> "$TMPFILE"
crontab "$TMPFILE"
rm "$TMPFILE"

echo "✓ Crontab 已更新"
echo ""
echo "当前 crontab 内容："
echo "----------------------------------------"
crontab -l
echo "----------------------------------------"
echo ""
echo "✓ 安装完成！日志文件: $LOG_DIR/cron.log"
echo ""
echo "手动测试："
echo "  source $ENV_FILE && bash $CRON_SCRIPT subscription"
echo "  source $ENV_FILE && bash $CRON_SCRIPT cleanup-users"
echo "  source $ENV_FILE && bash $CRON_SCRIPT cleanup-orders"
