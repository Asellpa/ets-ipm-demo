# Backup and recovery runbook

A script is not a working recovery service. IT must provide encrypted storage, secret ownership, scheduling, monitoring and a completed restore drill.

## Backup design

Use an off-host restic repository controlled by the company, with separate protected credentials and an independently retained repository password. Encrypt production disks and backups; restrict backup access because they contain more than ordinary role-filtered exports. If the platform supports immutable retention, configure it with recovery rights separated from the app account.

`production/scripts/backup.sh` uses pg_dump custom format and restic encrypted backup for the dump and the full private file directory. Files are immutable and no automatic garbage collection runs, so a completed dump's referenced files remain present while backup runs. The script does not back up environment secrets, identity-provider state or ingress configuration: protect those separately using IT's secret/configuration recovery process.

Prerequisites on the backup worker: matching PostgreSQL client, restic, read access to the file volume and the protected secret files. Initialise the off-host repository once with `restic init` under company control. Set DATABASE_URL_FILE, ETS_FILE_DIR, RESTIC_REPOSITORY and RESTIC_PASSWORD_FILE. Test credentials without printing them. Schedule the script in the company's scheduler, for example nightly initially, **only if the agreed loss target permits it**. Nightly backups can lose nearly a day's changes; use more frequent/PITR database backup plus corresponding durable files if required.

Alert on failures and on absence of a successful backup within the agreed window. A zero exit from pg_dump alone is insufficient. Retention/pruning is deliberately not automatic: define daily/weekly/monthly retention with the data owner, legal/security team and storage budget before scheduling restic forget/prune. Protect keys so staff turnover does not make backups unrecoverable.

## Restore drill — isolated target only

1. Record incident/drill start time and chosen backup snapshot. Confirm target database, private file directory and hostname are isolated from production; disable any outbound integrations.
2. Run `restic check` and periodically an appropriate repository data-read check. Restore the selected snapshot into a new empty directory using restic's explicit target option. Snapshot paths include the original file path and temporary database dump path; use `restic ls SNAPSHOT` to locate them rather than assuming a fixed restore path.
3. Provision a fresh empty drill database with no application running. Create required roles/privileges. Set RESTORE_DATABASE_URL_FILE, RESTORE_DUMP and RESTORE_CONFIRMED_ISOLATED=yes, then run `production/scripts/restore-drill.sh`. It uses a single transaction, refuses to clean/overwrite existing schema and stops on failure.
4. Point ETS_FILE_DIR to the restored file directory and DATABASE_URL_FILE to the drill database. Run `node production/scripts/check-files.cjs`. Every referenced object attachment and feedback screenshot must pass hash/size verification. Missing or altered blobs fail the check.
5. Start the exact backed-up compatible app release in isolated staging using test identity mappings. Check representative project/workflow order, tasks, hours/corrections, sign-offs, client links, checklists, audit and restricted exports. Verify permitted downloads and denied financial access with separate roles. Never expose restored personal data to general testers.
6. Compare record counts and business totals with the recorded backup baseline. Record achieved recovery duration and latest retained business write time; have IT/data owner approve against the agreed RTO (downtime) and RPO (data loss).
7. Retain evidence privately; securely remove drill data under retention policy. A real recovery follows the same procedure but requires the incident/data owner's cutover approval, DNS/access change and rollback plan.

Credentials/sessions may exist in database backups. Before real recovery reopening, revoke gateway sessions as appropriate, clear restored local session state using an authorised database maintenance operation, review restored account/offboarding state and rotate compromised secrets. Never run such changes against live data as part of a routine drill.

## Current evidence boundary

Automated integration tests exercise transaction rollback, database reload and migration round-trip in an isolated PostgreSQL service. They do not prove that the company's backup repository, keys, scheduler, IdP or infrastructure can recover. Production remains blocked until a company-hosted database-plus-files drill is measured and approved.
