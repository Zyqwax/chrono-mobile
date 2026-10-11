import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;
type SocketStateListener = (connected: boolean) => void;
const listeners: Set<SocketStateListener> = new Set();

export const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'https://api.zyqwax.com';

export const getSocket = (): Socket | null => socket;

export const isSocketConnected = (): boolean => !!(socket && socket.connected);

export const subscribeSocketState = (listener: SocketStateListener) => {
  listeners.add(listener);
  listener(isSocketConnected());
  return () => {
    listeners.delete(listener);
  };
};

const notifyListeners = (connected: boolean) => {
  listeners.forEach((listener) => {
    try {
      listener(connected);
    } catch (e) {
      console.error('Socket state listener error:', e);
    }
  });
};

export const connectSocket = (token: string, serverUrl = SOCKET_URL): Socket => {
  if (socket) {
    socket.disconnect();
  }

  socket = io(serverUrl, {
    auth: {
      token,
    },
    transports: ['websocket', 'polling'],
    extraHeaders: {
      'ngrok-skip-browser-warning': 'true',
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
  });

  socket.on('connect', () => {
    console.log('⚡ Socket.io connected:', socket?.id);
    notifyListeners(true);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 Socket.io disconnected:', reason);
    notifyListeners(false);
  });

  socket.on('connect_error', (error) => {
    console.warn('⚠️ Socket.io connection error:', error.message);
    notifyListeners(false);
  });

  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    notifyListeners(false);
  }
};

