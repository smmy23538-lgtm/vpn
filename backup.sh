#!/usr/bin/env bash
# =============================================================================
#  VPN Platform — Database Backup
#  Usage: ./backup.sh [output-directory]
#  Output dir defaults to ./backups
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
if [[ $EUID -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
D="$SUDO docker"

OUT_DIR="${1:-./backups}"
mkdir -p "$OUT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="${OUT_DIR}/vpn-backup-${TIMESTAMP}.sql.gz"

echo -e "\n${BOLD}${CYAN}  VPN Platform — Database Backup${NC}"
echo -e "  ${DIM}$(date '+%Y-%m-%d %H:%M:%S')${NC}\n"

# Check postgres is running
if ! $D ps --filter "name=vpn-postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
  die "PostgreSQL container (vpn-postgres) is not running. Start it with: sudo docker compose -f docker-compose.platform.yml up -d postgres"
fi

info "Dumping database..."
$D exec vpn-postgres pg_dump -U vpnuser --no-password vpnplatform \
  | gzip > "$BACKUP_FILE"

# Verify the file is non-empty
BACKUP_SIZE=$(du -sh "$BACKUP_FILE" | cut -f1)
[[ -s "$BACKUP_FILE" ]] || die "Backup file is empty — something went wrong."

ok "Backup complete"
echo ""
echo -e "  ${BOLD}File:${NC}  $BACKUP_FILE"
echo -e "  ${BOLD}Size:${NC}  $BACKUP_SIZE"
echo ""

# Show recent backups
echo -e "  ${DIM}Recent backups in $OUT_DIR:${NC}"
ls -1t "${OUT_DIR}"/vpn-backup-*.sql.gz 2>/dev/null | head -5 | while read -r f; do
  SIZE=$(du -sh "$f" | cut -f1)
  echo -e "  ${DIM}  ├─ $(basename "$f")  ($SIZE)${NC}"
done
echo ""

# Warn if backups are accumulating (>10 files)
BACKUP_COUNT=$(ls "${OUT_DIR}"/vpn-backup-*.sql.gz 2>/dev/null | wc -l)
if [[ $BACKUP_COUNT -gt 10 ]]; then
  warn "$BACKUP_COUNT backups found. Consider setting up automatic rotation:"
  warn "  find ${OUT_DIR} -name 'vpn-backup-*.sql.gz' -mtime +7 -delete"
fi

echo -e "  ${DIM}To restore: ./restore.sh $BACKUP_FILE${NC}"
echo ""
