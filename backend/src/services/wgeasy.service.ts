import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { WgEasyClient } from '../types';
import { WgEasyError } from '../utils/errors';
import { logger } from '../utils/logger';

class WgEasyService {
  private client: AxiosInstance;
  private sessionCookie: string | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: env.WGEASY_URL,
      timeout: 10000,
      withCredentials: true,
    });
  }

  private async ensureSession(): Promise<void> {
    if (this.sessionCookie) return;
    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    try {
      const response = await this.client.post('/api/session', {
        password: env.WGEASY_PASSWORD,
      });
      const setCookie = response.headers['set-cookie'];
      if (setCookie) {
        this.sessionCookie = setCookie[0].split(';')[0];
        this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
      }
      logger.info('WireGuard: authenticated with wg-easy');
    } catch (err) {
      this.sessionCookie = null;
      throw new WgEasyError('Failed to authenticate with WireGuard server');
    }
  }

  private async request<T>(fn: () => Promise<T>): Promise<T> {
    await this.ensureSession();
    try {
      return await fn();
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        this.sessionCookie = null;
        await this.authenticate();
        return await fn();
      }
      throw err;
    }
  }

  async listClients(): Promise<WgEasyClient[]> {
    return this.request(async () => {
      const res = await this.client.get<WgEasyClient[]>('/api/wireguard/client');
      return res.data;
    });
  }

  async getClient(clientId: string): Promise<WgEasyClient | null> {
    const clients = await this.listClients();
    return clients.find((c) => c.id === clientId) ?? null;
  }

  async createClient(name: string): Promise<WgEasyClient> {
    return this.request(async () => {
      try {
        const res = await this.client.post<WgEasyClient>('/api/wireguard/client', { name });
        return res.data;
      } catch (err) {
        logger.error('WireGuard: failed to create client', { name });
        throw new WgEasyError('Failed to create WireGuard peer');
      }
    });
  }

  async deleteClient(clientId: string): Promise<void> {
    return this.request(async () => {
      try {
        await this.client.delete(`/api/wireguard/client/${clientId}`);
      } catch (err) {
        throw new WgEasyError('Failed to delete WireGuard peer');
      }
    });
  }

  async enableClient(clientId: string): Promise<void> {
    return this.request(async () => {
      try {
        await this.client.post(`/api/wireguard/client/${clientId}/enable`);
      } catch (err) {
        throw new WgEasyError('Failed to enable WireGuard peer');
      }
    });
  }

  async disableClient(clientId: string): Promise<void> {
    return this.request(async () => {
      try {
        await this.client.post(`/api/wireguard/client/${clientId}/disable`);
      } catch (err) {
        throw new WgEasyError('Failed to disable WireGuard peer');
      }
    });
  }

  async getClientConfig(clientId: string): Promise<string> {
    return this.request(async () => {
      try {
        const res = await this.client.get<string>(
          `/api/wireguard/client/${clientId}/configuration`
        );
        return res.data;
      } catch (err) {
        throw new WgEasyError('Failed to fetch WireGuard configuration');
      }
    });
  }

  async getClientQrCodeUrl(clientId: string): Promise<string> {
    return `${env.WGEASY_URL}/api/wireguard/client/${clientId}/qrcode.svg`;
  }

  isConnected(client: WgEasyClient): boolean {
    if (!client.latestHandshakeAt) return false;
    const lastSeen = new Date(client.latestHandshakeAt).getTime();
    const threeMinutesAgo = Date.now() - 3 * 60 * 1000;
    return lastSeen > threeMinutesAgo;
  }
}

export const wgEasyService = new WgEasyService();
