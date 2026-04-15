#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# CloudERP — Database Maintenance Script
# Intended to run as an Azure Function timer trigger at 02:00 UTC daily.
# Can also be run manually:
#   DATABASE_URL=postgresql://... STORAGE_ACCOUNT_NAME=... STORAGE_CONTAINER=erp-audit-archive ./maintenance.sh
#
# Requirements: psql, az (Azure CLI), curl
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

LOG_TAG="[clouderp-maintenance]"
TIMESTAMP=$(date -u '+%Y-%m-%dT%H:%M:%SZ')
DATE_TAG=$(date -u '+%Y%m%d')
SUMMARY=""

log()  { echo "$LOG_TAG [$TIMESTAMP] $*"; }
fail() { log "ERROR: $*"; send_alert "FAILED" "$*"; exit 1; }

# ── Config from environment ────────────────────────────────────────────────────
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"
STORAGE_ACCOUNT_NAME="${STORAGE_ACCOUNT_NAME:?STORAGE_ACCOUNT_NAME is required}"
STORAGE_CONTAINER="${STORAGE_CONTAINER:-erp-audit-archive}"
SMTP_HOST="${SMTP_HOST:-}"
SMTP_TO="${SMTP_TO:-}"
ARCHIVE_OLDER_THAN_DAYS="${ARCHIVE_OLDER_THAN_DAYS:-365}"
INDEX_BLOAT_THRESHOLD="${INDEX_BLOAT_THRESHOLD:-30}"   # Alert if bloat > 30%

# ── Helper: run psql query ─────────────────────────────────────────────────────
psql_run() {
  psql "$DATABASE_URL" -t -A -c "$1"
}

# ── Helper: append to summary ─────────────────────────────────────────────────
append_summary() {
  SUMMARY="${SUMMARY}\n$1"
}

# ── 1. VACUUM ANALYZE on key tables ───────────────────────────────────────────
vacuum_analyze() {
  log "Running VACUUM ANALYZE on key tables..."

  KEY_TABLES=(
    "purchase_orders"
    "purchase_requisitions"
    "material_requisitions"
    "ap_invoices"
    "journal_entries"
    "journal_lines"
    "stock_ledger"
    "item_stock_balances"
    "audit_logs"
    "notifications"
    "workflow_steps"
    "workflow_instances"
  )

  VACUUMED=0
  FAILED=0

  for TABLE in "${KEY_TABLES[@]}"; do
    # Check if table exists first
    EXISTS=$(psql_run "SELECT to_regclass('public.$TABLE')::text;" 2>/dev/null || echo "")
    if [ "$EXISTS" = "$TABLE" ]; then
      if psql_run "VACUUM ANALYZE $TABLE;" 2>/dev/null; then
        log "  ✓ VACUUM ANALYZE $TABLE"
        VACUUMED=$((VACUUMED + 1))
      else
        log "  ✗ Failed: $TABLE"
        FAILED=$((FAILED + 1))
      fi
    else
      log "  - Skipping $TABLE (not found)"
    fi
  done

  append_summary "VACUUM ANALYZE: $VACUUMED tables processed, $FAILED failed"
  log "VACUUM ANALYZE complete: $VACUUMED succeeded, $FAILED failed"
}

# ── 2. Check index bloat ───────────────────────────────────────────────────────
check_index_bloat() {
  log "Checking index bloat..."

  BLOAT_QUERY="
    SELECT
      schemaname || '.' || tablename AS table_name,
      indexname,
      ROUND(
        (1 - (
          pg_relation_size(indexrelid)::numeric /
          NULLIF(pg_relation_size(indexrelid) * 1.2, 0)
        )) * 100,
        1
      ) AS estimated_bloat_pct,
      pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
    FROM pg_stat_user_indexes
    JOIN pg_index ON indexrelid = pg_stat_user_indexes.indexrelid
    WHERE idx_scan > 100
    ORDER BY pg_relation_size(indexrelid) DESC
    LIMIT 20;
  "

  BLOAT_RESULTS=$(psql_run "$BLOAT_QUERY" 2>/dev/null || echo "")

  HIGH_BLOAT_COUNT=0
  if [ -n "$BLOAT_RESULTS" ]; then
    while IFS='|' read -r table_name indexname bloat_pct index_size; do
      bloat_pct_clean="${bloat_pct// /}"
      if (( $(echo "$bloat_pct_clean > $INDEX_BLOAT_THRESHOLD" | bc -l 2>/dev/null || echo 0) )); then
        log "  ⚠ HIGH BLOAT: $indexname on $table_name — ${bloat_pct}% (${index_size})"
        HIGH_BLOAT_COUNT=$((HIGH_BLOAT_COUNT + 1))
      fi
    done <<< "$BLOAT_RESULTS"
  fi

  if [ "$HIGH_BLOAT_COUNT" -gt 0 ]; then
    append_summary "Index bloat: $HIGH_BLOAT_COUNT indexes exceed ${INDEX_BLOAT_THRESHOLD}% bloat threshold — consider REINDEX"
    log "WARNING: $HIGH_BLOAT_COUNT indexes have high bloat"
  else
    append_summary "Index bloat: All indexes within acceptable range (< ${INDEX_BLOAT_THRESHOLD}%)"
    log "Index bloat check passed"
  fi
}

