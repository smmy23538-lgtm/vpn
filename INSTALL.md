# Installation Guide

## Prerequisites

On your EC2 server (alongside the existing wg-easy container):

- Docker 24+ and Docker Compose v2+
- Git
- 1 GB RAM minimum (2 GB recommended)
- Ports `80` and `3001` open in your EC2 security group

## Step 1 — Clone and checkout branch

```bash
git clone https://github.com/smmy23538-lgtm/vpn.git
cd vpn
git checkout vpn-platform
```

## Step 2 — Configure environment variables

```bash
cp .env.example .env
nano .env
```

Fill in **all** values:

```bash
# Generate JWT_SECRET (64 bytes hex):
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Generate ENCRYPTION_KEY (32 bytes hex):
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Required fields:
| Variable | Description |
|----------|-------------|
| `POSTGRES_PASSWORD` | Strong password for PostgreSQL |
| `JWT_SECRET` | 64-byte hex string |
| `ENCRYPTION_KEY` | 32-byte hex string |
| `WGEASY_PASSWORD` | Your wg-easy plaintext password |
| `CORS_ORIGIN` | Your domain, e.g. `https://vpn.example.com` |

## Step 3 — Run database migrations

```bash
docker compose -f docker-compose.platform.yml run --rm migrate
```

This creates the `users`, `audit_logs`, `servers`, and `user_servers` tables.

## Step 4 — Create the first admin user

After migrations complete, create your admin account:

```bash
docker compose -f docker-compose.platform.yml run --rm backend \
  node -e "
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
async function main() {
  const hash = await bcrypt.hash('YourAdminPassword123!', 12);
  const expiry = new Date('2099-12-31');
  await pool.query(
    \`INSERT INTO users (email, password_hash, full_name, role, expiration_date)
     VALUES (\$1, \$2, \$3, 'admin', \$4)\`,
    ['admin@yourdomain.com', hash, 'Administrator', expiry]
  );
  console.log('Admin created');
  await pool.end();
}
main().catch(console.error);
"
```

Change `admin@yourdomain.com` and `YourAdminPassword123!` to your values.

## Step 5 — Start the platform

```bash
docker compose -f docker-compose.platform.yml up -d
```

Services started:
- `vpn-postgres` — PostgreSQL on internal network
- `vpn-backend` — API on port `3001`
- `vpn-frontend` — Nginx serving the React PWA on port `80`

## Step 6 — Verify

```bash
# Check all containers are running
docker compose -f docker-compose.platform.yml ps

# Check API health
curl http://localhost:3001/api/health

# Check frontend
curl -I http://localhost
```

## Step 7 — (Optional) HTTPS with Nginx reverse proxy

For HTTPS, install Certbot and configure Nginx on the host:

```bash
sudo apt install nginx certbot python3-certbot-nginx
sudo certbot --nginx -d vpn.yourdomain.com
```

Then configure Nginx to proxy:
- `https://vpn.yourdomain.com/api` → `http://localhost:3001`
- `https://vpn.yourdomain.com/ws` → `ws://localhost:3001`
- `https://vpn.yourdomain.com` → `http://localhost:80`

See [DEPLOYMENT.md](DEPLOYMENT.md) for a complete Nginx config.

## Updating

```bash
git pull origin vpn-platform
docker compose -f docker-compose.platform.yml up -d --build
```

## Logs

```bash
# Backend logs
docker logs vpn-backend -f

# Frontend logs
docker logs vpn-frontend -f

# Database logs
docker logs vpn-postgres -f
```
