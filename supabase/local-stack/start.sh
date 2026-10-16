#!/usr/bin/env bash
# Local Supabase-compatible stack for development and end-to-end tests:
# PostgreSQL 16 + GoTrue (auth) + PostgREST + Supabase Storage + a tiny gateway.
# A hosted Supabase project replaces all of this; see docs/SUPABASE.md.
#
# Requires: a running Postgres reachable at $PGURL as a superuser, and
#   $BIN/postgrest, $BIN/auth, $BIN/storage-src (built) — see README in this folder.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
root=$(cd "$here/../.." && pwd)
BIN=${BIN:-/tmp/objbin}
DB=${DB:-object_stack}
PGHOSTPORT=${PGHOSTPORT:-127.0.0.1:54329}
SECRET=${JWT_SECRET:-object-local-dev-jwt-secret-at-least-32-chars}
source "$BIN/keys.env"
LOGS=${LOGS:-$BIN/logs}; mkdir -p "$LOGS" "$BIN/storage-data"

psql "postgresql://postgres@$PGHOSTPORT/postgres" -qX -c "drop database if exists $DB with (force)" -c "create database $DB"
P="psql postgresql://postgres@$PGHOSTPORT/$DB -qX -v ON_ERROR_STOP=1"
$P -f "$here/bootstrap.sql"

# Auth (GoTrue) — runs its own migrations into the auth schema.
export GOTRUE_DB_DRIVER=postgres DATABASE_URL="postgres://supabase_auth_admin@$PGHOSTPORT/$DB?search_path=auth" \
  GOTRUE_JWT_SECRET=$SECRET GOTRUE_JWT_EXP=3600 GOTRUE_JWT_AUD=authenticated GOTRUE_JWT_DEFAULT_GROUP_NAME=authenticated \
  GOTRUE_SITE_URL=${SITE_URL:-http://localhost:5173} API_EXTERNAL_URL=http://127.0.0.1:54321/auth/v1 \
  GOTRUE_API_HOST=127.0.0.1 PORT=9999 GOTRUE_DISABLE_SIGNUP=false GOTRUE_EXTERNAL_EMAIL_ENABLED=true \
  GOTRUE_MAILER_AUTOCONFIRM=true GOTRUE_LOG_LEVEL=warn GOTRUE_URI_ALLOW_LIST='http://localhost:*'
(cd "$BIN" && ./auth migrate >"$LOGS/auth-migrate.log" 2>&1)
(cd "$BIN" && nohup ./auth serve >"$LOGS/auth.log" 2>&1 &)
$P -f "$here/after-auth.sql"

# Storage — runs its own migrations into the storage schema.
(cd "$BIN/storage-src" && env -i PATH="$PATH" HOME="$HOME" \
  SERVER_PORT=5000 SERVER_HOST=127.0.0.1 AUTH_JWT_SECRET=$SECRET AUTH_JWT_ALGORITHM=HS256 ANON_KEY=$ANON SERVICE_KEY=$SERVICE \
  DATABASE_URL="postgresql://postgres@$PGHOSTPORT/$DB" DB_INSTALL_ROLES=false DB_ANON_ROLE=anon DB_SERVICE_ROLE=service_role \
  DB_AUTHENTICATED_ROLE=authenticated DB_SUPER_USER=postgres DATABASE_SEARCH_PATH=storage,public TENANT_ID=local REGION=local GLOBAL_S3_BUCKET=local \
  STORAGE_BACKEND=file STORAGE_FILE_BACKEND_PATH="$BIN/storage-data" FILE_SIZE_LIMIT=52428800 \
  UPLOAD_FILE_SIZE_LIMIT=52428800 IMAGE_TRANSFORMATION_ENABLED=false PG_QUEUE_ENABLE=false RATE_LIMITER_ENABLED=false \
  nohup node dist/start/server.js >"$LOGS/storage.log" 2>&1 &)
for i in $(seq 1 60); do
  $P -Atc "select 1 from information_schema.tables where table_schema='storage' and table_name='objects'" | grep -q 1 && break
  sleep 1
done

$P -f "$here/after-storage.sql"

# OBJECT. migrations
for m in "$root"/supabase/migrations/*.sql; do $P -f "$m"; done

# PostgREST
(cd "$BIN" && PGRST_DB_URI="postgres://authenticator@$PGHOSTPORT/$DB" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon \
  PGRST_JWT_SECRET=$SECRET PGRST_SERVER_PORT=3000 PGRST_SERVER_HOST=127.0.0.1 PGRST_LOG_LEVEL=warn \
  nohup ./postgrest >"$LOGS/postgrest.log" 2>&1 &)

(nohup node "$here/gateway.mjs" >"$LOGS/gateway.log" 2>&1 &)
sleep 3
echo "VITE_SUPABASE_URL=http://127.0.0.1:54321"
echo "VITE_SUPABASE_ANON_KEY=$ANON"
