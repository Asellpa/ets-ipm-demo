#!/bin/sh
# Restic restore must first be performed into a new, isolated directory by the operator.
set -eu
umask 077
: "${RESTORE_DATABASE_URL_FILE:?Use an isolated empty drill database}"
: "${RESTORE_DUMP:?Path to decrypted database.dump}"
: "${RESTORE_CONFIRMED_ISOLATED:?Set to yes after verifying target is NOT production}"
[ "$RESTORE_CONFIRMED_ISOLATED" = yes ] || exit 1
export PGDATABASE="$(cat "$RESTORE_DATABASE_URL_FILE")"
# No --clean: existing schema causes a failure instead of silently overwriting it.
# Avoid a credential-bearing URI in the process command line.
node - "$RESTORE_DUMP" <<'NODE'
const {spawnSync}=require('node:child_process');
const u=new URL(process.env.PGDATABASE),env={...process.env,PGHOST:u.hostname,PGPORT:u.port||'5432',PGUSER:decodeURIComponent(u.username),PGPASSWORD:decodeURIComponent(u.password),PGDATABASE:decodeURIComponent(u.pathname.slice(1))};
if(u.searchParams.has('sslmode'))env.PGSSLMODE=u.searchParams.get('sslmode');
const r=spawnSync('pg_restore',['--exit-on-error','--single-transaction','--no-owner','--no-acl','--dbname',env.PGDATABASE,process.argv[2]],{env,stdio:'inherit'});
process.exit(r.status??1);
NODE
printf '%s\n' 'Database restored. Verify all private file hashes and application flows using the recovery runbook before declaring success.'
