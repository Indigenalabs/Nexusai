#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required"
  exit 1
fi

STAMP=$(date +%Y%m%d_%H%M%S)
OUT_DIR=${BACKUP_DIR:-./backups}
mkdir -p "$OUT_DIR"

pg_dump "$DATABASE_URL" > "$OUT_DIR/nexus_${STAMP}.sql"
cp -r backend/.data "$OUT_DIR/local_state_${STAMP}" 2>/dev/null || true

echo "Backup written to $OUT_DIR"
