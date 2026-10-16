#!/usr/bin/env bash
# Applies the stub + migrations to a throwaway database and runs the SQL tests.
# Usage: PGHOST=… PGPORT=… PGUSER=postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${TEST_DB:-object_test}
psql -qX -d postgres -c "drop database if exists $DB" -c "create database $DB" >/dev/null
P="psql -qX -v ON_ERROR_STOP=1 -d $DB"
$P -f supabase/tests/00_supabase_stub.sql >/dev/null
for m in supabase/migrations/*.sql; do $P -f "$m" >/dev/null; done
for t in supabase/tests/[1-9]*.sql; do
  echo "› $t"
  $P -f "$t" 2>&1 | grep -E "ok -|FAILED|ERROR|PASSED" | sed 's/^psql:[^:]*:[0-9]*: //; s/^NOTICE:  /  /'
done
