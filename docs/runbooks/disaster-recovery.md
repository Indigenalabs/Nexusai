# Disaster Recovery Runbook

## RTO/RPO Targets
- RTO: 60 minutes
- RPO: 24 hours

## Incident Steps
1. Declare incident and assign commander.
2. Freeze writes if corruption is suspected.
3. Provision recovery environment.
4. Restore latest database backup.
5. Restore local state (`backend/.data`) if required.
6. Redeploy latest known-good image.
7. Run system checks (`npm run verify:system`, `npm run verify:phase4`).
8. Re-enable traffic and monitor `/v4/slo`.

## Post-Incident
- Capture timeline and root cause.
- Patch runbooks and automation.
- Run follow-up resilience test.
