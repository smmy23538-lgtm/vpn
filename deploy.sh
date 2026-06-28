#!/usr/bin/env bash
# =============================================================================
#  VPN Platform — One-Command Deployment
#  Usage: ./deploy.sh
# =============================================================================
set -euo pipefail
IFS=$'\n\t'

# ── Colours ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; DIM='\033[2m'; NC='\033[0m'

info()    { echo -e "  ${BLUE}▸${NC} $*"; }
ok()      { echo -e "  ${GREEN}✔${NC} $*"; }
warn()    { echo -e "  ${YELLOW}⚠${NC}  $*"; }
die()     { echo -e "\n  ${RED}✖ FATAL:${NC} $*\n" >&2; exit 1; }
ask()     { echo -e "\n  ${YELLOW}?${NC} $*"; }
divider() { echo -e "\n${BOLD}${CYAN}── $1 ──────────────────────────────────────────────────────────${NC}"; }

COMPOSE_FILE="docker-compose.platform.yml"
ENV_FILE=".env"

# ── Require we're in the project root ────────────────────────────────────────
[[ -f "$COMPOSE_FILE" ]] || die "Run this script from the vpn-platform project root (where $COMPOSE_FILE is located)."

# ── Detect privilege level ────────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
  # Verify sudo works without password prompt freezing CI
  $SUDO true 2>/dev/null || die "This script needs sudo access. Run as root or a user with passwordless sudo."
fi

# ── Banner ────────────────────────────────────────────────────────────────────
clear
echo -e "${CYAN}"
cat << 'EOF'
  ╔══════════════════════════════════════════════════════╗
  ║           VPN PLATFORM — AUTOMATED DEPLOY           ║
  ╚══════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo -e "  ${DIM}$(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"
echo ""

# =============================================================================
divider "STEP 1/8  System dependencies"
# =============================================================================

install_pkg() {
  local pkg="$1"
  if ! dpkg -s "$pkg" &>/dev/null; then
    info "Installing $pkg..."
    $SUDO apt-get install -y -q "$pkg"
    ok "$pkg installed"
  else
    ok "$pkg already installed"
  fi
}

if ! command -v apt-get &>/dev/null; then
  die "This script requires an Ubuntu / Debian system with apt-get."
fi

info "Updating package lists..."
$SUDO apt-get update -q

for pkg in curl git openssl jq; do
  install_pkg "$pkg"
done

# Docker
if ! command -v docker &>/dev/null; then
  info "Installing Docker..."
  $SUDO apt-get install -y -q ca-certificates gnupg lsb-release
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -q
  $SUDO apt-get install -y -q docker-ce docker-ce-cli containerd.io docker-compose-plugin
  $SUDO systemctl enable --now docker
  # Add current user to docker group for future sessions
  [[ $EUID -ne 0 ]] && $SUDO usermod -aG docker "$USER" || true
  ok "Docker installed"
else
  ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') already installed"
fi

# Ensure docker daemon is running
$SUDO systemctl start docker 2>/dev/null || true

# Docker Compose (v2 plugin)
if ! $SUDO docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  $SUDO apt-get install -y -q docker-compose-plugin
  ok "Docker Compose installed"
else
  ok "Docker Compose $($SUDO docker compose version --short 2>/dev/null || echo '') already installed"
fi

# Shorthand for all docker commands in this script
D="$SUDO docker"
DC="$SUDO docker compose -f $COMPOSE_FILE"

# =============================================================================
divider "STEP 2/8  Configuration"
# =============================================================================

# ── Auto-detect public IP ─────────────────────────────────────────────────────
AUTO_IP=$(curl -sf --connect-timeout 5 https://checkip.amazonaws.com 2>/dev/null \
       || curl -sf --connect-timeout 5 https://ifconfig.me 2>/dev/null \
       || echo "")

if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists. Skipping config generation."
  warn "Delete .env and re-run to reconfigure, or edit it manually."
  # Still source the existing values so we know admin email for the summary
  source <(grep -v '^#' "$ENV_FILE" | grep '=' | sed 's/^/export /' 2>/dev/null) 2>/dev/null || true
  SKIP_ENV=1
