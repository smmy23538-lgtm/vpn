# SecureVPN Platform

A production-ready VPN management platform built on top of [wg-easy](https://github.com/wg-easy/wg-easy) and WireGuard.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   React PWA     │────▶│  Node.js API     │────▶│   wg-easy API   │
│  (Customer UI)  │     │  (Express + JWT) │     │ (3.21.126.65:   │
│  (Admin Panel)  │◀────│  (PostgreSQL)    │     │  51821)         │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                 │                        │
                                 │                        ▼
                          ┌──────┴──────┐      ┌──────────────────┐
                          │ PostgreSQL  │      │  WireGuard VPN   │
                          │  Database  │      │ (3.21.126.65:    │
                          └─────────────┘      │  51830/udp)      │
                                               └──────────────────┘
```

### Stack

| Layer | Technology |
|-------|-----------|
| Customer + Admin UI | React 18, TypeScript, TailwindCSS, Vite, PWA |
| Backend API | Node.js 20, Express, TypeScript, WebSockets |
| Database | PostgreSQL 16 |
| VPN Server | WireGuard via wg-easy (existing EC2 instance) |
| Container | Docker, Docker Compose |

## Features

### Customer PWA
- Install-to-homescreen (PWA) for native-app feel
- Connect / Disconnect button with live animated status
- Real-time VPN IP, server location, transfer statistics
- Session-aware WebSocket status updates (15s polling)
- Guided setup wizard — imports config into WireGuard app
- Account page (subscription status, expiry countdown)
- Change password
- Download VPN config file

### Admin Dashboard
- User management (create, edit, suspend, reactivate, delete)
- Automatic WireGuard peer provisioning on user creation
- Subscription renewal (30 / 60 / 90 / custom days)
- Connected users view with live transfer stats
- Server health monitoring
- Full audit log with actor, action, timestamp, IP
- JWT-secured, role-based access control

### Automation
- Daily cron job: expires users whose subscription date has passed
- Automatically disables WireGuard peer when user expires
- Reactivates WireGuard peer on renewal
- Audit log for every system action

## Project Structure

```
vpn-platform/
├── data/                         # wg-easy WireGuard config (existing, do not modify)
├── docker-compose.yml            # wg-easy container (existing)
├── docker-compose.platform.yml   # Platform services (PostgreSQL, Backend, Frontend)
├── .env.example                  # Environment variable template
├── backend/
│   ├── src/
│   │   ├── config/               # DB pool, env loader
│   │   ├── controllers/          # auth, vpn, admin
│   │   ├── middleware/           # JWT auth, RBAC, rate limiter
│   │   ├── migrations/           # SQL schema files
│   │   ├── routes/               # Express routers
│   │   ├── services/             # wgeasy, vpn, user, audit, scheduler
│   │   ├── types/                # TypeScript interfaces
│   │   └── utils/                # JWT, AES-256-GCM crypto, logger, errors
│   ├── Dockerfile
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/                  # Axios client with auto token refresh
    │   ├── components/           # Button, Card, Badge, Input, Modal, layouts
    │   ├── contexts/             # AuthContext (JWT storage + refresh)
    │   ├── hooks/                # useVpn (WebSocket + polling)
    │   ├── pages/
    │   │   ├── customer/         # Dashboard, Account, Settings
    │   │   └── admin/            # Dashboard, Users, UserDetail, CreateUser,
    │   │                         # ConnectedUsers, AuditLogs, ServerHealth
    │   └── types/
    ├── Dockerfile                # Multi-stage build → Nginx
    ├── nginx.conf                # SPA routing + security headers
    └── vite.config.ts            # Vite + PWA plugin
```

## API Reference

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Login → returns JWT access + refresh tokens |
| POST | `/api/auth/refresh` | Exchange refresh token for new access token |
| GET | `/api/auth/me` | Get current user profile |
| PUT | `/api/auth/password` | Change password |

### VPN (customer)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vpn/status` | Get current VPN connection status |
| GET | `/api/vpn/config` | Download WireGuard .conf file |

### Admin
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/stats` | Dashboard statistics |
| GET | `/api/admin/health` | Server + WireGuard health |
| GET | `/api/admin/connected` | List peers with connection status |
| GET | `/api/admin/users` | List users (paginated, searchable) |
| POST | `/api/admin/users` | Create user + provision VPN peer |
| GET | `/api/admin/users/:id` | Get user details |
| PUT | `/api/admin/users/:id` | Edit user |
| DELETE | `/api/admin/users/:id` | Delete user + remove VPN peer |
| POST | `/api/admin/users/:id/suspend` | Suspend user |
| POST | `/api/admin/users/:id/reactivate` | Reactivate user |
| POST | `/api/admin/users/:id/renew` | Renew subscription by N days |
| GET | `/api/admin/audit-logs` | Audit log (paginated) |

### WebSocket (`ws://host/ws`)
After connecting, send `{"type":"auth","token":"<accessToken>"}` to authenticate.
The server then pushes `{"type":"vpn_status","payload":{...}}` every 15 seconds.

## Security

- **JWT HS256** with configurable expiry (default 7d access, 30d refresh)
- **AES-256-GCM** encryption for WireGuard private keys stored in PostgreSQL
- **bcrypt** (12 rounds) for user passwords
- **Rate limiting**: 10 login attempts / 15 min, 100 requests / 15 min globally
- **Helmet** security headers on all API responses
- **RBAC**: customer routes vs admin routes strictly separated
- **Audit log**: every privileged action is logged with actor + IP

## Future Expansion (architecture ready)

The codebase is designed for these additions without redesigning:

| Feature | Where to add |
|---------|-------------|
| Multiple server locations | `servers` + `user_servers` tables (already in schema), new server selector UI |
| Email notifications | Add `nodemailer` service, hook into scheduler and user actions |
| Bandwidth stats | Store wg-easy transferRx/Tx snapshots in a new `bandwidth_snapshots` table |
| Multi-device per user | Extend `user_servers` to allow multiple peers per user |
| Android / iOS / Desktop apps | Use the same REST + WebSocket API; replace web PWA |
| Push notifications | Add Firebase or web-push to existing WebSocket infrastructure |
| Load balancing | The `wgEasyService` can be wrapped to support multiple wg-easy endpoints |
