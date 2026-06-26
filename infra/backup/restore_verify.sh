#!/usr/bin/env bash
# Restores the latest backup into a throwaway DB and checks row counts as a sanity check.
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
VERIFY_DB_URL="${VERIFY_DB_URL:?set VERIFY_DB_URL to a throwaway database}"

LATEST="$(ls -t "$BACKUP_DIR"/*.sql | head -1)"
echo "Restoring $LATEST into $VERIFY_DB_URL"
psql "$VERIFY_DB_URL" < "$LATEST"

ROWS=$(psql "$VERIFY_DB_URL" -t -c "SELECT count(*) FROM warehouse;")
echo "warehouse row count after restore: $ROWS"
if [ "$ROWS" -lt 1 ]; then
  echo "RESTORE VERIFICATION FAILED: expected at least 1 warehouse row"
  exit 1
fi
echo "Restore verification passed."
