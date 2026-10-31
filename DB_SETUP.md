# Local Database Setup — SST Hostel Leave

This replaces the previous workflow where local development pointed directly at production AWS RDS.
Now local development uses Docker PostgreSQL, and production stays isolated on AWS.

---

## Architecture

```
main      → production → AWS PROD RDS
develop   → development → AWS DEV RDS (when created)
feature/* → local Docker DB (localhost:5432)
```

Never let a feature branch inherit the production `DATABASE_URL`.

---

## 1. Start Docker PostgreSQL

```bash
# Start the container
docker compose up -d

# Verify it's healthy
docker compose ps

# Stop when done
docker compose down

# Stop and delete all data (fresh start next time)
docker compose down -v
```

The container exposes `localhost:5432` with:
- User: `postgres`
- Password: `postgres`
- Database: `leave_management`

Connection string:
```
postgresql://postgres:postgres@localhost:5432/leave_management
```

---

## 2. Environment Variables

`.env.local` (gitignored, local only) now points to the local Docker DB:

```env
DATABASE_URL='postgresql://postgres:postgres@localhost:5432/leave_management'
```

The production AWS RDS URL is kept as a commented reference at the bottom of `.env.local` — never uncomment it for local feature work.

---

## 3. Initialize the Database (first time only)

```bash
# Apply all Drizzle migrations
pnpm db:migrate

# Seed with reference data (roles, hostels, leave types, users, etc.)
pnpm db:seed
```

### What `db:migrate` does
- Reads `DATABASE_URL` from `.env.local` (development) or `.env.production` (when `NODE_ENV=production`)
- Applies all SQL files in `src/db/drizzle/` in order
- Records applied migrations in `__drizzle_migration` table

### What `db:seed` does
- Clears all data from every table
- Seeds reference data: roles, movement states, departments, hostels, academic groups, workflows, leave types, users, students, notification templates, notification rules

### What `db:reset` does
- Drops the `public` schema and recreates it
- Applies all migrations from scratch
- Seeds reference data

Use `db:reset` when you want a completely clean local database.

---

## 4. Making Schema Changes

Drizzle migrations are the **source of truth**. Never edit the production database directly.

```bash
# 1. Edit the schema in src/db/schema/*.ts

# 2. Generate a new migration
pnpm db:generate

# 3. Review the generated SQL in src/db/drizzle/

# 4. Test against your LOCAL Docker DB first
pnpm db:migrate

# 5. Run your tests / verify the app works locally

# 6. Commit the migration + schema changes

# 7. Deploy to DEV (AWS DEV RDS) first, then PROD
```

**Important:** Always test migrations on DEV before applying to PROD. Never experiment directly on production.

---

## 5. Useful Commands

```bash
# Check DB connection and row counts
pnpm tsx scripts/check-db.ts

# Reset local DB to clean state + seed
pnpm db:reset

# View container logs
docker compose logs -f postgres

# Connect to the DB directly (psql)
docker compose exec postgres psql -U postgres -d leave_management
```

---

## 6. Branch → Environment Mapping

| Branch        | Target Environment | DATABASE_URL                    |
|---------------|-------------------|---------------------------------|
| `main`        | Production        | AWS PROD RDS (`.env.production`) |
| `develop`     | Development       | AWS DEV RDS (`.env.staging`)     |
| `feature/*`   | Local Docker      | `localhost:5432` (`.env.local`)  |

When starting a feature branch, make sure `.env.local` points to `localhost:5432`, **not** to AWS PROD.

---

## 7. Troubleshooting

**Connection refused on localhost:5432**
- Docker Desktop isn't running: start Docker Desktop, then `docker compose up -d`
- Container exited: `docker compose logs hostel-postgres-dev`

**Container exits at once with "these Docker images are configured to store database data…"**
- Postgres 18+ stores data in a versioned subdirectory and refuses to start when a
  volume is mounted at `/var/lib/postgresql/data`. `docker-compose.yml` mounts the
  parent (`/var/lib/postgresql`) instead — keep that line if you recreate the file.

**Seed logs `Leave type code not found in DB {"leaveTypeCode":"GENERAL_LEAVE"}`**
- Harmless: the notification-rule seed still declares rules for a `GENERAL_LEAVE`
  leave type that no longer exists, so that group is skipped. All eight current
  leave types are seeded with rules.

