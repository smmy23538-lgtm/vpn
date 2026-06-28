import { wgEasyService } from './wgeasy.service';
import { updateUser, findById } from './user.service';
import { logAction } from './audit.service';
import { query } from '../config/database';
import { VpnStatus, User } from '../types';
import { env } from '../config/env';
import { encrypt, decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { AppError, NotFoundError } from '../utils/errors';

export async function provisionVpnPeer(user: User, actorId?: string): Promise<User> {
  if (user.wg_client_id) {
    logger.info('VPN peer already exists for user', { userId: user.id });
    await wgEasyService.enableClient(user.wg_client_id);
    return user;
  }

  const wgClient = await wgEasyService.createClient(user.email);

  const config = await wgEasyService.getClientConfig(wgClient.id);
  const privateKeyMatch = config.match(/PrivateKey\s*=\s*(.+)/);
  const presharedKeyMatch = config.match(/PresharedKey\s*=\s*(.+)/);

  const privateKey = privateKeyMatch?.[1]?.trim() ?? '';
  const presharedKey = presharedKeyMatch?.[1]?.trim() ?? '';

  const updated = await updateUser(user.id, {
    wg_client_id: wgClient.id,
    wg_client_ip: wgClient.address,
    wg_public_key: wgClient.publicKey,
    wg_private_key: privateKey ? encrypt(privateKey) : null,
    wg_preshared_key: presharedKey ? encrypt(presharedKey) : null,
  });

  await logAction('vpn.peer.created', {
    userId: user.id,
    actorId: actorId ?? user.id,
    details: { wg_client_id: wgClient.id, vpn_ip: wgClient.address },
  });

  logger.info('VPN peer provisioned', { userId: user.id, vpnIp: wgClient.address });
  return updated;
}

export async function removeVpnPeer(userId: string, actorId?: string): Promise<void> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.wg_client_id) return;

  await wgEasyService.deleteClient(user.wg_client_id);
  await updateUser(userId, {
    wg_client_id: null,
    wg_client_ip: null,
    wg_public_key: null,
    wg_private_key: null,
    wg_preshared_key: null,
  });

  await logAction('vpn.peer.deleted', {
    userId,
    actorId: actorId ?? userId,
    details: { wg_client_id: user.wg_client_id },
  });
}

export async function enableVpnAccess(userId: string, actorId?: string): Promise<void> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.wg_client_id) throw new AppError('No VPN peer configured for this user', 400);

  await wgEasyService.enableClient(user.wg_client_id);
  await logAction('vpn.access.enabled', { userId, actorId: actorId ?? userId });
}

export async function disableVpnAccess(userId: string, actorId?: string): Promise<void> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.wg_client_id) return;

  await wgEasyService.disableClient(user.wg_client_id);
  await logAction('vpn.access.disabled', { userId, actorId: actorId ?? userId });
}

export async function getVpnStatus(userId: string): Promise<VpnStatus> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');

  if (!user.wg_client_id) {
    return {
      connected: false,
      vpn_ip: null,
      server_name: env.VPN_SERVER_NAME,
      server_country: env.VPN_SERVER_COUNTRY,
      transfer_rx: 0,
      transfer_tx: 0,
      latest_handshake: null,
      peer_enabled: false,
    };
  }

  const wgClient = await wgEasyService.getClient(user.wg_client_id);
  if (!wgClient) {
    return {
      connected: false,
      vpn_ip: user.wg_client_ip,
      server_name: env.VPN_SERVER_NAME,
      server_country: env.VPN_SERVER_COUNTRY,
      transfer_rx: 0,
      transfer_tx: 0,
      latest_handshake: null,
      peer_enabled: false,
    };
  }

  return {
    connected: wgEasyService.isConnected(wgClient),
    vpn_ip: wgClient.address,
    server_name: env.VPN_SERVER_NAME,
    server_country: env.VPN_SERVER_COUNTRY,
    transfer_rx: wgClient.transferRx,
    transfer_tx: wgClient.transferTx,
    latest_handshake: wgClient.latestHandshakeAt,
    peer_enabled: wgClient.enabled,
  };
}

export async function getClientConfig(userId: string): Promise<string> {
  const user = await findById(userId);
  if (!user) throw new NotFoundError('User');
  if (!user.wg_client_id) throw new AppError('No VPN peer configured', 400);
  return wgEasyService.getClientConfig(user.wg_client_id);
}

export async function getConnectedUsers(): Promise<
  Array<{ userId: string; email: string; vpn_ip: string; connected: boolean; transfer_rx: number; transfer_tx: number }>
> {
  const usersWithPeers = await query<User>(
    `SELECT * FROM users WHERE wg_client_id IS NOT NULL AND role = 'customer'`
  );

  const wgClients = await wgEasyService.listClients();
  const clientMap = new Map(wgClients.map((c) => [c.id, c]));

  return usersWithPeers.map((u) => {
    const wg = u.wg_client_id ? clientMap.get(u.wg_client_id) : undefined;
    return {
      userId: u.id,
      email: u.email,
      vpn_ip: u.wg_client_ip ?? '',
      connected: wg ? wgEasyService.isConnected(wg) : false,
      transfer_rx: wg?.transferRx ?? 0,
      transfer_tx: wg?.transferTx ?? 0,
    };
  });
}

export async function getDecryptedConfig(user: User): Promise<{
  privateKey: string;
  publicKey: string;
  presharedKey: string;
  vpnIp: string;
  serverPublicKey: string;
  serverEndpoint: string;
  dns: string;
} | null> {
  if (!user.wg_client_id || !user.wg_private_key) return null;

  const configRaw = await wgEasyService.getClientConfig(user.wg_client_id);
  const serverPublicKeyMatch = configRaw.match(/PublicKey\s*=\s*(.+)/g);
  const dnsMatch = configRaw.match(/DNS\s*=\s*(.+)/);

  return {
    privateKey: user.wg_private_key ? decrypt(user.wg_private_key) : '',
    publicKey: user.wg_public_key ?? '',
    presharedKey: user.wg_preshared_key ? decrypt(user.wg_preshared_key) : '',
    vpnIp: user.wg_client_ip ?? '',
    serverPublicKey: serverPublicKeyMatch?.[1]?.replace('PublicKey = ', '').trim() ?? '',
    serverEndpoint: `${env.VPN_SERVER_HOST}:${env.VPN_SERVER_PORT}`,
    dns: dnsMatch?.[1]?.trim() ?? '1.1.1.1',
  };
}
