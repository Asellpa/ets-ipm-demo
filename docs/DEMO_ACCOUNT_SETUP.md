# One-time demo account and register setup

Run from the repository root after pulling `react-migration`.

1. Stop both backend and frontend terminals with Ctrl+C.
2. Run `npm run setup:demo`.
3. Enter and confirm the desired sysadmin password at the hidden terminal prompts.
4. Start the backend with `npm run dev`.
5. In another terminal, open `react` and run `npm run demo`.
6. Sign out of existing sessions and sign in as `sysadmin`, User ID `1309`.

Setup creates a real backend user with a random salt and scrypt password hash. No password is supplied in a command argument, frontend code, seed, or source file. Stephan keeps his existing login and receives the Admin profile. Admin can manage application settings and ordinary users, but cannot assign System Administrator, manage roles, alter System Administrator accounts, or reset seed data.

Setup removes all Projects and Internal register records, child departments/tasks and time entries, workflow instances, project links, comments, escalations, import history and old notifications. It preserves users, workflow templates, configuration, feedback, leave and audit history. A local `data/db.json.backup-<timestamp>` backup is made before writing; backups are ignored by Git. Keep backups private. To recover, stop the backend and replace `data/db.json` with that backup.

A completion marker makes repeated setup runs leave later projects and accounts unchanged. It does not reset the password on subsequent runs. The script stops if the username/ID already exists without that marker, if Stephan is ambiguous, or if the backend is running. `ETS_DATA_DIR` and `PORT` are respected when used.

Pulling code alone does not modify the laptop's database. This local setup step must complete before the forwarded demo reflects the cleaned register and new accounts.

## Administration account capacity

The dedicated sysadmin account has no manhour capacity. Normalisation sets its capacity to zero and keeps it out of resource planning and task/leave assignment. Named administrators who also do engineering work retain their own resource capacity. Pulling this update and restarting is sufficient; do not rerun the one-time setup to apply the resource fix.
