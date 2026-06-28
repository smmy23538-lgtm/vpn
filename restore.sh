#!/usr/bin/env bash
# =============================================================================
#  VPN Platform — Database Restore
#  Usage: ./restore.sh <backup-file.sql.gz> [--yes]
#  --yes skips the confirmation prompt (for scripted use)
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "  ${BLUE}▸${NC} $*"; }
ok()      { echo -e "  ${GREEN}✔${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "\n  ${RED}✖ FATAL:${NC} $*\n" >&2; exit 1; }

[[ -f "docker-compose.platform.yml" ]] || die "Run from the vpn-platform project root."
[[ "${1:-}" ]] || die "Usage: ./restore.sh <backup-file.sql.gz> [--yes]"

BACKUP_FILE="$1"
AUTO_YES=0
for arg in "${@:2}"; do [[ "$arg" == "--yes" ]] && AUTO_YES=1; done

[[ -f "$BACKUP_FILE" ]] || die "Backup file not found: $BACKUP_FILE"
[[ "$BACKUP_FILE" == *.gz ]] || die "Expected a .gz file. Got: $BACKUP_FILE"

if [[ $EUID -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
D="$SUDO docker"
DC="$SUDO docker compose -f docker-compose.platform.yml"

BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)

echo -e "\n${BOLD}${CYAN}  VPN Platform — Database Restore${NC}"
echo -e "  ${DIM}$(date '+%Y-%m-%d %H:%M:%S')${NC}\n"

echo -e "  ${BOLD}Backup file:${NC}  $BACKUP_FILE"
echo -e "  ${BOLD}Size:${NC}         $BACKUP_SIZE"
echo ""
echo -e "  ${RED}${BOLD}WARNING: This will DESTROY all current data and replace it with the backup.${NC}"
echo -e "  ${RED}This operation cannot be undone.${NC}"
echo ""

if [[ $AUTO_YES -eq 0 ]]; then
  read -r -p "  Type 'yes' to confirm: " CONFIRM
  [[ "$CONFIRM" == "yes" ]] || { echo -e "  ${DIM}Aborted.${NC}"; exit 0; }
else
  warn "Auto-confirmed via --yes flag."
fi

# Check postgres is running; start it if not
if ! $D ps --filter "name=vpn-postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
  info "Starting PostgreSQL..."
  $DC up -d postgres
  info "Waiting for PostgreSQL..."
  ATTEMPTS=0
  until $D exec vpn-postgres pg_isready -U vpnuser -d vpnplatform -q 2>/dev/null; do
    ATTEMPTS=$((ATTEMPTS+1))
    [[ $ATTEMPTS -gt 30 ]] && die "PostgreSQL did not start in time."
    sleep 2
  done
fi

# Stop backend to prevent connections during restore
info "Stopping backend (prevents active connections during restore)..."
$DC stop backend 2>/dev/null || true
ok "Backend stopped"

# Drop and recreate the database
info "Dropping existing database..."
$D exec -i vpn-postgres psql -U vpnuser -d postgres -q -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='vpnplatform' AND pid <> pg_backend_pid();" \
  >/dev/null 2>&1 || true
$D exec -i vpn-postgres psql -U vpnuser -d postgres -q -c \
  "DROP DATABASE IF EXISTS vpnplatform;" >/dev/null
$D exec -i vpn-postgres psql -U vpnuser -d postgres -q -c \
  "CREATE DATABASE vpnplatform;" >/dev/null
ok "Fresh database created"

# Restore
info "Restoring backup (this may take a moment)..."
gunzip -c "$BACKUP_FILE" | $D exec -i vpn-postgres psql -U vpnuser -d vpnplatform -q
ok "Restore complete"

# Restart backend
info "Restarting backend..."
$DC up -d backend

# Wait for health
echo -ne "  ${BLUE}▸${NC} Waiting for backend"
ATTEMPTS=0
until curl -sf http://localhost:3001/api/health >/dev/null 2>&1; do
  ATTEMPTS=$((ATTEMPTS+1))
  [[ $ATTEMPTS -gt 60 ]] && { echo ""; die "Backend did not come up after restore. Run: $D logs vpn-backend"; }
  echo -n "."; sleep 2
done
echo -e " ${GREEN}✔${NC}"

echo ""
ok "Restore successful — platform is back online."
echo ""
