# Backup and Restore Runbook

## Backup
1. Export `DATABASE_URL`
2. Run `bash deploy/scripts/backup.sh`
3. Verify SQL dump exists in `${BACKUP_DIR:-./backups}`

## Restore
1. Export `DATABASE_URL`
2. Export `BACKUP_FILE=/path/to/dump.sql`
3. Run `bash deploy/scripts/restore.sh`
4. Restart backend deployment

## Cadence
- Daily full backup
- 30-day retention minimum
- Weekly restore drill in staging