else
  SKIP_ENV=0

  echo ""
  echo -e "  ${DIM}Answer the following questions. Press Enter to accept defaults.${NC}"
  echo ""

  # Server host / domain
  ask "Server public IP or domain name? [${AUTO_IP:-your-ip-or-domain}]"
  read -r -p "  → " INPUT_HOST
  SERVER_HOST="${INPUT_HOST:-${AUTO_IP}}"
  [[ -n "$SERVER_HOST" ]] || die "Server host is required."

  # wg-easy password
  ask "wg-easy password (the plaintext password you set for wg-easy):"
  read -r -s -p "  → " WGEASY_PASS
  echo ""
  [[ -n "$WGEASY_PASS" ]] || die "wg-easy password is required."

  # Admin account
  ask "Admin email address:"
  read -r -p "  → " ADMIN_EMAIL
  [[ "$ADMIN_EMAIL" =~ ^[^@]+@[^@]+\.[^@]+$ ]] || die "Invalid email address."

  ask "Admin full name: [Administrator]"
  read -r -p "  → " ADMIN_NAME
  ADMIN_NAME="${ADMIN_NAME:-Administrator}"

  ask "Admin password (min 8 characters):"
  read -r -s -p "  → " ADMIN_PASS
  echo ""
  [[ ${#ADMIN_PASS} -ge 8 ]] || die "Password must be at least 8 characters."

  read -r -s -p "  → Confirm password: " ADMIN_PASS2
  echo ""
  [[ "$ADMIN_PASS" == "$ADMIN_PASS2" ]] || die "Passwords do not match."

  # Detect if host looks like a domain or bare IP
  if [[ "$SERVER_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    CORS_ORIGIN="http://${SERVER_HOST}"
  else
    CORS_ORIGIN="https://${SERVER_HOST}"
  fi

  # Generate secrets
  info "Generating cryptographic secrets..."
  POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  JWT_SECRET=$(openssl rand -hex 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  ok "Secrets generated"

  # Write .env
  info "Writing .env..."
  cat > "$ENV_FILE" << ENVFILE
# ── VPN Platform Environment ─────────────────────────────────────────────────
# Generated by deploy.sh on $(date '+%Y-%m-%d %H:%M:%S')
# DO NOT commit this file to git.

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}

# ── Secrets ───────────────────────────────────────────────────────────────────
JWT_SECRET=${JWT_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}

# ── wg-easy ───────────────────────────────────────────────────────────────────
WGEASY_URL=http://${SERVER_HOST}:51821
WGEASY_PASSWORD=${WGEASY_PASS}

# ── VPN Server ────────────────────────────────────────────────────────────────
VPN_SERVER_HOST=${SERVER_HOST}
VPN_SERVER_PORT=51830
VPN_SERVER_NAME=US East
VPN_SERVER_COUNTRY=United States

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGIN=${CORS_ORIGIN}

# ── Scheduler ─────────────────────────────────────────────────────────────────
EXPIRY_CHECK_CRON=0 0 * * *
EXPIRY_WARNING_DAYS=7

# ── Frontend ──────────────────────────────────────────────────────────────────
VITE_WS_URL=
ENVFILE
  chmod 600 "$ENV_FILE"
  ok ".env written (permissions: 600)"
fi

# Source .env for use later in the script
set -a
source "$ENV_FILE"
set +a

# =============================================================================
divider "STEP 3/8  Building Docker images"
# =============================================================================

info "Building backend and frontend images (this takes 2–5 minutes on first run)..."
$DC build --parallel 2>&1 | while IFS= read -r line; do
  # Only show meaningful output, not the verbose layer cache noise
  if [[ "$line" =~ (Step|RUN|COPY|error|Error|warning|Warning|Successfully) ]]; then
    echo -e "    ${DIM}${line}${NC}"
  fi
done
ok "Images built"

# =============================================================================
divider "STEP 4/8  Database migrations"
# =============================================================================

info "Starting PostgreSQL..."
$DC up -d postgres

info "Waiting for PostgreSQL to be healthy..."
ATTEMPTS=0
until $D exec vpn-postgres pg_isready -U vpnuser -d vpnplatform -q 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  [[ $ATTEMPTS -gt 30 ]] && die "PostgreSQL did not become healthy after 60s. Run: $D logs vpn-postgres"
  sleep 2
done
ok "PostgreSQL is healthy"

info "Running database migrations..."
$DC up migrate 2>&1 | while IFS= read -r line; do
  if [[ "$line" =~ (migration|Migration|error|Error|exited) ]]; then
    echo -e "    ${DIM}${line}${NC}"
  fi
done

# Verify migrations exited cleanly
EXIT_CODE=$($D inspect vpn-migrate --format='{{.State.ExitCode}}' 2>/dev/null || echo "0")
[[ "$EXIT_CODE" == "0" ]] || die "Migration container exited with code $EXIT_CODE. Run: $D logs vpn-migrate"
ok "Migrations complete"

# Update the seeded server row with the actual host IP and wg-easy password
info "Configuring seeded server record..."
$D exec -i vpn-postgres psql -U vpnuser -d vpnplatform -q << SQL
UPDATE servers
SET host       = '${VPN_SERVER_HOST}',
    wg_host    = '${VPN_SERVER_HOST}',
    wg_password = '${WGEASY_PASSWORD}'
WHERE name = 'US East #1';
SQL
ok "Server record updated"

# =============================================================================
divider "STEP 5/8  Creating administrator account"
# =============================================================================

# Check if admin already exists
EXISTS=$($D exec -i vpn-postgres psql -U vpnuser -d vpnplatform -tAq \
  -c "SELECT COUNT(*) FROM users WHERE role='admin';" 2>/dev/null || echo "0")
EXISTS=$(echo "$EXISTS" | tr -d '[:space:]')

if [[ "$EXISTS" -gt 0 && "${SKIP_ENV:-0}" == "1" ]]; then
  warn "Admin user already exists — skipping creation."
elif [[ "${SKIP_ENV:-0}" == "1" ]]; then
  warn "--env already existed but no admin found. Re-run without existing .env to create admin."
else
  info "Hashing admin password (pulling node:20-alpine if needed)..."
  ADMIN_HASH=$($D run --rm \
    -e PASS="$ADMIN_PASS" \
    node:20-alpine \
    sh -c 'npm install -s bcryptjs 2>/dev/null && node -e "require(\"bcryptjs\").hash(process.env.PASS,12).then(h=>process.stdout.write(h))"' \
    2>/dev/null)
  [[ -n "$ADMIN_HASH" ]] || die "Failed to generate password hash."

  # Escape single quotes in name/email for SQL
  ADMIN_EMAIL_SQL="${ADMIN_EMAIL//\'/\'\'}"
  ADMIN_NAME_SQL="${ADMIN_NAME//\'/\'\'}"

  $D exec -i vpn-postgres psql -U vpnuser -d vpnplatform -q << SQL
INSERT INTO users (email, password_hash, full_name, role, status, activation_date, expiration_date)
VALUES (
  '${ADMIN_EMAIL_SQL}',
  '${ADMIN_HASH}',
  '${ADMIN_NAME_SQL}',
  'admin',
  'active',
  NOW(),
  NOW() + INTERVAL '100 years'
)
ON CONFLICT (email) DO UPDATE
  SET password_hash = EXCLUDED.password_hash,
      full_name     = EXCLUDED.full_name,
      role          = 'admin',
      status        = 'active';
SQL
  ok "Admin account created: $ADMIN_EMAIL"

  # Store admin creds in a local file (printed at the end, not committed)
  cat > .admin-credentials << CREDS
Admin email:    ${ADMIN_EMAIL}
Admin password: ${ADMIN_PASS}
Generated:      $(date '+%Y-%m-%d %H:%M:%S')
CREDS
  chmod 600 .admin-credentials
fi

# =============================================================================
divider "STEP 6/8  Starting all services"
# =============================================================================

info "Starting backend and frontend..."
$DC up -d backend frontend

# =============================================================================
divider "STEP 7/8  Health verification"
# =============================================================================

wait_for_url() {
  local url="$1" label="$2" max=60 i=0
  echo -ne "  ${BLUE}▸${NC} Waiting for $label"
  while [[ $i -lt $max ]]; do
    if curl -sf "$url" >/dev/null 2>&1; then
      echo -e " ${GREEN}✔${NC}"
      return 0
    fi
    echo -n "."
    sleep 2
    i=$((i+1))
  done
  echo ""
  return 1
}

# Backend
if ! wait_for_url "http://localhost:3001/api/health" "Backend API"; then
  echo ""
  echo -e "  ${RED}Backend logs:${NC}"
  $D logs vpn-backend --tail 30 2>&1 | sed 's/^/    /'
  die "Backend did not become healthy. See logs above."
fi

# Frontend
if ! wait_for_url "http://localhost:80" "Frontend"; then
  echo ""
  echo -e "  ${RED}Frontend logs:${NC}"
  $D logs vpn-frontend --tail 20 2>&1 | sed 's/^/    /'
  die "Frontend did not become healthy. See logs above."
fi

# Login verification
info "Verifying admin login..."
LOGIN_RESP=$(curl -sf -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${ADMIN_EMAIL:-}\",\"password\":\"${ADMIN_PASS:-}\"}" 2>/dev/null || echo "")
if echo "$LOGIN_RESP" | grep -q '"success":true'; then
  ok "Admin login verified"
else
  warn "Could not verify admin login automatically. (If you used an existing .env, login was already working.)"
fi

# wg-easy connectivity
info "Testing wg-easy connectivity..."
WG_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  "http://localhost:51821/api/wireguard/client" 2>/dev/null || echo "000")
if [[ "$WG_STATUS" == "401" ]]; then
  ok "wg-easy reachable (returned 401 — authentication required, expected)"
elif [[ "$WG_STATUS" == "200" ]]; then
  ok "wg-easy reachable"
else
  warn "wg-easy returned HTTP $WG_STATUS. Check that wg-easy is running on port 51821."
  warn "The platform will start but VPN peer creation will fail until wg-easy is reachable."
fi

# Container status summary
echo ""
info "Container status:"
$D ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" \
  | grep -E "vpn-|NAMES" | sed 's/^/    /'

# =============================================================================
divider "STEP 8/8  Done"
# =============================================================================

# Determine the access URL
if [[ "${SERVER_HOST:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  BASE_URL="http://${SERVER_HOST:-localhost}"
else
  BASE_URL="https://${SERVER_HOST:-localhost}"
fi

echo ""
echo -e "${GREEN}${BOLD}  ✔ Deployment complete!${NC}"
echo ""
echo -e "  ${BOLD}URLs${NC}"
echo -e "  ├─ Platform:      ${CYAN}${BASE_URL}${NC}"
echo -e "  ├─ Admin panel:   ${CYAN}${BASE_URL}/admin${NC}"
echo -e "  └─ Backend API:   ${CYAN}${BASE_URL}:3001/api/health${NC}"
echo ""

if [[ -f ".admin-credentials" ]]; then
  echo -e "  ${BOLD}Admin credentials${NC} (also saved in .admin-credentials)"
  echo -e "  ├─ Email:         ${YELLOW}$(grep 'email:' .admin-credentials | awk '{print $NF}')${NC}"
  echo -e "  └─ Password:      ${YELLOW}$(grep 'password:' .admin-credentials | awk '{print $NF}')${NC}"
  echo ""
fi

echo -e "  ${BOLD}Management commands${NC}"
echo -e "  ├─ Update:        ${DIM}./update.sh${NC}"
echo -e "  ├─ Backup DB:     ${DIM}./backup.sh${NC}"
echo -e "  ├─ Restore DB:    ${DIM}./restore.sh <backup-file.sql.gz>${NC}"
echo -e "  ├─ All logs:      ${DIM}$SUDO docker compose -f docker-compose.platform.yml logs -f${NC}"
echo -e "  └─ Uninstall:     ${DIM}./uninstall.sh${NC}"
echo ""

if [[ "${SERVER_HOST:-}" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo -e "  ${YELLOW}⚠  You are running over plain HTTP.${NC}"
  echo -e "  ${YELLOW}   For production, point a domain at this server and run:${NC}"
  echo -e "  ${YELLOW}   sudo apt install certbot python3-certbot-nginx && sudo certbot --nginx -d your.domain${NC}"
  echo -e "  ${YELLOW}   Then update CORS_ORIGIN in .env and run ./update.sh${NC}"
  echo ""
fi

if [[ $EUID -ne 0 ]]; then
  echo -e "  ${DIM}Tip: run 'newgrp docker' or log out/in to use docker without sudo.${NC}"
  echo ""
fi
