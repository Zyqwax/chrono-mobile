import { create } from 'zustand';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Contact,
  IncomingCall,
  Message,
  Room,
  User,
  UserSettings,
  VoiceParticipant,
} from '../types';
import { connectSocket, disconnectSocket, getSocket } from '../services/socket';
import { api, setAuthToken, API_BASE_URL } from '../services/api';
import { notificationService } from '../services/notifications';
import { liveKitService } from '../services/livekit';

const STORAGE_TOKEN_KEY = '@chrono_auth_token';
const STORAGE_USER_KEY = '@chrono_auth_user';

interface ChatStore {
  // Auth & Profile state
  currentUser: User | null;
  token: string | null;
  isAuthLoading: boolean;
  initAuth: () => Promise<void>;
  setAuth: (user: User | null, token: string | null) => void;
  logout: () => void;
  fetchMe: () => Promise<void>;
  updateProfile: (data: {
    displayName?: string;
    username?: string;
    bio?: string;
    birthday?: string | null;
  }) => Promise<User>;
  uploadAvatar: (formData: FormData) => Promise<User>;
  removeAvatar: () => Promise<User>;

  // User Settings state
  settings: UserSettings | null;
  fetchSettings: () => Promise<void>;
  updateSettings: (data: Partial<UserSettings>) => Promise<void>;

  // Contacts state
  contacts: Contact[];
  fetchContacts: () => Promise<void>;
  addContact: (userId: string, nickname?: string) => Promise<Contact>;
  removeContact: (userId: string) => Promise<void>;

  // Rooms state
  rooms: Room[];
  setRooms: (rooms: Room[]) => void;
  activeRoom: Room | null;
  setActiveRoom: (room: Room | null) => void;
  fetchRooms: () => Promise<void>;
  fetchRoomById: (roomId: string) => Promise<Room | null>;
  openDirect: (userId: string) => Promise<Room>;
  togglePinRoom: (roomId: string) => Promise<void>;
  toggleMuteRoom: (roomId: string) => Promise<void>;
  deleteRoom: (roomId: string, forEveryone?: boolean) => Promise<void>;
  clearRoomHistory: (roomId: string) => Promise<void>;
  uploadTempRoomIcon: (formData: FormData) => Promise<{ iconUrl: string }>;
  uploadRoomIcon: (roomId: string, formData: FormData) => Promise<Room>;
  removeRoomIcon: (roomId: string) => Promise<Room>;

  // Messages state
  messages: Message[];
  roomMessages: Record<string, Message[]>;
  setMessages: (messages: Message[]) => void;
  addMessage: (message: Message) => void;
  fetchMessages: (roomId: string, before?: string) => Promise<boolean>;
  sendMessage: (
    roomId: string,
    content: string,
    replyToId?: string,
  ) => Promise<void>;
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  markAsRead: (roomId: string) => Promise<void>;
  typingUsers: { userId: string; displayName: string }[];
  sendTyping: (roomId: string, isTyping: boolean) => void;

  // Group Voice state (Sohbet Odası sesli sohbeti)
  activeVoiceRoomId: string | null;
  voiceParticipants: VoiceParticipant[];
  roomVoiceStates: Record<string, { participants: string[]; count: number }>;
  isMuted: boolean;
  isVideoOn: boolean;
  joinRoomVoice: (roomId: string) => Promise<void> | void;
  leaveRoomVoice: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;

  // DM Arama state
  activeCall: IncomingCall | null;
  startCall: (roomId: string, video?: boolean) => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  declineCall: (callId: string) => Promise<void>;
  endCall: (callId: string) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  currentUser: null,
  token: null,
  isAuthLoading: true,

  initAuth: async () => {
    try {
      const [token, userStr] = await Promise.all([
        AsyncStorage.getItem(STORAGE_TOKEN_KEY),
        AsyncStorage.getItem(STORAGE_USER_KEY),
      ]);

      if (token && userStr) {
        const user = JSON.parse(userStr) as User;
        get().setAuth(user, token);
        // Sunucudan en güncel profil ve ayarları çek
        get().fetchMe().catch(() => undefined);
        get().fetchSettings().catch(() => undefined);
        notificationService.init().catch(console.warn);
      } else {
        notificationService.init().catch(console.warn);
      }
    } catch (err) {
      console.error('AsyncStorage initAuth error:', err);
    } finally {
      set({ isAuthLoading: false });
    }
  },

