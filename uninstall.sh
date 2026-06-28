#!/usr/bin/env bash
# =============================================================================
#  VPN Platform — Uninstall
#  Stops and removes all platform containers, images, and optionally data.
#  Does NOT touch wg-easy or the WireGuard installation.
#  Usage: ./uninstall.sh [--keep-data] [--yes]
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "  ${BLUE}▸${NC} $*"; }
ok()      { echo -e "  ${GREEN}✔${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "\n  ${RED}✖ FATAL:${NC} $*\n" >&2; exit 1; }

COMPOSE_FILE="docker-compose.platform.yml"
COMPOSE_SSL="docker-compose.ssl.yml"
[[ -f "$COMPOSE_FILE" ]] || die "Run from the vpn-platform project root."
if [[ $EUID -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
D="$SUDO docker"
if [[ -f "$COMPOSE_SSL" ]]; then
  DC="$SUDO docker compose -f $COMPOSE_FILE -f $COMPOSE_SSL"
else
  DC="$SUDO docker compose -f $COMPOSE_FILE"
fi

KEEP_DATA=0
AUTO_YES=0
for arg in "$@"; do
  [[ "$arg" == "--keep-data" ]] && KEEP_DATA=1
  [[ "$arg" == "--yes" ]]       && AUTO_YES=1
done

echo -e "\n${BOLD}${CYAN}  VPN Platform — Uninstall${NC}"
echo -e "  ${DIM}$(date '+%Y-%m-%d %H:%M:%S')${NC}\n"

echo -e "  ${RED}${BOLD}This will remove:${NC}"
echo -e "  ${RED}  • All VPN platform containers (backend, frontend, postgres, migrate)${NC}"
echo -e "  ${RED}  • All VPN platform Docker images${NC}"
if [[ $KEEP_DATA -eq 0 ]]; then
echo -e "  ${RED}  • All database data (Docker volume: postgres_data)${NC}"
echo -e "  ${RED}  • .env file and .admin-credentials file${NC}"
else
echo -e "  ${DIM}  • Database volume will be KEPT (--keep-data flag)${NC}"
fi
echo ""
echo -e "  ${DIM}wg-easy and WireGuard will NOT be affected.${NC}"
echo ""

if [[ $AUTO_YES -eq 0 ]]; then
  read -r -p "  Type 'uninstall' to confirm: " CONFIRM
  [[ "$CONFIRM" == "uninstall" ]] || { echo -e "  ${DIM}Aborted.${NC}"; exit 0; }
else
  warn "Auto-confirmed via --yes flag."
fi
echo ""

# Backup before destroying (offer it silently)
if [[ $KEEP_DATA -eq 0 ]] && $D ps --filter "name=vpn-postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
  BACKUP_DIR="./backups"
  mkdir -p "$BACKUP_DIR"
  BACKUP_FILE="${BACKUP_DIR}/uninstall-$(date +%Y%m%d-%H%M%S).sql.gz"
  info "Creating final database backup before removal..."
  $D exec vpn-postgres pg_dump -U vpnuser vpnplatform 2>/dev/null \
    | gzip > "$BACKUP_FILE" && ok "Final backup saved: $BACKUP_FILE" \
    || warn "Backup failed — proceeding with uninstall anyway."
fi

# Stop and remove containers
info "Stopping containers..."
$DC down 2>/dev/null || true
ok "Containers stopped"

# Remove data volume
if [[ $KEEP_DATA -eq 0 ]]; then
  info "Removing database volume..."
  # Volume name is prefixed by the compose project name
  PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
  $D volume rm "${PROJECT_NAME}_postgres_data" 2>/dev/null \
    || $D volume rm "vpn-platform_postgres_data" 2>/dev/null \
    || $D volume rm "vpnplatform_postgres_data" 2>/dev/null \
    || warn "Could not remove volume automatically. Remove manually: $D volume ls | grep postgres_data"
  ok "Database volume removed"
fi

# Remove built images
info "Removing platform Docker images..."
for img in vpn-platform-backend vpn-platform-frontend vpn-backend vpn-frontend; do
  $D rmi "$img" 2>/dev/null && ok "Removed image: $img" || true
done
# Also try compose-style image names
PROJECT_NAME=$(basename "$(pwd)" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]//g')
$D rmi "${PROJECT_NAME}-backend" "${PROJECT_NAME}-frontend" 2>/dev/null || true

# Remove config files
if [[ $KEEP_DATA -eq 0 ]]; then
  info "Removing .env and credentials..."
  rm -f .env .admin-credentials
  ok ".env removed"
fi

# Remove SSL nginx config if present
if [[ -f "$COMPOSE_SSL" ]] && [[ $KEEP_DATA -eq 0 ]]; then
  info "Removing nginx SSL config..."
  $SUDO rm -f /etc/nginx/sites-enabled/vpn-platform \
               /etc/nginx/sites-available/vpn-platform 2>/dev/null || true
  $SUDO systemctl reload nginx 2>/dev/null || true
  rm -f "$COMPOSE_SSL"
  ok "Nginx site config removed"
fi

# Remove dangling images
info "Cleaning up dangling images..."
$D image prune -f >/dev/null 2>&1 || true
ok "Cleanup done"

echo ""
ok "VPN Platform has been uninstalled."
if [[ $KEEP_DATA -eq 0 ]] && [[ -f "${BACKUP_DIR:-./backups}/uninstall-"*".sql.gz" ]] 2>/dev/null; then
  echo -e "  ${DIM}Your data was backed up to: $BACKUP_DIR${NC}"
fi
echo -e "  ${DIM}wg-easy and WireGuard are untouched.${NC}"
echo ""
echo -e "  To reinstall: clone the repo again and run ./deploy.sh"
echo ""