**Migration fails**
- Check that the container is healthy: `docker compose ps`
- Verify `DATABASE_URL` in `.env.local` matches the container credentials
- Make sure no other process is using port 5432

**Permission denied / SSL errors**
- Local Docker Postgres doesn't use SSL — the connection string has no `sslmode=require`
- If you see SSL errors, ensure `.env.local` doesn't have `?sslmode=require` appended

---

## 8. Production Data Snapshot (debugging production-like data)

You can copy a snapshot of live production data into your local Docker DB for debugging.
**Never change `.env.local` back to the AWS production URL just to get live data.**

### Two local modes

| Mode | Command | What you get |
|------|---------|--------------|
| Local Empty | `pnpm db:reset` | Clean DB + migrations + seed data |
| Local Prod Snapshot | `pnpm db:dump-prod` → `pnpm db:restore-prod` | Real production data in Docker |

### Step 1: Dump from production

```bash
# Dump to a timestamped file
pnpm db:dump-prod

# Or specify a filename
pnpm db:dump-prod prod-snapshot-2026-10-30.dump
```

This reads `DATABASE_URL` from `.env.production` (AWS RDS).

**⚠️ PgBouncer warning:** Your production connection goes through PgBouncer on port `6432`.
`pg_dump` works best against the **direct PostgreSQL endpoint** (port `5432`).
If the dump fails, find the direct RDS endpoint in the AWS Console
(RDS > Databases > your instance > Endpoint) and update `.env.production` to use
`host:5432` before running `db:dump-prod` again.

Dump files are gitignored (`*.dump`, `*.backup`, `prod-*.sql`) — never commit them.

**No Postgres client install needed:** if `pg_dump` is not on your PATH (common on
Windows), the dump runs inside the `postgres:18` Docker image instead, and its output
is written straight to the dump file. Same for `pg_restore`/`psql` during a restore —
they run inside the running container. Nothing extra to install.

### Step 2: Restore into local Docker

```bash
pnpm db:restore-prod prod-snapshot-2026-10-30.dump

# Skip the interactive confirmation (scripted/CI use)
pnpm db:restore-prod prod-snapshot-2026-10-30.dump --yes
```

The script refuses to run if `DATABASE_URL` is not `localhost`/`127.0.0.1`, and asks
for Enter before dropping anything (without a terminal it stops unless `--yes` is
passed).

This will:
1. Drop and recreate the `public` schema in your local Docker DB
2. `pg_restore` the dump into `localhost:5432`
3. Run Drizzle migrations to bring the schema up to date

Your app keeps using:
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/leave_management
```

but now that database contains a snapshot of production data.

### Anonymization (optional)

Production data contains real student/parent details, phone numbers, emails,
and leave records. If you share your local DB or machine with others, consider
anonymizing sensitive columns after restoring:

```sql
-- Example: anonymize parent phone/email
UPDATE parents SET phone = 'REDACTED', email = 'redacted@example.com';
UPDATE users SET phone = 'REDACTED', email = 'redacted@example.com';
```

---

## 9. Useful Commands (complete list)

```bash
# Docker
docker compose up -d              # start local PostgreSQL
docker compose down               # stop container
docker compose down -v            # stop + delete all data

# Database lifecycle
pnpm db:migrate                   # apply migrations (uses .env.local by default)
pnpm db:seed                      # clear + seed reference data
pnpm db:reset                     # drop schema + migrate + seed

# Production snapshot
pnpm db:dump-prod                 # dump AWS prod to a .dump file
pnpm db:restore-prod <file.dump>  # restore dump into local Docker
pnpm db:restore-prod <file.dump> --yes   # same, no confirmation prompt

# Diagnostics
pnpm tsx scripts/check-db.ts      # check connection + row counts

# App
pnpm dev                          # start Next.js (uses localhost:5432)
```

---

## 10. Branch → Environment Mapping

| Branch        | Target Environment | DATABASE_URL                    |
|---------------|-------------------|---------------------------------|
| `main`        | Production        | AWS PROD RDS (`.env.production`) |
| `develop`     | Development       | AWS DEV RDS (`.env.staging`)     |
| `feature/*`   | Local Docker      | `localhost:5432` (`.env.local`)  |

When starting a feature branch, make sure `.env.local` points to `localhost:5432`, **not** to AWS PROD.
