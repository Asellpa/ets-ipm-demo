#!/bin/sh
# Run on a trusted backup worker with PostgreSQL client and restic installed.
set -eu
umask 077
: "${DATABASE_URL_FILE:?Path to protected database URL file required}"
: "${ETS_FILE_DIR:?Private file directory required}"
: "${RESTIC_REPOSITORY:?Separate protected backup repository required}"
: "${RESTIC_PASSWORD_FILE:?Protected restic password file required}"
DATABASE_URL=$(cat "$DATABASE_URL_FILE")
export DATABASE_URL
backup_tmp=$(mktemp -d)
trap 'rm -rf "$backup_tmp"' EXIT HUP INT TERM
# URL is passed via libpq environment, never as a command-line argument.
export PGDATABASE="$DATABASE_URL"
pg_dump --format=custom --file="$backup_tmp/database.dump"
# Immutable file blobs are never automatically removed. A completed DB dump's referenced
# blobs therefore remain available while restic copies the file directory.
restic backup --tag ets-ipm "$backup_tmp/database.dump" "$ETS_FILE_DIR" --json
printf '%s\n' '{"event":"backup_complete"}'
# Retention/pruning is deliberately a separate reviewed operator action.
