# Deployment Guide

## Production Setup on AWS EC2

### Recommended EC2 Configuration
- Instance: `t3.small` or larger (2 vCPU, 2 GB RAM)
- OS: Ubuntu 22.04 LTS
- Storage: 20 GB gp3
- Security Group inbound rules:
  - `22/tcp` — SSH (restrict to your IP)
  - `80/tcp` — HTTP
  - `443/tcp` — HTTPS
  - `3001/tcp` — Backend API (optional, can proxy through Nginx)
  - `51830/udp` — WireGuard VPN clients (existing)
  - `51821/tcp` — wg-easy management (restrict to internal / remove after setup)

### Nginx Full Configuration (HTTPS)

Save as `/etc/nginx/sites-available/vpn`:

```nginx
# HTTP → HTTPS redirect
server {
    listen 80;
    server_name vpn.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name vpn.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/vpn.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/vpn.yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # API — proxy to backend
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3001/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 86400;
    }

    # Frontend
    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/vpn /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Environment Variables (production .env)

```env
POSTGRES_PASSWORD=<very_strong_random_password>
JWT_SECRET=<64_byte_hex>
ENCRYPTION_KEY=<32_byte_hex>
WGEASY_URL=http://3.21.126.65:51821
WGEASY_PASSWORD=<your_wgeasy_password>
CORS_ORIGIN=https://vpn.yourdomain.com
VPN_SERVER_HOST=3.21.126.65
VPN_SERVER_PORT=51830
VPN_SERVER_NAME=US East
VPN_SERVER_COUNTRY=United States
EXPIRY_CHECK_CRON=0 0 * * *
EXPIRY_WARNING_DAYS=7
```

### Running Both Stacks Together

The existing `docker-compose.yml` (wg-easy) and the new `docker-compose.platform.yml` (platform) are independent. Both should run simultaneously:

```bash
# wg-easy (existing)
docker compose up -d

# Platform (new)
docker compose -f docker-compose.platform.yml up -d
```

The platform backend communicates with wg-easy over the network using `WGEASY_URL`.

### Backup

#### Database backup
```bash
docker exec vpn-postgres pg_dump -U vpnuser vpnplatform > backup_$(date +%Y%m%d).sql
```

#### Restore
```bash
cat backup_20240101.sql | docker exec -i vpn-postgres psql -U vpnuser vpnplatform
```

#### WireGuard config backup (existing script)
Your existing `wg-backup.tar.gz` covers this — keep running your backup schedule.

### Health Monitoring

```bash
# Quick health check
curl -s http://localhost:3001/api/health | jq

# Watch backend logs
docker logs vpn-backend -f --tail 100

# PostgreSQL status
docker exec vpn-postgres pg_isready -U vpnuser
```

### Auto-restart on reboot

Docker with `restart: unless-stopped` handles this automatically. Ensure Docker itself starts on boot:

```bash
sudo systemctl enable docker
```

### Updating the Platform

```bash
cd /path/to/vpn
git pull origin vpn-platform
docker compose -f docker-compose.platform.yml up -d --build backend frontend
```

Migrations are idempotent (uses `CREATE TABLE IF NOT EXISTS`) so re-running the migrate container is safe.

## Adding a Second VPN Server (Future)

When you add a second server:

1. Deploy wg-easy on the new server.
2. Insert a row into the `servers` table with the new server's details.
3. Create a new `WgEasyService` instance pointing to the new server URL.
4. The `user_servers` table already supports multiple server assignments per user.
5. Add a server picker to the frontend `Dashboard.tsx`.

No schema changes needed — the tables are already in place.
