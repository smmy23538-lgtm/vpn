#!/usr/bin/env bash
# =============================================================================
#  VPN Platform — Update from GitHub
#  Usage: ./update.sh [--no-pull]
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "  ${BLUE}▸${NC} $*"; }
ok()      { echo -e "  ${GREEN}✔${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "\n  ${RED}✖ FATAL:${NC} $*\n" >&2; exit 1; }
divider() { echo -e "\n${BOLD}${CYAN}── $1 ──────────────────────────────────────────────────────────${NC}"; }

COMPOSE_FILE="docker-compose.platform.yml"
COMPOSE_SSL="docker-compose.ssl.yml"
[[ -f "$COMPOSE_FILE" ]] || die "Run from the vpn-platform project root."
[[ -f ".env" ]]          || die ".env not found. Run ./deploy.sh first."

if [[ $EUID -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi
D="$SUDO docker"
if [[ -f "$COMPOSE_SSL" ]]; then
  DC="$SUDO docker compose -f $COMPOSE_FILE -f $COMPOSE_SSL"
else
  DC="$SUDO docker compose -f $COMPOSE_FILE"
fi

echo -e "\n${BOLD}${CYAN}  VPN Platform — Update${NC}"
echo -e "  ${DIM}$(date '+%Y-%m-%d %H:%M:%S')${NC}\n"

# =============================================================================
divider "Backing up database before update"
# =============================================================================

BACKUP_DIR="./backups"
mkdir -p "$BACKUP_DIR"
BACKUP_FILE="${BACKUP_DIR}/pre-update-$(date +%Y%m%d-%H%M%S).sql.gz"

if $D ps --filter "name=vpn-postgres" --format "{{.Status}}" 2>/dev/null | grep -q "Up"; then
  info "Creating pre-update database backup..."
  $D exec vpn-postgres pg_dump -U vpnuser vpnplatform \
    | gzip > "$BACKUP_FILE"
  ok "Backup saved: $BACKUP_FILE"
else
  warn "PostgreSQL not running — skipping pre-update backup."
fi

# =============================================================================
divider "Pulling latest code"
# =============================================================================

NO_PULL=0
for arg in "$@"; do [[ "$arg" == "--no-pull" ]] && NO_PULL=1; done

if [[ $NO_PULL -eq 0 ]]; then
  if [[ -d ".git" ]]; then
    info "Fetching updates from GitHub..."
    BEFORE=$(git rev-parse HEAD 2>/dev/null || echo "")
    git pull origin main
    AFTER=$(git rev-parse HEAD 2>/dev/null || echo "")
    if [[ "$BEFORE" == "$AFTER" ]]; then
      ok "Already up to date ($(git rev-parse --short HEAD))"
    else
      ok "Updated: $(git rev-parse --short "$BEFORE") → $(git rev-parse --short "$AFTER")"
      info "Changed files:"
      git diff --name-only "$BEFORE" "$AFTER" 2>/dev/null | sed 's/^/    /' || true
    fi
  else
    warn "Not a git repository — skipping git pull. Use --no-pull to suppress this warning."
  fi
else
  info "--no-pull specified, skipping git pull."
fi

# =============================================================================
divider "Running database migrations"
# =============================================================================

info "Running migrations (safe to re-run — uses IF NOT EXISTS)..."
$DC up migrate --build 2>&1 | while IFS= read -r line; do
  if [[ "$line" =~ (migration|Migration|error|Error|exited|done) ]]; then
    echo -e "    ${DIM}${line}${NC}"
  fi
done

EXIT_CODE=$($D inspect vpn-migrate --format='{{.State.ExitCode}}' 2>/dev/null || echo "0")
[[ "$EXIT_CODE" == "0" ]] || die "Migration failed (exit code $EXIT_CODE). Run: $D logs vpn-migrate"
ok "Migrations complete"

# =============================================================================
divider "Rebuilding and restarting services"
# =============================================================================

info "Building updated images..."
$DC build 2>&1
ok "Images built"

info "Restarting services..."
$DC up -d backend frontend

# =============================================================================
divider "Health verification"
# =============================================================================

wait_for_url() {
  local url="$1" label="$2" max=60 i=0
  echo -ne "  ${BLUE}▸${NC} Waiting for $label"
  while [[ $i -lt $max ]]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo -e " ${GREEN}✔${NC}"; return 0
    fi
    echo -n "."; sleep 2; i=$((i+1))
  done
  echo ""; return 1
}

if ! wait_for_url "http://localhost:3001/api/health" "Backend API"; then
  echo ""
  warn "Backend did not respond. Rolling back using backup..."
  ./restore.sh "$BACKUP_FILE" --yes || true
  die "Update failed — rolled back to pre-update state."
fi

if ! wait_for_url "http://localhost:80" "Frontend"; then
  die "Frontend did not come up. Run: $D logs vpn-frontend"
fi

echo ""
ok "Update complete! Running version: $(git rev-parse --short HEAD 2>/dev/null || echo 'unknown')"
echo -e "  ${DIM}Pre-update backup kept at: $BACKUP_FILE${NC}"
echo ""
