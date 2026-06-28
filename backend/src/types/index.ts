export type UserRole = 'admin' | 'customer';
export type UserStatus = 'active' | 'expired' | 'suspended';

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  activation_date: Date;
  expiration_date: Date;
  wg_client_id: string | null;
  wg_client_ip: string | null;
  wg_public_key: string | null;
  wg_private_key: string | null;
  wg_preshared_key: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface PublicUser {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  activation_date: Date;
  expiration_date: Date;
  wg_client_id: string | null;
  wg_client_ip: string | null;
  created_at: Date;
  updated_at: Date;
  created_by: string | null;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface Server {
  id: string;
  name: string;
  country: string;
  city: string | null;
  flag: string | null;
  host: string;
  port: number;
  wg_host: string;
  wg_port: number;
  status: 'online' | 'offline' | 'maintenance';
  is_active: boolean;
  created_at: Date;
}

export interface WgEasyClient {
  id: string;
  name: string;
  address: string;
  publicKey: string;
  enabled: boolean;
  transferRx: number;
  transferTx: number;
  latestHandshakeAt: string | null;
}

export interface VpnStatus {
  connected: boolean;
  vpn_ip: string | null;
  server_name: string;
  server_country: string;
  transfer_rx: number;
  transfer_tx: number;
  latest_handshake: string | null;
  peer_enabled: boolean;
}

export interface JwtPayload {
  userId: string;
  role: UserRole;
  email: string;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  expired_users: number;
  suspended_users: number;
  expiring_soon: number;
  online_users: number;
}

export interface ServerMetrics {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  connected_peers: number;
  uptime_seconds: number;
}

export interface WebSocketMessage {
  type: 'vpn_status' | 'server_health' | 'notification' | 'ping';
  payload: unknown;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}
