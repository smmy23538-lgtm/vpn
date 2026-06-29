#!/usr/bin/env bash
# =============================================================================
#  VPN Platform — One-Command Deployment
#  Usage: ./deploy.sh
# =============================================================================
set -euo pipefail

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
COMPOSE_SSL="docker-compose.ssl.yml"
ENV_FILE=".env"

# ── Require we're in the project root ────────────────────────────────────────
[[ -f "$COMPOSE_FILE" ]] || die "Run this script from the vpn-platform project root (where $COMPOSE_FILE is located)."

# ── Detect privilege level ────────────────────────────────────────────────────
if [[ $EUID -eq 0 ]]; then
  SUDO=""
else
  SUDO="sudo"
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
divider "STEP 1/9  System dependencies"
# =============================================================================

install_pkg() {
  local pkg="$1"
  if ! dpkg -s "$pkg" &>/dev/null; then
    info "Installing $pkg..."
    $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -q "$pkg"
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
  info "Installing Docker (official repo)..."
  $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -q ca-certificates gnupg lsb-release
  $SUDO install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/ubuntu/gpg \
    | $SUDO gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
  $SUDO chmod a+r /etc/apt/keyrings/docker.gpg
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
    https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" \
    | $SUDO tee /etc/apt/sources.list.d/docker.list >/dev/null
  $SUDO apt-get update -q
  $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -q \
    docker-ce docker-ce-cli containerd.io docker-compose-plugin
  $SUDO systemctl enable --now docker
  [[ $EUID -ne 0 ]] && $SUDO usermod -aG docker "$USER" || true
  ok "Docker installed"
else
  ok "Docker $(docker --version | cut -d' ' -f3 | tr -d ',') already installed"
fi

$SUDO systemctl start docker 2>/dev/null || true

if ! $SUDO docker compose version &>/dev/null; then
  info "Installing Docker Compose plugin..."
  $SUDO DEBIAN_FRONTEND=noninteractive apt-get install -y -q docker-compose-plugin
  ok "Docker Compose installed"
else
  ok "Docker Compose $($SUDO docker compose version --short 2>/dev/null || echo '') already installed"
fi

D="$SUDO docker"

# =============================================================================
divider "STEP 2/9  Configuration"
# =============================================================================

AUTO_IP=$(curl -sf --connect-timeout 5 https://checkip.amazonaws.com 2>/dev/null \
       || curl -sf --connect-timeout 5 https://ifconfig.me 2>/dev/null \
       || echo "")

SKIP_ENV=0
if [[ -f "$ENV_FILE" ]]; then
  warn ".env already exists — skipping config generation."
  warn "Delete .env and re-run to reconfigure, or edit it manually."
  SKIP_ENV=1
else
  echo ""
  echo -e "  ${DIM}Answer the following questions. Press Enter to accept defaults.${NC}"
  echo ""

  # Server host / domain
  ask "Server public IP or domain name? [${AUTO_IP:-your-ip-or-domain}]"
  read -r -p "  → " INPUT_HOST
  SERVER_HOST="${INPUT_HOST:-${AUTO_IP}}"
  [[ -n "$SERVER_HOST" ]] || die "Server host is required."

  # Domain for HTTPS
  ask "Domain name for HTTPS/SSL (e.g. vpn.example.com) — leave blank to skip SSL:"
  read -r -p "  → " SSL_DOMAIN
  SSL_DOMAIN="${SSL_DOMAIN:-}"

  # wg-easy password
  ask "wg-easy admin password (the password you set when installing wg-easy):"
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

  # Determine CORS_ORIGIN
  if [[ -n "$SSL_DOMAIN" ]]; then
    CORS_ORIGIN="https://${SSL_DOMAIN}"
  elif [[ "$SERVER_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    CORS_ORIGIN="http://${SERVER_HOST}"
  else
    CORS_ORIGIN="https://${SERVER_HOST}"
  fi

  info "Generating cryptographic secrets..."
  POSTGRES_PASSWORD=$(openssl rand -base64 32 | tr -d '/+=' | head -c 32)
  JWT_SECRET=$(openssl rand -hex 64)
  ENCRYPTION_KEY=$(openssl rand -hex 32)
  ok "Secrets generated"

  info "Writing .env..."
  # NOTE: values that might contain special characters are double-quoted.
  # EXPIRY_CHECK_CRON must be quoted because cron expressions contain spaces.
  cat > "$ENV_FILE" << ENVFILE
# ── VPN Platform Environment ─────────────────────────────────────────────────
# Generated by deploy.sh on $(date '+%Y-%m-%d %H:%M:%S')
# DO NOT commit this file to git.

# ── Database ──────────────────────────────────────────────────────────────────
POSTGRES_PASSWORD="${POSTGRES_PASSWORD}"

# ── Secrets ───────────────────────────────────────────────────────────────────
JWT_SECRET="${JWT_SECRET}"
ENCRYPTION_KEY="${ENCRYPTION_KEY}"

# ── wg-easy ───────────────────────────────────────────────────────────────────
WGEASY_URL="http://${SERVER_HOST}:51821"
WGEASY_PASSWORD="${WGEASY_PASS}"

# ── VPN Server ────────────────────────────────────────────────────────────────
VPN_SERVER_HOST="${SERVER_HOST}"
VPN_SERVER_PORT=51830
VPN_SERVER_NAME="US East"
VPN_SERVER_COUNTRY="United States"

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ORIGIN="${CORS_ORIGIN}"

# ── SSL / Domain ──────────────────────────────────────────────────────────────
SSL_DOMAIN="${SSL_DOMAIN}"

# ── Scheduler ─────────────────────────────────────────────────────────────────
EXPIRY_CHECK_CRON="0 0 * * *"
EXPIRY_WARNING_DAYS=7

# ── Frontend ──────────────────────────────────────────────────────────────────
VITE_WS_URL=
ENVFILE
  chmod 600 "$ENV_FILE"
  ok ".env written (permissions: 600)"
fi

# Source .env so all variables are available to the rest of the script
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

# Resolve SERVER_HOST from the env when SKIP_ENV=1 (not collected interactively)
SERVER_HOST="${SERVER_HOST:-${VPN_SERVER_HOST:-${AUTO_IP:-localhost}}}"
SSL_DOMAIN="${SSL_DOMAIN:-}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASS="${ADMIN_PASS:-}"

# Build the Docker Compose command (may gain ssl overlay later)
DC="$SUDO docker compose -f $COMPOSE_FILE"

# =============================================================================
divider "STEP 3/9  Building Docker images"
# =============================================================================

info "Building backend and frontend images (2–5 min on first run)..."
$DC build 2>&1
ok "Images built"

# =============================================================================
divider "STEP 4/9  Database migrations"
# =============================================================================

info "Starting PostgreSQL..."
$DC up -d postgres

info "Waiting for PostgreSQL to be ready..."
ATTEMPTS=0
until $D exec vpn-postgres pg_isready -U vpnuser -d vpnplatform -q 2>/dev/null; do
  ATTEMPTS=$((ATTEMPTS+1))
  if [[ $ATTEMPTS -gt 40 ]]; then
    $D logs vpn-postgres --tail 20 2>&1 | sed 's/^/    /' || true
    die "PostgreSQL did not become ready after 80 s. See logs above."
  fi
  sleep 2
done
ok "PostgreSQL is ready"

info "Running database migrations..."
$DC up migrate 2>&1 | while IFS= read -r line; do
  if [[ "$line" =~ (migration|Migration|error|Error|exited) ]]; then
    echo -e "    ${DIM}${line}${NC}"
  fi
done || true   # let docker inspect decide — the pipe's exit code is unreliable with pipefail

EXIT_CODE=$($D inspect vpn-migrate --format='{{.State.ExitCode}}' 2>/dev/null || echo "1")
if [[ "$EXIT_CODE" != "0" ]]; then
  echo -e "\n  ${RED}Migration logs:${NC}"
  $D logs vpn-migrate 2>&1 | tail -30 | sed 's/^/    /'
  die "Migration exited with code $EXIT_CODE."
fi
ok "Migrations complete"

# Update seeded server with the actual server host.
# wg_password is left NULL — the backend falls back to env.WGEASY_PASSWORD.
info "Configuring seeded server record with host: ${SERVER_HOST}..."
$D exec -i vpn-postgres psql -U vpnuser -d vpnplatform -q << SQL
UPDATE servers
SET host    = '${SERVER_HOST}',
    wg_host = '${SERVER_HOST}'
WHERE name = 'US East #1';
SQL
ok "Server host updated"

# =============================================================================
divider "STEP 5/9  Creating administrator account"
# =============================================================================

EXISTS=$($D exec -i vpn-postgres psql -U vpnuser -d vpnplatform -tAq \
  -c "SELECT COUNT(*) FROM users WHERE role='admin';" 2>/dev/null || echo "0")
EXISTS=$(echo "$EXISTS" | tr -d '[:space:]')

if [[ "$EXISTS" -gt 0 && "$SKIP_ENV" == "1" ]]; then
  warn "Admin user already exists — skipping creation."
elif [[ "$SKIP_ENV" == "1" ]]; then
  warn ".env existed but no admin found. Re-run without existing .env to create admin."
else
  # Use the already-built backend image (it has bcrypt installed as a production dep).
  # docker compose run --no-deps avoids starting postgres again; 2>/dev/null silences
  # Compose status lines which go to stderr — only the hash reaches stdout.
  info "Hashing admin password (using backend image)..."
  ADMIN_HASH=$($DC run --no-deps --rm \
    -e "PASS=$ADMIN_PASS" \
    backend \
    node -e "require('bcrypt').hash(process.env.PASS,12).then(h=>process.stdout.write(h))" \
    2>/dev/null)
  [[ -n "$ADMIN_HASH" ]] || die "Failed to generate password hash. Run: $D logs vpn-backend"

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
  ok "Admin account ready: $ADMIN_EMAIL"

  cat > .admin-credentials << CREDS
Admin email:    ${ADMIN_EMAIL}
Admin password: ${ADMIN_PASS}
Generated:      $(date '+%Y-%m-%d %H:%M:%S')
CREDS
  chmod 600 .admin-credentials
fi

# =============================================================================
divider "STEP 6/9  Starting all services"
# =============================================================================

info "Starting backend and frontend..."
$DC up -d backend frontend

# =============================================================================
divider "STEP 7/9  Health verification"
# =============================================================================

wait_for_url() {
  local url="$1" label="$2" max="${3:-60}" i=0
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

if ! wait_for_url "http://localhost:3001/api/health" "Backend API"; then
  echo ""
  echo -e "  ${RED}Backend logs:${NC}"
  $D logs vpn-backend --tail 30 2>&1 | sed 's/^/    /'
  die "Backend did not become healthy. See logs above."
fi

if ! wait_for_url "http://localhost:80" "Frontend"; then
  echo ""
  echo -e "  ${RED}Frontend logs:${NC}"
  $D logs vpn-frontend --tail 20 2>&1 | sed 's/^/    /'
  die "Frontend did not become healthy. See logs above."
fi

# Verify admin login (only if we just created the admin)
if [[ -n "${ADMIN_EMAIL:-}" && -n "${ADMIN_PASS:-}" ]]; then
  info "Verifying admin login..."
  LOGIN_RESP=$(curl -sf -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASS}\"}" 2>/dev/null || echo "")
  if echo "$LOGIN_RESP" | grep -q '"success":true'; then
    ok "Admin login verified"
  else
    warn "Could not verify admin login automatically."
  fi
fi

# wg-easy connectivity
info "Testing wg-easy connectivity..."
WG_STATUS=$(curl -sf -o /dev/null -w "%{http_code}" \
  "http://localhost:51821/api/wireguard/client" 2>/dev/null || echo "000")
if [[ "$WG_STATUS" == "401" || "$WG_STATUS" == "200" ]]; then
  ok "wg-easy reachable (HTTP ${WG_STATUS})"
else
  warn "wg-easy returned HTTP ${WG_STATUS}. Ensure wg-easy is running on port 51821."
  warn "VPN peer creation will fail until wg-easy is reachable."
fi

echo ""
info "Container status:"
$D ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" \
  | grep -E "vpn-|NAMES" | sed 's/^/    /'

# =============================================================================
divider "STEP 8/9  SSL / HTTPS"
# =============================================================================

BASE_URL="http://${SERVER_HOST}"

if [[ -n "${SSL_DOMAIN:-}" ]]; then
  if [[ -f "$COMPOSE_SSL" ]]; then
    ok "SSL already configured for ${SSL_DOMAIN} (docker-compose.ssl.yml exists)"
    BASE_URL="https://${SSL_DOMAIN}"
    DC="$SUDO docker compose -f $COMPOSE_FILE -f $COMPOSE_SSL"
  else
    info "Setting up HTTPS for domain: ${SSL_DOMAIN}"
    echo -e "  ${DIM}Ensure DNS A record for ${SSL_DOMAIN} points to ${SERVER_HOST} before continuing.${NC}"
    echo ""

    # Install nginx + certbot
    for pkg in nginx certbot python3-certbot-nginx; do
      install_pkg "$pkg"
    done

    # Create compose override to bind frontend on localhost:3000 only
    cat > "$COMPOSE_SSL" << 'SSLFILE'
services:
  frontend:
    ports:
      - "127.0.0.1:3000:80"
SSLFILE
    ok "Created $COMPOSE_SSL"

    DC="$SUDO docker compose -f $COMPOSE_FILE -f $COMPOSE_SSL"

    # Restart frontend with new port binding
    info "Rebinding frontend to 127.0.0.1:3000..."
    $SUDO docker compose -f "$COMPOSE_FILE" stop frontend 2>/dev/null || true
    $DC up -d frontend

    wait_for_url "http://127.0.0.1:3000" "Frontend (internal)" 30 \
      || die "Frontend didn't start on port 3000"

    # Write nginx config
    info "Writing nginx site config..."
    cat << NGINXCONF | $SUDO tee /etc/nginx/sites-available/vpn-platform >/dev/null
server {
    listen 80;
    server_name ${SSL_DOMAIN};

    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90;
    }

    location /ws {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade \$http_upgrade;
        proxy_set_header   Connection "upgrade";
        proxy_set_header   Host \$host;
        proxy_read_timeout 3600;
    }

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host \$host;
        proxy_set_header   X-Real-IP \$remote_addr;
        proxy_set_header   X-Forwarded-For \$proxy_add_x_forwarded_for;
    }
}
NGINXCONF

    $SUDO ln -sf /etc/nginx/sites-available/vpn-platform /etc/nginx/sites-enabled/vpn-platform
    $SUDO rm -f /etc/nginx/sites-enabled/default
    $SUDO nginx -t || die "nginx config test failed — check /etc/nginx/sites-available/vpn-platform"
    $SUDO systemctl enable --now nginx
    $SUDO systemctl reload nginx
    ok "nginx configured"

    # Certbot
    CERTBOT_EMAIL="${ADMIN_EMAIL:-admin@${SSL_DOMAIN}}"
    info "Obtaining Let's Encrypt certificate (email: ${CERTBOT_EMAIL})..."
    $SUDO certbot --nginx \
      -d "${SSL_DOMAIN}" \
      --non-interactive \
      --agree-tos \
      --email "${CERTBOT_EMAIL}" \
      --redirect \
      || die "certbot failed. Ensure DNS is pointing to this server and port 80 is open."
    ok "SSL certificate obtained for ${SSL_DOMAIN}"

    # Update CORS_ORIGIN in .env
    $SUDO sed -i "s|^CORS_ORIGIN=.*|CORS_ORIGIN=\"https://${SSL_DOMAIN}\"|" "$ENV_FILE"
    ok "CORS_ORIGIN updated in .env"

    # Restart backend to pick up new CORS_ORIGIN
    info "Restarting backend with updated CORS..."
    $DC restart backend
    wait_for_url "http://localhost:3001/api/health" "Backend API (post-SSL)" \
      || die "Backend did not restart after SSL update"

    BASE_URL="https://${SSL_DOMAIN}"
    ok "HTTPS is live at ${BASE_URL}"
  fi
else
  if [[ "$SERVER_HOST" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo ""
    echo -e "  ${YELLOW}⚠  Running over plain HTTP (no domain/SSL provided).${NC}"
    echo -e "  ${DIM}   To add HTTPS later: point a domain at this server, delete .env,${NC}"
    echo -e "  ${DIM}   and re-run ./deploy.sh — enter your domain when asked.${NC}"
    echo ""
  fi
fi

# =============================================================================
divider "STEP 9/9  Done"
# =============================================================================

echo ""
echo -e "${GREEN}${BOLD}  ✔ Deployment complete!${NC}"
echo ""
echo -e "  ${BOLD}URLs${NC}"
echo -e "  ├─ Platform:    ${CYAN}${BASE_URL}${NC}"
echo -e "  ├─ Admin panel: ${CYAN}${BASE_URL}/admin${NC}"
echo -e "  └─ API health:  ${CYAN}http://localhost:3001/api/health${NC}"
echo ""

if [[ -f ".admin-credentials" ]]; then
  echo -e "  ${BOLD}Admin credentials${NC}  (saved in .admin-credentials)"
  while IFS= read -r line; do
    echo -e "  ${YELLOW}${line}${NC}"
  done < .admin-credentials
  echo ""
fi

echo -e "  ${BOLD}Management${NC}"
echo -e "  ├─ Update:      ${DIM}./update.sh${NC}"
echo -e "  ├─ Backup DB:   ${DIM}./backup.sh${NC}"
echo -e "  ├─ Restore DB:  ${DIM}./restore.sh <file.sql.gz>${NC}"
echo -e "  ├─ Logs:        ${DIM}${SUDO:+$SUDO }docker compose -f $COMPOSE_FILE logs -f${NC}"
echo -e "  └─ Uninstall:   ${DIM}./uninstall.sh${NC}"
echo ""

if [[ $EUID -ne 0 ]]; then
  echo -e "  ${DIM}Tip: run 'newgrp docker' or re-login to use docker without sudo.${NC}"
  echo ""
fi
