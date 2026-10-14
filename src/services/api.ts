import axios from 'axios';

// Expo'da telefondan test ederken localhost çalışmaz, bilgisayarın ağ IP'si gerekir.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.zyqwax.com/api';

type ApiStatusListener = (isOnline: boolean, errorMsg?: string) => void;
const apiListeners: Set<ApiStatusListener> = new Set();
let isApiReachable: boolean | null = null;

export const isApiConnected = (): boolean | null => isApiReachable;

export const subscribeApiState = (listener: ApiStatusListener) => {
  apiListeners.add(listener);
  if (isApiReachable !== null) {
    listener(isApiReachable);
  }
  return () => {
    apiListeners.delete(listener);
  };
};

const notifyApiStatus = (online: boolean, errorMsg?: string) => {
  isApiReachable = online;
  apiListeners.forEach((listener) => {
    try {
      listener(online, errorMsg);
    } catch (e) {
      console.error('API status listener error:', e);
    }
  });
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
    'ngrok-skip-browser-warning': 'true',
  },
});

// Interceptors to track connection health with automatic retry on GET timeouts
api.interceptors.response.use(
  (response) => {
    notifyApiStatus(true);
    return response;
  },
  async (error) => {
    const config = error.config;
    // Zaman aşımı veya geçici ağ kopmasında idempotent GET isteklerini 1 defa otomatik tekrar dene
    if (
      config &&
      config.method?.toLowerCase() === 'get' &&
      !config._retry &&
      (error.code === 'ECONNABORTED' || !error.response || error.message?.includes('Network Error'))
    ) {
      config._retry = true;
      await new Promise((r) => setTimeout(r, 1200));
      return api(config);
    }

    if (error.response?.status === 401) {
      const data = error.response.data;
      if (data?.code === 'SESSION_EXPIRED' || (typeof data?.message === 'string' && data.message.includes('sonlandırıldı'))) {
        triggerSessionExpired(data?.message || 'Oturumunuz başka bir cihazda açıldığı için sonlandırıldı.');
      }
    }

    if (!error.response || error.code === 'ECONNABORTED' || error.message?.includes('Network Error')) {
      notifyApiStatus(false, 'Sunucuya ulaşılamıyor (Ağ Hatası)');
    } else if (error.response?.status >= 500) {
      notifyApiStatus(false, `Sunucu Hatası (${error.response.status})`);
    } else {
      // 4xx client errors mean the server IS reachable
      notifyApiStatus(true);
    }
    return Promise.reject(error);
  },
);

type SessionExpiredListener = (reason?: string) => void;
const sessionExpiredListeners: Set<SessionExpiredListener> = new Set();

export const subscribeSessionExpired = (listener: SessionExpiredListener) => {
  sessionExpiredListeners.add(listener);
  return () => {
    sessionExpiredListeners.delete(listener);
  };
};

export const triggerSessionExpired = (reason?: string) => {
  sessionExpiredListeners.forEach((fn) => {
    try {
      fn(reason);
    } catch (e) {
      console.error('Session expired listener error:', e);
    }
  });
};

export const setAuthToken = (token: string | null) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete api.defaults.headers.common['Authorization'];
  }
};

/**
 * Ping the server /health endpoint to check server availability
 */
export const checkApiHealth = async (): Promise<{ ok: boolean; latencyMs?: number; error?: string }> => {
  const start = Date.now();
  try {
    await api.get('/health', { timeout: 4000 });
    const latencyMs = Date.now() - start;
    notifyApiStatus(true);
    return { ok: true, latencyMs };
  } catch (err: any) {
    // Fallback attempt with native fetch in case of Axios adapter issues
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${API_BASE_URL}/health`, {
        signal: controller.signal,
        headers: { 'ngrok-skip-browser-warning': 'true' },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const latencyMs = Date.now() - start;
        notifyApiStatus(true);
        return { ok: true, latencyMs };
      }
    } catch {
      // Ignore fallback error
    }
    const errorMsg = err.message || 'Sunucuya bağlanılamadı';
    notifyApiStatus(false, errorMsg);
    return { ok: false, error: errorMsg };
  }
};

