#!/usr/bin/env bash
# Daily pg_dump to local/cloud-mounted backup dir. ponytail: cron-scheduled single dump, no rotation/retention logic yet — add when backup volume becomes a real cost concern.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
mkdir -p "$BACKUP_DIR"

pg_dump "$DATABASE_URL" > "$BACKUP_DIR/erp_${TIMESTAMP}.sql"
echo "Backup written to $BACKUP_DIR/erp_${TIMESTAMP}.sql"