  setAuth: (user, token) => {
    set({ currentUser: user, token });
    setAuthToken(token);

    if (token && user) {
      AsyncStorage.setItem(STORAGE_TOKEN_KEY, token).catch(console.error);
      AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(user)).catch(console.error);
    } else {
      AsyncStorage.removeItem(STORAGE_TOKEN_KEY).catch(console.error);
      AsyncStorage.removeItem(STORAGE_USER_KEY).catch(console.error);
    }

    if (token) {
      const socket = connectSocket(token);

      // 1. Yeni mesaj geldiğinde
      socket.on('new_message', (message: Message) => {
        const { activeRoom, addMessage, rooms } = get();
        // Odaya ait mesaj havuzuna her durumda ekle (ekran kapalı veya arka planda olsa bile)
        addMessage(message);

        if (activeRoom && message.roomId === activeRoom.id) {
          // Açık odadaysak hemen okundu bildir
          get().markAsRead(activeRoom.id);
        }

        // Sohbet listesindeki son mesaj ve okunmamış sayısını güncelle
        set({
          rooms: rooms.map((r) => {
            if (r.id === message.roomId) {
              const isCurrentOpen = activeRoom?.id === r.id;
              const isMine = message.senderId === get().currentUser?.id;
              return {
                ...r,
                lastMessage: message,
                lastMessageAt: message.createdAt,
                unreadCount: isCurrentOpen || isMine ? r.unreadCount : (r.unreadCount || 0) + 1,
              };
            }
            return r;
          }),
        });

        // Başkasından gelen mesajlarda bildirim göster (aktif olarak o odada değilsek)
        const myId = get().currentUser?.id;
        if (message.senderId !== myId && activeRoom?.id !== message.roomId) {
          const senderName = message.sender?.displayName || message.sender?.username || 'Yeni Mesaj';

          // Arama geçmişi bildirimlerini filtrele ve düzenle
          if (message.type === 'CALL') {
            try {
              const callData =
                typeof message.content === 'string' && message.content.startsWith('{')
                  ? JSON.parse(message.content)
                  : null;

              // Normal tamamlanan (status === 'ended') aramalarda kullanıcı zaten görüşmedeydi, bildirim basma
              if (callData?.status === 'ended') {
                return;
              }

              // Cevapsız veya meşgul/reddedilen aramalarda kullanıcı dostu bildirim göster
              if (
                callData &&
                (callData.status === 'missed' ||
                  callData.status === 'declined' ||
                  callData.status === 'busy' ||
                  callData.status === 'cancelled')
              ) {
                const callText = callData.video
                  ? '📹 Cevapsız görüntülü arama'
                  : '📞 Cevapsız sesli arama';
                notificationService.showMessageNotification(senderName, callText, message.roomId);
              }
            } catch {
              // yut
            }
            return;
          }

          if (message.type === 'IMAGE') {
            notificationService.showMessageNotification(senderName, '📷 Fotoğraf', message.roomId);
            return;
          }

          notificationService.showMessageNotification(senderName, message.content, message.roomId);
        }
      });

      // 2. Mesaj güncellendiğinde (düzenlendi veya silindi)
      socket.on('message_updated', (updatedMessage: Message) => {
        const { messages, rooms, roomMessages } = get();
        const roomId = updatedMessage.roomId;
        const currentRoomMsgs = roomMessages[roomId] || [];
        const updatedRoomMsgs = currentRoomMsgs.map((m) =>
          m.id === updatedMessage.id ? updatedMessage : m,
        );

        set({
          roomMessages: {
            ...roomMessages,
            [roomId]: updatedRoomMsgs,
          },
          messages: messages.map((m) =>
            m.id === updatedMessage.id ? updatedMessage : m,
          ),
          rooms: rooms.map((r) => {
            if (r.lastMessage?.id === updatedMessage.id) {
              return { ...r, lastMessage: updatedMessage };
            }
            return r;
          }),
        });
      });

      // 3. Oda canlı güncellemesi (room_upsert)
      socket.on('room_upsert', (incomingRoom: Room) => {
        const { rooms, activeRoom } = get();
        const exists = rooms.some((r) => r.id === incomingRoom.id);
        const updatedRooms = exists
          ? rooms.map((r) => (r.id === incomingRoom.id ? { ...r, ...incomingRoom } : r))
          : [incomingRoom, ...rooms];

        set({ rooms: updatedRooms });
        if (activeRoom && activeRoom.id === incomingRoom.id) {
          set({ activeRoom: { ...activeRoom, ...incomingRoom } });
        }
      });

      // 4. Oda silindiğinde veya ayrılındığında (room_removed)
      socket.on('room_removed', ({ roomId }: { roomId: string }) => {
        const { rooms, activeRoom } = get();
        set({ rooms: rooms.filter((r) => r.id !== roomId) });
        if (activeRoom?.id === roomId) {
          set({ activeRoom: null, messages: [] });
        }
      });

      // 5. Okundu bilgisi senkronizasyonu
      socket.on('room_read', ({ roomId, unreadCount }: { roomId: string; unreadCount: number }) => {
        set((state) => {
          const target = state.rooms.find((r) => r.id === roomId);
          if (!target || (target.unreadCount || 0) === (unreadCount || 0)) return state;
          return {
            rooms: state.rooms.map((r) =>
              r.id === roomId ? { ...r, unreadCount } : r,
            ),
          };
        });
      });

      // Karşı tarafın okuduğu bilgisi (✓✓)
      socket.on('messages_read', ({ roomId, readAt }: { roomId: string; readAt: string }) => {
        set((state) => ({
          rooms: state.rooms.map((r) =>
            r.id === roomId ? { ...r, othersReadAt: readAt } : r,
          ),
        }));
      });

      // 6. Yazıyor göstergesi
      socket.on(
        'user_typing',
        (data: { roomId: string; userId: string; displayName: string; isTyping: boolean }) => {
          const { activeRoom, typingUsers } = get();
          if (activeRoom && data.roomId === activeRoom.id) {
            if (data.isTyping) {
              const already = typingUsers.some((u) => u.userId === data.userId);
              if (!already) {
                set({
                  typingUsers: [
                    ...typingUsers,
                    { userId: data.userId, displayName: data.displayName },
                  ],
                });
              }
            } else {
              set({
                typingUsers: typingUsers.filter((u) => u.userId !== data.userId),
              });
            }
          }
        },
      );

      // 7. Kullanıcı çevrimiçi / çevrimdışı durumu
      socket.on('user_status_changed', (data: { userId: string; status: any; lastSeenAt: string | null }) => {
        set((state) => ({
          rooms: state.rooms.map((r) => {
            if (r.peer && r.peer.id === data.userId) {
              return {
                ...r,
                peer: { ...r.peer, status: data.status, lastSeenAt: data.lastSeenAt },
              };
            }
            return r;
          }),
          contacts: state.contacts.map((c) => {
            if (c.user.id === data.userId) {
              return {
                ...c,
                user: { ...c.user, status: data.status, lastSeenAt: data.lastSeenAt },
              };
            }
            return c;
          }),
        }));
      });

      // 8. Kendi profilim güncellendiğinde
      socket.on('me_updated', (updatedMe: User) => {
        set({ currentUser: updatedMe });
        AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(updatedMe)).catch(console.error);
      });

