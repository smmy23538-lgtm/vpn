export type UserRole = 'admin' | 'customer';
export type UserStatus = 'active' | 'expired' | 'suspended';

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  activation_date: string;
  expiration_date: string;
  wg_client_id: string | null;
  wg_client_ip: string | null;
  server_id: string | null;
  country_id: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface VpnStatus {
  connected: boolean;
  vpn_ip: string | null;
  server_name: string;
  server_country: string;
  server_flag: string | null;
  transfer_rx: number;
  transfer_tx: number;
  latest_handshake: string | null;
  peer_enabled: boolean;
}

export interface Server {
  id: string;
  name: string;
  country: string;
  country_id: string | null;
  city: string | null;
  flag: string | null;
  host: string;
  port: number;
  wg_host: string;
  wg_port: number;
  status: 'online' | 'offline' | 'maintenance';
  is_active: boolean;
  max_users: number;
  latency_ms: number | null;
  description: string | null;
  current_users: number;
  created_at: string;
}

export interface Country {
  id: string;
  name: string;
  code: string;
  flag: string | null;
  region: string | null;
  is_active: boolean;
  sort_order: number;
  server_count: number;
  created_at: string;
}

export interface DashboardStats {
  total_users: number;
  active_users: number;
  online_users: number;
  expired_users: number;
  suspended_users: number;
  expiring_soon: number;
  new_users_this_month: number;
  total_servers: number;
  online_servers: number;
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  actor_id: string | null;
  action: string;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
  user_email?: string;
  actor_email?: string;
}

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string | null;
  is_read: boolean;
  severity: 'info' | 'warning' | 'error' | 'success';
  data: Record<string, unknown> | null;
  created_at: string;
}

export interface AnalyticsSummary {
  total_bandwidth_rx: number;
  total_bandwidth_tx: number;
  total_connections: number;
  avg_session_minutes: number;
  top_server: string | null;
  top_country: string | null;
  daily: {
    date: string;
    new_users: number;
    active_users: number;
    connections: number;
    bytes_rx: number;
    bytes_tx: number;
  }[];
  hourly_connections: { hour: number; count: number }[];
  status_breakdown: { status: string; count: number }[];
  expiring_this_week: number;
  new_users_this_month: number;
}

export interface BandwidthPoint {
  time: string;
  rx: number;
  tx: number;
  peers: number;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: User;
}
