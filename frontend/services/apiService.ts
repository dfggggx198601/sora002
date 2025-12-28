// Backend API Service
// HARDCODED PRODUCTION URL for troubleshooting
const API_BASE_URL = 'https://sora-studio-backend-718161097168.us-central1.run.app';

class ApiService {
  private token: string | null = null;

  constructor() {
    // 从 localStorage 加载 token
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('auth_token', token);
  }

  clearToken() {
    this.token = null;
    localStorage.removeItem('auth_token');
  }

  getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}/api${endpoint}`;
    const config = {
      ...options,
      headers: {
        ...this.getHeaders(),
        ...options.headers,
      },
    };

    const response = await fetch(url, config);

    // 处理 401 (Unauthorized) 错误
    if (response.status === 401) {
      this.clearToken();
      // 如果不是在尝试登录或注册时发生的，则可能需要刷新页面或提示重连
      console.warn('Session expired or invalid token. Clearing credentials.');
      throw new Error('鉴权失效，请重新登录');
    }

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Request failed');
    }

    return data;
  }

  // 认证相关
  async register(email: string, password: string, username: string) {
    const data = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async login(email: string, password: string) {
    const data = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (data.token) {
      this.setToken(data.token);
    }

    return data;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  async buyQuota(packageId: string, provider: 'manual' | 'epay' = 'manual') {
    return this.request('/auth/buy-quota', {
      method: 'POST',
      body: JSON.stringify({ packageId, provider })
    });
  }

  // 任务相关
  async getTasks() {
    return this.request('/tasks');
  }

  async createTask(taskData: { type: string; prompt: string; model: string; imagePreviewUrl?: string }) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(taskData),
    });
  }

  async updateTask(taskId: string, updates: any) {
    return this.request(`/tasks/${taskId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteTask(taskId: string) {
    return this.request(`/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async clearTasks() {
    return this.request('/tasks', {
      method: 'DELETE',
    });
  }

  async syncTasks(tasks: any[], lastSyncTime: Date) {
    return this.request('/tasks/sync', {
      method: 'POST',
      body: JSON.stringify({ tasks, lastSyncTime }),
    });
  }

  async getQuota() {
    return this.request('/tasks/quota');
  }

  // 管理员相关
  async getAdminStats() {
    return this.request('/admin/stats');
  }

  async getUsers() {
    return this.request('/admin/users');
  }

  async updateUserAdmin(userId: string, updates: any) {
    return this.request(`/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async resetUserPassword(userId: string, newPassword: string) {
    return this.request(`/admin/users/${userId}/password`, {
      method: 'PUT',
      body: JSON.stringify({ newPassword }),
    });
  }

  async getAdminTasks() {
    return this.request('/admin/tasks');
  }

  async deleteAdminTask(taskId: string) {
    return this.request(`/admin/tasks/${taskId}`, {
      method: 'DELETE',
    });
  }

  async getSystemSettings() {
    return this.request('/settings');
  }

  async updateAdminSettings(settings: any) {
    return this.request('/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  }

  async getAdminOrders() {
    return this.request('/admin/orders');
  }

  async verifyOrder(orderId: string, action: 'approve' | 'reject') {
    return this.request(`/admin/orders/${orderId}/verify`, {
      method: 'PUT',
      body: JSON.stringify({ action }),
    });
  }

  // AI 代理服务
  async generateAiImage(prompt: string, model: string) {
    return this.request('/ai/image', {
      method: 'POST',
      body: JSON.stringify({ prompt, model })
    });
  }

  async chatWithAi(history: any[], message: string, model: string) {
    return this.request('/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ history, message, model })
    });
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();