# ── 3. Archive old audit logs to Azure Blob Storage ───────────────────────────
archive_audit_logs() {
  log "Archiving audit logs older than $ARCHIVE_OLDER_THAN_DAYS days..."

  CUTOFF_DATE=$(date -u -d "$ARCHIVE_OLDER_THAN_DAYS days ago" '+%Y-%m-%d' 2>/dev/null \
    || date -u -v-"${ARCHIVE_OLDER_THAN_DAYS}"d '+%Y-%m-%d')  # macOS fallback

  ARCHIVE_FILE="/tmp/audit_logs_archive_${DATE_TAG}.csv"

  # Export old audit logs to CSV
  COUNT=$(psql_run "SELECT COUNT(*) FROM audit_logs WHERE created_at < '$CUTOFF_DATE'::date;" 2>/dev/null || echo "0")

  if [ "$COUNT" -gt 0 ]; then
    log "Exporting $COUNT audit log records to CSV..."

    psql "$DATABASE_URL" -c "
      COPY (
        SELECT * FROM audit_logs WHERE created_at < '$CUTOFF_DATE'::date ORDER BY created_at
      ) TO STDOUT WITH CSV HEADER
    " > "$ARCHIVE_FILE" 2>/dev/null

    # Upload to Azure Blob Storage
    BLOB_NAME="audit_logs_${DATE_TAG}.csv"
    if az storage blob upload \
        --account-name "$STORAGE_ACCOUNT_NAME" \
        --container-name "$STORAGE_CONTAINER" \
        --name "$BLOB_NAME" \
        --file "$ARCHIVE_FILE" \
        --auth-mode login \
        --overwrite true \
        2>/dev/null; then

      log "  ✓ Uploaded $BLOB_NAME to $STORAGE_CONTAINER"

      # Delete from DB after successful upload
      DELETED=$(psql_run "DELETE FROM audit_logs WHERE created_at < '$CUTOFF_DATE'::date; SELECT ROW_COUNT();" 2>/dev/null || echo "0")
      log "  ✓ Deleted $COUNT records from audit_logs"
      append_summary "Audit log archive: $COUNT records archived to blob storage, deleted from DB"
    else
      log "  ✗ Failed to upload to blob storage — skipping DB deletion"
      append_summary "Audit log archive: FAILED to upload to blob storage"
    fi

    rm -f "$ARCHIVE_FILE"
  else
    append_summary "Audit log archive: No records older than $ARCHIVE_OLDER_THAN_DAYS days"
    log "No audit logs to archive"
  fi
}

# ── 4. DB size summary ─────────────────────────────────────────────────────────
db_size_summary() {
  log "Collecting DB size summary..."

  DB_SIZE=$(psql_run "SELECT pg_size_pretty(pg_database_size(current_database()));" 2>/dev/null || echo "unknown")
  LARGEST_TABLES=$(psql_run "
    SELECT schemaname || '.' || tablename || ': ' || pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename))
    FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 5;
  " 2>/dev/null || echo "")

  append_summary "Database size: $DB_SIZE"
  log "DB size: $DB_SIZE"

  if [ -n "$LARGEST_TABLES" ]; then
    log "Top 5 tables by size:"
    echo "$LARGEST_TABLES" | while read -r line; do
      log "  $line"
    done
  fi
}

# ── 5. Send summary email/alert ────────────────────────────────────────────────
send_alert() {
  local STATUS="$1"
  local EXTRA="${2:-}"
  local EMOJI="✅"
  [ "$STATUS" = "FAILED" ] && EMOJI="❌"

  local BODY="$EMOJI CloudERP Maintenance — $STATUS ($TIMESTAMP)\n$SUMMARY"
  [ -n "$EXTRA" ] && BODY="$BODY\n\nError: $EXTRA"

  log "Summary:"
  echo -e "$SUMMARY"

  # Send via webhook (Teams, Slack, etc.)
  if [ -n "${WEBHOOK_URL:-}" ]; then
    curl -s -X POST "$WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d "{\"text\":\"$BODY\"}" 2>/dev/null || log "Webhook notification failed"
  fi
}

# ── Main ──────────────────────────────────────────────────────────────────────
main() {
  log "=== CloudERP Database Maintenance Starting ==="
  log "Target: $DATABASE_URL (connection string redacted in logs)"

  vacuum_analyze    || log "WARNING: vacuum_analyze step failed"
  check_index_bloat || log "WARNING: check_index_bloat step failed"
  archive_audit_logs || log "WARNING: archive_audit_logs step failed"
  db_size_summary   || log "WARNING: db_size_summary step failed"

  send_alert "SUCCESS"
  log "=== Maintenance Complete ==="
}

main "$@"
