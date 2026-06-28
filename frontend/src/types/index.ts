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
  created_at: string;
  updated_at: string;
  created_by: string | null;
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

export interface DashboardStats {
  total_users: number;
  active_users: number;
  expired_users: number;
  suspended_users: number;
  expiring_soon: number;
  online_users: number;
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

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
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