      // 9. DM Arama Olayları
      socket.on('call_incoming', (call: IncomingCall) => {
        set({ activeCall: call });
        const callerName = call.caller?.displayName || call.caller?.username || 'Kullanıcı';
        notificationService.showCallNotification(callerName, call.video, call.callId);
      });

      socket.on('call_outgoing', (call: IncomingCall) => {
        set({ activeCall: call });
      });

      socket.on('call_accepted', (call: IncomingCall) => {
        set({ activeCall: { ...call, state: 'active' } });
        notificationService.dismissCallNotification();
      });

      socket.on('call_ended', () => {
        set({ activeCall: null });
        notificationService.dismissCallNotification();
        notificationService.dismissOngoingCallNotification();
      });

      // 10. Grup sesli sohbet durumu (Odalardaki sesli sohbet)
      socket.on(
        'voice_state_updated',
        (data: {
          roomId: string;
          participants: string[];
          participantUsers?: any[];
          userJoined?: User;
          userLeftId?: string;
        }) => {
          const { activeVoiceRoomId, voiceParticipants, currentUser, rooms, roomVoiceStates, isMuted, isVideoOn } = get();

          // Odanın canlı sesli sohbet durumunu güncelle (sohbette görünsün)
          const updatedStates = {
            ...roomVoiceStates,
            [data.roomId]: {
              participants: data.participants || [],
              count: data.participants?.length || 0,
            },
          };
          set({ roomVoiceStates: updatedStates });

          if (activeVoiceRoomId === data.roomId) {
            if (data.participantUsers && Array.isArray(data.participantUsers)) {
              // Sunucu tüm odadaki katılımcıları eksiksiz yolladığında:
              const mapped: VoiceParticipant[] = data.participantUsers.map((u: any) => ({
                id: u.id,
                userId: u.id,
                displayName: u.displayName || u.username || 'Katılımcı',
                avatarUrl: u.avatarUrl,
                isSpeaking: false,
                isMuted: u.id === currentUser?.id ? isMuted : false,
                isVideoOn: u.id === currentUser?.id ? isVideoOn : false,
              }));
              if (currentUser && !mapped.some((p) => p.userId === currentUser.id)) {
                mapped.unshift({
                  id: currentUser.id,
                  userId: currentUser.id,
                  displayName: currentUser.displayName || 'Ben',
                  avatarUrl: currentUser.avatarUrl,
                  isSpeaking: false,
                  isMuted,
                  isVideoOn,
                });
              }
              set({ voiceParticipants: mapped });
            } else if (data.userJoined && data.userJoined.id !== currentUser?.id) {
              const exists = voiceParticipants.some((p) => p.userId === data.userJoined!.id);
              if (!exists) {
                set({
                  voiceParticipants: [
                    ...voiceParticipants,
                    {
                      id: data.userJoined.id,
                      userId: data.userJoined.id,
                      displayName: data.userJoined.displayName,
                      avatarUrl: data.userJoined.avatarUrl,
                      isSpeaking: false,
                      isMuted: false,
                      isVideoOn: false,
                    },
                  ],
                });
              }
            } else if (data.userLeftId) {
              set({
                voiceParticipants: voiceParticipants.filter((p) => p.userId !== data.userLeftId),
              });
            }
          }
        },
      );
    } else {
      disconnectSocket();
    }
  },

  logout: () => {
    disconnectSocket();
    setAuthToken(null);
    AsyncStorage.removeItem(STORAGE_TOKEN_KEY).catch(console.error);
    AsyncStorage.removeItem(STORAGE_USER_KEY).catch(console.error);
    set({
      currentUser: null,
      token: null,
      rooms: [],
      activeRoom: null,
      messages: [],
      roomMessages: {},
      contacts: [],
      settings: null,
      activeVoiceRoomId: null,
      voiceParticipants: [],
      roomVoiceStates: {},
      activeCall: null,
    });
  },

  fetchMe: async () => {
    if (!get().token) return;
    try {
      const res = await api.get('/users/me');
      set({ currentUser: res.data });
      AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.data)).catch(console.error);
    } catch (err: any) {
      if (err?.response?.status === 401) {
        get().logout();
      } else {
        console.warn('fetchMe error:', err?.message || err);
      }
    }
  },

  updateProfile: async (data) => {
    const res = await api.patch('/users/me', data);
    set({ currentUser: res.data });
    AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.data)).catch(console.error);
    return res.data;
  },

  uploadAvatar: async (formData) => {
    const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/users/me/avatar`);
      xhr.timeout = 60000;

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            set({ currentUser: data });
            AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(data)).catch(console.error);
            resolve(data);
          } catch (e) {
            reject(new Error('Sunucu yanıtı okunamadı'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData?.message || `Yükleme hatası (${xhr.status})`));
          } catch {
            reject(new Error(`Yükleme hatası (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Ağ bağlantısı hatası: Sunucuya ulaşılamadı'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Fotoğraf yükleme zaman aşımına uğradı (60s)'));
      };

      xhr.send(formData);
    });
  },

  removeAvatar: async () => {
    const res = await api.delete('/users/me/avatar');
    set({ currentUser: res.data });
    AsyncStorage.setItem(STORAGE_USER_KEY, JSON.stringify(res.data)).catch(console.error);
    return res.data;
  },

  // Settings
  settings: null,
  fetchSettings: async () => {
    if (!get().token) return;
    try {
      const res = await api.get('/users/me/settings');
      set({ settings: res.data });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        get().logout();
      } else {
        console.warn('fetchSettings error:', err?.message || err);
      }
    }
  },

  updateSettings: async (data) => {
    try {
      const res = await api.patch('/users/me/settings', data);
      set({ settings: res.data });
    } catch (err) {
      console.error('updateSettings error:', err);
    }
  },

  // Contacts
  contacts: [],
  fetchContacts: async () => {
    if (!get().token) return;
    try {
      const res = await api.get('/contacts');
      set({ contacts: res.data });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        get().logout();
      } else {
        console.warn('fetchContacts error:', err?.message || err);
      }
    }
  },

  addContact: async (userId, nickname) => {
    const res = await api.post('/contacts', { userId, nickname });
    set((state) => ({ contacts: [res.data, ...state.contacts] }));
    return res.data;
  },

  removeContact: async (userId) => {
    await api.delete(`/contacts/${userId}`);
    set((state) => ({
      contacts: state.contacts.filter((c) => c.user.id !== userId),
    }));
  },

  // Rooms
  rooms: [],
  setRooms: (rooms) => set({ rooms }),
  activeRoom: null,

  setActiveRoom: (room) => {
    const socket = getSocket();
    const prev = get().activeRoom;
    if (socket && prev && prev.id !== room?.id) {
      socket.emit('leave_room', { roomId: prev.id });
    }
    // Önceki yüklenmiş önbellek mesajlarını anında getir (0ms gecikme)
    const cached = room ? get().roomMessages[room.id] || [] : [];
    set({ activeRoom: room, messages: cached, typingUsers: [] });
    if (socket && room) {
      socket.emit('join_room', { roomId: room.id });
      get().markAsRead(room.id);
    }
  },

  fetchRooms: async () => {
    if (!get().token) return;
    try {
      const res = await api.get('/rooms');
      const rooms: Room[] = res.data;
      set((state) => {
        const updatedRoomMessages = { ...state.roomMessages };
        for (const r of rooms) {
          if (r.lastMessage && (!updatedRoomMessages[r.id] || updatedRoomMessages[r.id].length === 0)) {
            updatedRoomMessages[r.id] = [r.lastMessage];
          }
        }
        return { rooms, roomMessages: updatedRoomMessages };
      });
    } catch (err: any) {
      if (err?.response?.status === 401) {
        get().logout();
      } else {
        console.warn('fetchRooms error:', err?.message || err);
      }
    }
  },

  fetchRoomById: async (roomId: string) => {
    if (!get().token) return null;
    try {
      const res = await api.get(`/rooms/${roomId}`);
      const room: Room = res.data;
      set((state) => {
        const exists = state.rooms.some((r) => r.id === room.id);
        const updatedRooms = exists
          ? state.rooms.map((r) => (r.id === room.id ? room : r))
          : [room, ...state.rooms];
        const updatedRoomMessages = { ...state.roomMessages };
        if (room.lastMessage && (!updatedRoomMessages[room.id] || updatedRoomMessages[room.id].length === 0)) {
          updatedRoomMessages[room.id] = [room.lastMessage];
        }
        return { rooms: updatedRooms, roomMessages: updatedRoomMessages };
      });
      return room;
    } catch (err: any) {
      console.warn('fetchRoomById error:', err?.message || err);
      return null;
    }
  },

  openDirect: async (userId: string) => {
    const res = await api.post('/rooms/direct', { userId });
    const directRoom = res.data as Room;
    // Odayı listeye yerleştir
    const { rooms } = get();
    if (!rooms.some((r) => r.id === directRoom.id)) {
      set({ rooms: [directRoom, ...rooms] });
    }
    return directRoom;
  },

  togglePinRoom: async (roomId: string) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return;
    const isPinned = !room.isPinned;
    await api.patch(`/rooms/${roomId}/membership`, { isPinned });
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, isPinned } : r)),
    }));
  },

  toggleMuteRoom: async (roomId: string) => {
    const room = get().rooms.find((r) => r.id === roomId);
    if (!room) return;
    const isMuted = !room.isMuted;
    const mutedUntil = isMuted ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString() : null;
    await api.patch(`/rooms/${roomId}/membership`, { mutedUntil });
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, isMuted, mutedUntil } : r)),
    }));
  },

  deleteRoom: async (roomId: string, forEveryone = false) => {
    await api.delete(`/rooms/${roomId}`, { params: { forEveryone } });
    set((state) => ({
      rooms: state.rooms.filter((r) => r.id !== roomId),
    }));
  },

  clearRoomHistory: async (roomId: string) => {
    await api.post(`/rooms/${roomId}/clear`);
    set((state) => {
      const nextRoomMessages = { ...state.roomMessages };
      delete nextRoomMessages[roomId];
      return {
        roomMessages: nextRoomMessages,
        messages: state.activeRoom?.id === roomId ? [] : state.messages,
        rooms: state.rooms.map((r) =>
          r.id === roomId ? { ...r, lastMessage: null, unreadCount: 0 } : r,
        ),
      };
    });
  },

  uploadTempRoomIcon: async (formData) => {
    const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/rooms/upload-icon`);
      xhr.timeout = 60000;

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            resolve(data);
          } catch (e) {
            reject(new Error('Sunucu yanıtı okunamadı'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData?.message || `Yükleme hatası (${xhr.status})`));
          } catch {
            reject(new Error(`Yükleme hatası (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Ağ bağlantısı hatası: Sunucuya ulaşılamadı'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Görsel yükleme zaman aşımına uğradı (60s)'));
      };

      xhr.send(formData);
    });
  },

  uploadRoomIcon: async (roomId, formData) => {
    const token = await AsyncStorage.getItem(STORAGE_TOKEN_KEY);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE_URL}/rooms/${roomId}/icon`);
      xhr.timeout = 60000;

      if (token) {
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      }
      xhr.setRequestHeader('ngrok-skip-browser-warning', 'true');

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data: Room = JSON.parse(xhr.responseText);
            set((state) => ({
              rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, ...data } : r)),
              activeRoom:
                state.activeRoom?.id === roomId ? { ...state.activeRoom, ...data } : state.activeRoom,
            }));
            resolve(data);
          } catch (e) {
            reject(new Error('Sunucu yanıtı okunamadı'));
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            reject(new Error(errData?.message || `Yükleme hatası (${xhr.status})`));
          } catch {
            reject(new Error(`Yükleme hatası (${xhr.status})`));
          }
        }
      };

      xhr.onerror = () => {
        reject(new Error('Ağ bağlantısı hatası: Sunucuya ulaşılamadı'));
      };

      xhr.ontimeout = () => {
        reject(new Error('Görsel yükleme zaman aşımına uğradı (60s)'));
      };

      xhr.send(formData);
    });
  },

  removeRoomIcon: async (roomId) => {
    const res = await api.delete(`/rooms/${roomId}/icon`);
    const data: Room = res.data;
    set((state) => ({
      rooms: state.rooms.map((r) => (r.id === roomId ? { ...r, ...data } : r)),
      activeRoom:
        state.activeRoom?.id === roomId ? { ...state.activeRoom, ...data } : state.activeRoom,
    }));
    return data;
  },

  // Messages
  messages: [],
  roomMessages: {},
  setMessages: (messages) => set({ messages }),
  addMessage: (message) => {
    set((state) => {
      const roomId = message.roomId;
      const roomMsgs = state.roomMessages[roomId] || [];
      const existsInRoom = roomMsgs.some((m) => m.id === message.id);
      const updatedRoomMsgs = existsInRoom ? roomMsgs : [message, ...roomMsgs];

      const existsInActive = state.messages.some((m) => m.id === message.id);
      const isTargetRoomActive =
        state.activeRoom?.id === roomId ||
        (!state.activeRoom && state.messages.some((m) => m.roomId === roomId));
      const updatedActiveMsgs =
        isTargetRoomActive && !existsInActive
          ? [message, ...state.messages]
          : state.messages;

      return {
        roomMessages: {
          ...state.roomMessages,
          [roomId]: updatedRoomMsgs,
        },
        messages: updatedActiveMsgs,
      };
    });
  },

  fetchMessages: async (roomId: string, before?: string): Promise<boolean> => {
    try {
      const res = await api.get(`/messages/room/${roomId}`, {
        params: { limit: 40, before },
      });
      const newMessages: Message[] = res.data || [];

      set((state) => {
        const existingForRoom = state.roomMessages[roomId] || [];
        let mergedRoomMessages: Message[];

        if (before) {
          const existingIds = new Set(existingForRoom.map((m) => m.id));
          const filteredNew = newMessages.filter((m) => !existingIds.has(m.id));
          mergedRoomMessages = [...existingForRoom, ...filteredNew];
        } else {
          // İlk yükleme: gelen sunucu mesajları ile varsa yerel soket/optimistik mesajları birleştir
          const newIds = new Set(newMessages.map((m) => m.id));
          const localOnly = existingForRoom.filter((m) => !newIds.has(m.id));
          mergedRoomMessages = [...localOnly, ...newMessages].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
        }

        const updatedRoomMessages = {
          ...state.roomMessages,
          [roomId]: mergedRoomMessages,
        };

        // Eğer kullanıcı hâlâ bu odadaysa VEYA aktif oda henüz tanımlanmadıysa aktif listeyi de güncelle
        const shouldUpdateActive =
          !state.activeRoom || state.activeRoom.id === roomId;

        return {
          roomMessages: updatedRoomMessages,
          ...(shouldUpdateActive ? { messages: mergedRoomMessages } : {}),
        };
      });
      return true;
    } catch (err: any) {
      console.warn('fetchMessages error:', err?.message || err);
      return false;
    }
  },

  sendMessage: async (roomId: string, content: string, replyToId?: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(
        'send_message',
        { roomId, content, replyToId },
        (ack: any) => {
          if (ack?.ok && ack?.message) {
            get().addMessage(ack.message);
          }
        },
      );
    } else {
      try {
        const res = await api.post(`/messages/room/${roomId}`, {
          content,
          replyToId,
        });
        get().addMessage(res.data);
      } catch (err) {
        console.error('sendMessage error:', err);
      }
    }
  },

  editMessage: async (messageId: string, content: string) => {
    try {
      const res = await api.patch(`/messages/${messageId}`, { content });
      const updatedMsg: Message = res.data;
      set((state) => {
        const roomId = updatedMsg.roomId;
        const roomMsgs = (state.roomMessages[roomId] || []).map((m) =>
          m.id === messageId ? updatedMsg : m,
        );
        return {
          roomMessages: {
            ...state.roomMessages,
            [roomId]: roomMsgs,
          },
          messages: state.messages.map((m) => (m.id === messageId ? updatedMsg : m)),
        };
      });
    } catch (err) {
      console.error('editMessage error:', err);
    }
  },

  deleteMessage: async (messageId: string) => {
    try {
      await api.delete(`/messages/${messageId}`);
      set((state) => {
        const nextRoomMessages = { ...state.roomMessages };
        for (const rId of Object.keys(nextRoomMessages)) {
          if (nextRoomMessages[rId]?.some((m) => m.id === messageId)) {
            nextRoomMessages[rId] = nextRoomMessages[rId].map((m) =>
              m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m,
            );
          }
        }
        return {
          roomMessages: nextRoomMessages,
          messages: state.messages.map((m) =>
            m.id === messageId ? { ...m, deletedAt: new Date().toISOString(), content: '' } : m,
          ),
        };
      });
    } catch (err) {
      console.error('deleteMessage error:', err);
    }
  },

  markAsRead: async (roomId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('mark_read', { roomId });
    } else {
      await api.post(`/rooms/${roomId}/read`).catch(() => undefined);
    }
    // Zaten okunmuşsa yeni dizi oluşturma (gereksiz yeniden render'ları önler)
    set((state) => {
      const target = state.rooms.find((r) => r.id === roomId);
      if (!target || !target.unreadCount) return state;
      return {
        rooms: state.rooms.map((r) =>
          r.id === roomId ? { ...r, unreadCount: 0 } : r,
        ),
      };
    });
  },

  typingUsers: [],
  sendTyping: (roomId: string, isTyping: boolean) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('typing', { roomId, isTyping });
    }
  },

  // Group Voice
  activeVoiceRoomId: null,
  voiceParticipants: [],
  roomVoiceStates: {},
  isMuted: false,
  isVideoOn: false,

  joinRoomVoice: async (roomId: string) => {
    const { currentUser, isMuted, isVideoOn } = get();
    const socket = getSocket();

    const selfParticipant: VoiceParticipant = {
      id: currentUser?.id || 'me',
      userId: currentUser?.id || 'me',
      displayName: currentUser?.displayName || 'Ben',
      avatarUrl: currentUser?.avatarUrl,
      isSpeaking: false,
      isMuted,
      isVideoOn,
    };

    set({
      activeVoiceRoomId: roomId,
      voiceParticipants: [selfParticipant],
    });

    if (socket && socket.connected) {
      socket.emit('join_room_voice', { roomId }, (res: any) => {
        if (res?.participantUsers && Array.isArray(res.participantUsers)) {
          const list: VoiceParticipant[] = res.participantUsers.map((u: any) => ({
            id: u.id,
            userId: u.id,
            displayName: u.displayName || u.username || 'Katılımcı',
            avatarUrl: u.avatarUrl,
            isSpeaking: false,
            isMuted: u.id === currentUser?.id ? isMuted : false,
            isVideoOn: u.id === currentUser?.id ? isVideoOn : false,
          }));
          if (currentUser && !list.some((p) => p.userId === currentUser.id)) {
            list.unshift(selfParticipant);
          }
          set({ voiceParticipants: list });
        }
      });
    }

    // LiveKit WebRTC ses odasına bağlan
    try {
      const res = await api.get(`/livekit/token/voice-${roomId}`);
      const token = res.data?.token;
      const serverUrl = res.data?.serverUrl;
      if (token && serverUrl) {
        await liveKitService.connect(serverUrl, token, !isMuted, isVideoOn);
      }
    } catch (err: any) {
      console.warn('Oda sesli sohbet LiveKit bağlantı uyarısı:', err?.message);
    }
  },

  leaveRoomVoice: () => {
    const { activeVoiceRoomId } = get();
    const socket = getSocket();
    if (socket && activeVoiceRoomId) {
      socket.emit('leave_room_voice', { roomId: activeVoiceRoomId });
    }
    liveKitService.disconnect().catch(console.warn);
    set({
      activeVoiceRoomId: null,
      voiceParticipants: [],
      isVideoOn: false,
    });
  },

  toggleMute: () => {
    const nextMuted = !get().isMuted;
    liveKitService.setMicrophoneEnabled(!nextMuted).catch(console.warn);
    set((state) => ({
      isMuted: nextMuted,
      voiceParticipants: state.voiceParticipants.map((p) =>
        p.userId === state.currentUser?.id ? { ...p, isMuted: nextMuted } : p,
      ),
    }));
  },

  toggleVideo: () => {
    const nextVideo = !get().isVideoOn;
    liveKitService.setCameraEnabled(nextVideo).catch(console.warn);
    set((state) => ({
      isVideoOn: nextVideo,
      voiceParticipants: state.voiceParticipants.map((p) =>
        p.userId === state.currentUser?.id ? { ...p, isVideoOn: nextVideo } : p,
      ),
    }));
  },

  // DM Arama
  activeCall: null,

  startCall: async (roomId: string, video = false) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('call_start', { roomId, video }, (res: any) => {
        if (res?.ok && res.call) {
          set({ activeCall: res.call });
        } else if (res?.error) {
          Alert.alert('Arama Başarısız', res.error);
        }
      });
    } else {
      Alert.alert('Hata', 'Canlı bağlantı sunucusuna bağlı değilsiniz.');
    }
  },

  acceptCall: async (callId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('call_accept', { callId });
    }
  },

  declineCall: async (callId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('call_decline', { callId });
    }
    notificationService.dismissCallNotification();
    set({ activeCall: null });
  },

  endCall: async (callId: string) => {
    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit('call_end', { callId });
    }
    notificationService.dismissCallNotification();
    set({ activeCall: null });
  },
}));
