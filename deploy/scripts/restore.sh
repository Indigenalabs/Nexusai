#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

if [[ -z "${BACKUP_FILE:-}" ]]; then
  echo "BACKUP_FILE is required"
  exit 1
fi

psql "$DATABASE_URL" < "$BACKUP_FILE"
echo "Restore complete: $BACKUP_FILE"
