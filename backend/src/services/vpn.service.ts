import { wgManager } from './wgeasy.manager';
import { updateUser, findById } from './user.service';
import { logAction } from './audit.service';
import { createNotification } from './notification.service';
import { getServerForUser, getDefaultServer, getServer, ServerRecord } from './server.service';
import { query } from '../config/database';
import { VpnStatus, User } from '../types';
import { env } from '../config/env';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { AppError, NotFoundError } from '../utils/errors';

function wgFor(server: ServerRecord) {
  return wgManager.getInstance({
    url: `http://${server.host}:${server.port}`,
    password: server.wg_password ?? env.WGEASY_PASSWORD,
  });
}

export async function provisionVpnPeer(user: User, actorId?: string): Promise<User> {
  if (user.wg_client_id) {
    const server = user.server_id ? await getServerById(user.server_id) : null;
    if (server) await wgFor(server).enableClient(user.wg_client_id);
    return user;
  }

  const server = user.server_id
    ? await getServerById(user.server_id)
    : await getDefaultServer();

  if (!server) throw new AppError('No VPN server available', 503);

  const wg = wgFor(server);
  const wgClient = await wg.createClient(user.email);
  const config = await wg.getConfig(wgClient.id);

  const privateKeyMatch = config.match(/PrivateKey\s*=\s*(.+)/);
  const presharedKeyMatch = config.match(/PresharedKey\s*=\s*(.+)/);

  const updated = await updateUser(user.id, {
    wg_client_id: wgClient.id,
    wg_client_ip: wgClient.address,
    wg_public_key: wgClient.publicKey,
    wg_private_key: privateKeyMatch?.[1]?.trim() ? encrypt(privateKeyMatch[1].trim()) : null,
    wg_preshared_key: presharedKeyMatch?.[1]?.trim() ? encrypt(presharedKeyMatch[1].trim()) : null,
    server_id: server.id,
  });

  await logAction('vpn.peer.created', {
    userId: user.id,
    actorId: actorId ?? user.id,
    details: { wg_client_id: wgClient.id, vpn_ip: wgClient.address, server: server.name },
  });

  logger.info('VPN peer provisioned', { userId: user.id, vpnIp: wgClient.address, server: server.name });
  return updated;
}

export async function removeVpnPeer(userId: string, actorId?: string): Promise<void> {
  const user = await findById(userId);
  if (!user?.wg_client_id) return;

  const server = user.server_id ? await getServerById(user.server_id) : null;
  if (server) {
    try { await wgFor(server).deleteClient(user.wg_client_id); } catch { /* peer may already be gone */ }
  }

  await updateUser(userId, {
    wg_client_id: null, wg_client_ip: null,
    wg_public_key: null, wg_private_key: null, wg_preshared_key: null,
  });

  await logAction('vpn.peer.deleted', {
    userId, actorId: actorId ?? userId,
    details: { wg_client_id: user.wg_client_id },
  });
}

export async function enableVpnAccess(userId: string, actorId?: string): Promise<void> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.wg_client_id) throw new AppError('No VPN peer configured', 400);
  const server = user.server_id ? await getServerById(user.server_id) : null;
  if (server) await wgFor(server).enableClient(user.wg_client_id);
  await logAction('vpn.access.enabled', { userId, actorId: actorId ?? userId });
}

export async function disableVpnAccess(userId: string, actorId?: string): Promise<void> {
  const user = await findById(userId);
  if (!user?.wg_client_id) return;
  const server = user.server_id ? await getServerById(user.server_id) : null;
  if (server) {
    try { await wgFor(server).disableClient(user.wg_client_id); } catch { /* ignore */ }
  }
  await logAction('vpn.access.disabled', { userId, actorId: actorId ?? userId });
}

