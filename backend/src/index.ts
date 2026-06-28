import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { env } from './config/env';
import { checkConnection } from './config/database';
import { globalLimiter } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';
import { startScheduler } from './services/scheduler.service';
import { verifyToken } from './utils/jwt';
import { getVpnStatus } from './services/vpn.service';
import { logger } from './utils/logger';

const app = express();
const server = http.createServer(app);

app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin: env.CORS_ORIGIN.split(',').map((o) => o.trim()),
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(globalLimiter);

app.use('/api', routes);
app.use(errorHandler);

// WebSocket server for live VPN status updates
const wss = new WebSocketServer({ server, path: '/ws' });

interface AuthenticatedWs extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

wss.on('connection', (ws: AuthenticatedWs, req) => {
  ws.isAlive = true;
  ws.on('pong', () => { ws.isAlive = true; });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data.toString());

      if (msg.type === 'auth') {
        const payload = verifyToken(msg.token);
        ws.userId = payload.userId;
        ws.send(JSON.stringify({ type: 'auth', payload: { success: true } }));
      }

      if (msg.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', payload: { message: 'Invalid message' } }));
    }
  });

  ws.on('error', (err) => logger.warn('WS error', { error: err.message }));
});

// Heartbeat to detect dead connections
const heartbeat = setInterval(() => {
  wss.clients.forEach((ws) => {
    const client = ws as AuthenticatedWs;
    if (!client.isAlive) return client.terminate();
    client.isAlive = false;
    client.ping();
  });
}, 30000);

wss.on('close', () => clearInterval(heartbeat));

// Push VPN status to authenticated clients every 15s
setInterval(async () => {
  const clients = [...wss.clients] as AuthenticatedWs[];
  for (const ws of clients) {
    if (ws.readyState !== WebSocket.OPEN || !ws.userId) continue;
    try {
      const status = await getVpnStatus(ws.userId);
      ws.send(JSON.stringify({ type: 'vpn_status', payload: status }));
    } catch {
      // user may have been deleted
    }
  }
}, 15000);

async function start(): Promise<void> {
  await checkConnection();
  startScheduler();

  server.listen(env.PORT, () => {
    logger.info(`Backend API listening on port ${env.PORT}`);
    logger.info(`WebSocket server on ws://localhost:${env.PORT}/ws`);
    logger.info(`Environment: ${env.NODE_ENV}`);
  });
}

start().catch((err) => {
  logger.error('Failed to start server', { error: String(err) });
  process.exit(1);
});
