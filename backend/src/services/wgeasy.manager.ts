import axios, { AxiosInstance } from 'axios';
import { WgEasyClient } from '../types';
import { WgEasyError } from '../utils/errors';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface WgEasyConfig {
  url: string;
  password: string;
}

class WgEasyInstance {
  private client: AxiosInstance;
  private sessionCookie: string | null = null;
  private readonly config: WgEasyConfig;

  constructor(config: WgEasyConfig) {
    this.config = config;
    this.client = axios.create({ baseURL: config.url, timeout: 10000 });
  }

  private async authenticate(): Promise<void> {
    const res = await this.client.post('/api/session', { password: this.config.password });
    const setCookie = res.headers['set-cookie'];
    if (setCookie) {
      this.sessionCookie = setCookie[0].split(';')[0];
      this.client.defaults.headers.common['Cookie'] = this.sessionCookie;
    }
  }

  private async req<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.sessionCookie) await this.authenticate();
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
    return this.req(async () => (await this.client.get<WgEasyClient[]>('/api/wireguard/client')).data);
  }

  async createClient(name: string): Promise<WgEasyClient> {
    return this.req(async () => {
      try {
        return (await this.client.post<WgEasyClient>('/api/wireguard/client', { name })).data;
      } catch { throw new WgEasyError('Failed to create WireGuard peer'); }
    });
  }

  async deleteClient(id: string): Promise<void> {
    return this.req(async () => {
      try { await this.client.delete(`/api/wireguard/client/${id}`); }
      catch { throw new WgEasyError('Failed to delete WireGuard peer'); }
    });
  }

  async enableClient(id: string): Promise<void> {
    return this.req(async () => {
      try { await this.client.post(`/api/wireguard/client/${id}/enable`); }
      catch { throw new WgEasyError('Failed to enable WireGuard peer'); }
    });
  }

  async disableClient(id: string): Promise<void> {
    return this.req(async () => {
      try { await this.client.post(`/api/wireguard/client/${id}/disable`); }
      catch { throw new WgEasyError('Failed to disable WireGuard peer'); }
    });
  }

  async getConfig(id: string): Promise<string> {
    return this.req(async () => {
      try { return (await this.client.get<string>(`/api/wireguard/client/${id}/configuration`)).data; }
      catch { throw new WgEasyError('Failed to fetch WireGuard config'); }
    });
  }

  async getClient(id: string): Promise<WgEasyClient | null> {
    const list = await this.listClients();
    return list.find((c) => c.id === id) ?? null;
  }

  isConnected(c: WgEasyClient): boolean {
    if (!c.latestHandshakeAt) return false;
    return Date.now() - new Date(c.latestHandshakeAt).getTime() < 3 * 60 * 1000;
  }

  async pingLatency(): Promise<number> {
    const start = Date.now();
    try {
      await this.client.get('/api/wireguard/client', { timeout: 5000 });
      return Date.now() - start;
    } catch {
      return -1;
    }
  }
}

class WgEasyManager {
  private instances = new Map<string, WgEasyInstance>();

  private key(cfg: WgEasyConfig): string {
    return cfg.url;
  }

  getInstance(cfg: WgEasyConfig): WgEasyInstance {
    const k = this.key(cfg);
    if (!this.instances.has(k)) {
      this.instances.set(k, new WgEasyInstance(cfg));
    }
    return this.instances.get(k)!;
  }

  getDefault(): WgEasyInstance {
    return this.getInstance({ url: env.WGEASY_URL, password: env.WGEASY_PASSWORD });
  }

  invalidate(url: string): void {
    this.instances.delete(url);
  }
}

export const wgManager = new WgEasyManager();
export { WgEasyInstance };