export async function getVpnStatus(userId: string): Promise<VpnStatus> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');

  const server = user.server_id ? await getServerById(user.server_id) : null;
  const fallback: VpnStatus = {
    connected: false, vpn_ip: null,
    server_name: env.VPN_SERVER_NAME, server_country: env.VPN_SERVER_COUNTRY,
    server_flag: null, transfer_rx: 0, transfer_tx: 0,
    latest_handshake: null, peer_enabled: false,
  };

  if (!user.wg_client_id) return { ...fallback, vpn_ip: user.wg_client_ip };

  try {
    const wg = server ? wgFor(server) : wgManager.getDefault();
    const wgClient = await wg.getClient(user.wg_client_id);
    if (!wgClient) return fallback;

    return {
      connected: wg.isConnected(wgClient),
      vpn_ip: wgClient.address,
      server_name: server?.name ?? env.VPN_SERVER_NAME,
      server_country: server?.country ?? env.VPN_SERVER_COUNTRY,
      server_flag: server?.flag ?? null,
      transfer_rx: wgClient.transferRx,
      transfer_tx: wgClient.transferTx,
      latest_handshake: wgClient.latestHandshakeAt,
      peer_enabled: wgClient.enabled,
    };
  } catch {
    return fallback;
  }
}

export async function getClientConfig(userId: string): Promise<string> {
  let user = await findById(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.wg_client_id) {
    user = await provisionVpnPeer(user, userId);
  }
  const server = user.server_id ? await getServerById(user.server_id) : null;
  const wg = server ? wgFor(server) : wgManager.getDefault();
  return wg.getConfig(user.wg_client_id!);
}

export async function getConnectedUsers() {
  const usersWithPeers = await query<User>(
    `SELECT u.*, s.name as server_name, s.country as server_country, s.flag as server_flag,
            s.host as server_host, s.port as server_port, s.wg_password
     FROM users u LEFT JOIN servers s ON u.server_id = s.id
     WHERE u.wg_client_id IS NOT NULL AND u.role = 'customer'`
  );

  const results = [];
  for (const u of usersWithPeers) {
    try {
      const row = u as unknown as { server_host: string; server_port: number; wg_password: string | null };
      const rawPw = row.wg_password;
      let decryptedPw: string | null = null;
      if (rawPw) { try { decryptedPw = decrypt(rawPw); } catch { decryptedPw = null; } }
      const wg = row.server_host
        ? wgManager.getInstance({
            url: `http://${row.server_host}:${row.server_port}`,
            password: decryptedPw ?? env.WGEASY_PASSWORD,
          })
        : wgManager.getDefault();

      const client = u.wg_client_id ? await wg.getClient(u.wg_client_id) : null;
      results.push({
        userId: u.id, email: u.email,
        full_name: u.full_name, vpn_ip: u.wg_client_ip ?? '',
        server_name: (u as unknown as { server_name: string }).server_name ?? env.VPN_SERVER_NAME,
        server_country: (u as unknown as { server_country: string }).server_country ?? env.VPN_SERVER_COUNTRY,
        connected: client ? wg.isConnected(client) : false,
        transfer_rx: client?.transferRx ?? 0,
        transfer_tx: client?.transferTx ?? 0,
        latest_handshake: client?.latestHandshakeAt ?? null,
      });
    } catch {
      results.push({
        userId: u.id, email: u.email, full_name: u.full_name,
        vpn_ip: u.wg_client_ip ?? '', server_name: env.VPN_SERVER_NAME,
        server_country: env.VPN_SERVER_COUNTRY, connected: false,
        transfer_rx: 0, transfer_tx: 0, latest_handshake: null,
      });
    }
  }
  return results;
}

export async function changeServer(userId: string, serverId: string): Promise<void> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');

  const newServer = await getServer(serverId);
  if (!newServer || !newServer.is_active) throw new AppError('Server not available', 400);

  if (user.server_id === serverId) return;

  // Remove peer from old server
  if (user.wg_client_id && user.server_id) {
    const oldServer = await getServer(user.server_id);
    if (oldServer) {
      try { await wgFor(oldServer).deleteClient(user.wg_client_id); } catch { /* may already be gone */ }
    }
  }

  // Clear WireGuard data — user must re-download config on new server
  await updateUser(userId, {
    server_id: serverId,
    wg_client_id: null,
    wg_client_ip: null,
    wg_public_key: null,
    wg_private_key: null,
    wg_preshared_key: null,
  });

  await logAction('vpn.server.changed', {
    userId,
    actorId: userId,
    details: { new_server: newServer.name, server_id: serverId },
  });
}

async function getServerById(id: string): Promise<ServerRecord | null> {
  return getServer(id);
}
