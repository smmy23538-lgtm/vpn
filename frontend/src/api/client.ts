import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { ApiResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? '/api';

class ApiClient {
  private http: AxiosInstance;

  constructor() {
    this.http = axios.create({ baseURL: BASE_URL, timeout: 15000 });

    this.http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
      const token = localStorage.getItem('accessToken');
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    });

    this.http.interceptors.response.use(
      (res) => res,
      async (err) => {
        const original = err.config;
        if (err.response?.status === 401 && !original._retry) {
          original._retry = true;
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken) {
            try {
              const { data } = await axios.post<ApiResponse<{ accessToken: string }>>(
                `${BASE_URL}/auth/refresh`,
                { refreshToken }
              );
              const newToken = data.data?.accessToken;
              if (newToken) {
                localStorage.setItem('accessToken', newToken);
                original.headers.Authorization = `Bearer ${newToken}`;
                return this.http(original);
              }
            } catch {
              this.clearTokens();
              window.location.href = '/login';
            }
          } else {
            this.clearTokens();
            window.location.href = '/login';
          }
        }
        return Promise.reject(err);
      }
    );
  }

  private clearTokens(): void {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }

  async get<T>(url: string, params?: Record<string, unknown>): Promise<T> {
    const { data } = await this.http.get<ApiResponse<T>>(url, { params });
    return data.data as T;
  }

  async post<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.http.post<ApiResponse<T>>(url, body);
    return data.data as T;
  }

  async put<T>(url: string, body?: unknown): Promise<T> {
    const { data } = await this.http.put<ApiResponse<T>>(url, body);
    return data.data as T;
  }

  async delete<T>(url: string): Promise<T> {
    const { data } = await this.http.delete<ApiResponse<T>>(url);
    return data.data as T;
  }

  async getRaw(url: string): Promise<string> {
    const { data } = await this.http.get<string>(url, { responseType: 'text' });
    return data;
  }
}

export const api = new ApiClient();
