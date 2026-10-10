#!/bin/bash
# Install the automatic CarMate backup schedule (macOS / Linux, using crontab).
#   ./scripts/setup-backup-cron.sh            # 02:00 every day
#   ./scripts/setup-backup-cron.sh --remove   # remove the schedule
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NODE_BIN="$(command -v node)"
LOG="$ROOT/apps/api/data/backup.log"
MARKER="# carmate-backup"
JOB="0 2 * * * cd $ROOT && $NODE_BIN scripts/backup-db.js >> $LOG 2>&1 $MARKER"

if [ "${1:-}" = "--remove" ]; then
  crontab -l 2>/dev/null | grep -v "$MARKER" | crontab - || true
  echo "✓ Đã gỡ lịch sao lưu tự động."
  exit 0
fi

if [ -z "$NODE_BIN" ]; then
  echo "✗ Không tìm thấy node trong PATH." >&2
  exit 1
fi

# Replace the old job if one exists, to avoid duplicates on re-runs
( crontab -l 2>/dev/null | grep -v "$MARKER" || true; echo "$JOB" ) | crontab -

echo "✓ Đã cài lịch sao lưu: 02:00 hằng ngày"
echo "  Thư mục : $ROOT/apps/api/data/backups"
echo "  Nhật ký : $LOG"
echo "  Kiểm tra: crontab -l | grep carmate"
echo ""
echo "Lưu ý macOS: cron cần quyền Full Disk Access"
echo "  (System Settings > Privacy & Security > Full Disk Access > thêm /usr/sbin/cron)"
