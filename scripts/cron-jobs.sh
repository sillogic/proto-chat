#!/bin/bash
# ProtoChat Subscription Cron Jobs
# 调用主项目 cron 接口，处理订阅到期降级和积分发放
#
# 依赖：curl, jq（可选，用于解析响应）
# 安装：bash scripts/install-cron.sh
#
# 手动执行：
#   bash scripts/cron-jobs.sh subscription
#   bash scripts/cron-jobs.sh auto-deduct  (待接入支付宝后启用)
#   bash scripts/cron-jobs.sh cleanup-orders
#   bash scripts/cron-jobs.sh cleanup-users

set -euo pipefail

# ============================================================
# 配置
# ============================================================
PROTOCHAT_URL="${PROTOCHAT_URL:-http://127.0.0.1:3010}"
CRON_SECRET="${CRON_SECRET:-}"
LOG_DIR="${LOG_DIR:-/var/log/protochat}"
LOG_FILE="$LOG_DIR/cron.log"

JOB="${1:-subscription}"

# ============================================================
# 工具函数
# ============================================================
log() {
  local level="$1"
  shift
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$level] $*" | tee -a "$LOG_FILE"
}

die() {
  log "ERROR" "$*"
  exit 1
}

# ============================================================
# 检查配置
# ============================================================
[ -z "$CRON_SECRET" ] && die "CRON_SECRET 未设置，请在环境变量或 .env 中配置"
[ ! -d "$LOG_DIR" ] && mkdir -p "$LOG_DIR"

# ============================================================
# 执行 cron job
# ============================================================
run_job() {
  local job_name="$1"
  local url="$2"

  log "INFO" "开始执行: $job_name → $url"

  local http_code
  local response

  response=$(curl -s -w "\n%{http_code}" \
    -X POST "$url" \
    -H "Authorization: Bearer $CRON_SECRET" \
    -H "Content-Type: application/json" \
    --connect-timeout 10 \
    --max-time 300 \
    2>&1) || die "curl 请求失败: $job_name"

  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | head -n -1)

  if [ "$http_code" -eq 200 ]; then
    log "INFO" "成功 [$http_code]: $job_name → $body"
  else
    log "ERROR" "失败 [$http_code]: $job_name → $body"
    exit 1
  fi
}

# ============================================================
# 任务入口
# ============================================================
case "$JOB" in
  subscription)
    # 每天执行：处理订阅到期降级 + 积分发放
    run_job "subscription-maintenance" "$PROTOCHAT_URL/api/cron/subscription"
    ;;

  auto-deduct)
    # 待接入支付宝代扣后启用
    # 每天 09:00 / 12:00 北京时间各执行一次
    run_job "auto-deduct" "$PROTOCHAT_URL/api/cron/auto-deduct"
    ;;

  cleanup-orders)
    # 每周执行：清理7天前的 pending/closed 订单
    run_job "cleanup-orders" "$PROTOCHAT_URL/api/cron/cleanup-orders"
    ;;

  cleanup-users)
    # 每天执行：清理7天前未验证的僵尸账号
    run_job "cleanup-unverified-users" "$PROTOCHAT_URL/api/cron/cleanup-unverified-users"
    ;;

  *)
    die "未知任务: $JOB，可用值: subscription | auto-deduct | cleanup-orders | cleanup-users"
    ;;
esac

log "INFO" "任务完成: $JOB"
