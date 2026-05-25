#!/usr/bin/env bash
set -euo pipefail

ENV_FILE="${ENV_FILE:-.env}"
BACKUP_FILE="${1:-}"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: ./scripts/restore_postgres.sh path/to/backup.dump"
  exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE"
  exit 1
fi

if [ -f "$ENV_FILE" ]; then
  set -a
  . "$ENV_FILE"
  set +a
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set"
  exit 1
fi

if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Restore is destructive."
  echo "Run with CONFIRM_RESTORE=yes to continue."
  exit 1
fi

pg_restore \
  --clean \
  --if-exists \
  --no-owner \
  --no-privileges \
  --dbname="$DATABASE_URL" \
  "$BACKUP_FILE"

echo "Restore completed from: $BACKUP_FILE"