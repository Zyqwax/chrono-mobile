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
import {
  notificationService,
  registerForPushNotificationsAsync,
} from '../services/notifications';
import { liveKitService } from '../services/livekit';
import { localDb } from '../services/localDb';

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
      // 1. Yerel SQLite'tan tüm odaların son mesajlarını anında önbelleğe al (0 ms anında render)
      localDb
        .getLatestMessagesForAllRooms()
        .then((latestMap) => {
          if (Object.keys(latestMap).length > 0) {
            set((state) => {
              const nextMap = { ...state.roomMessages };
              for (const [rId, msg] of Object.entries(latestMap)) {
                if (!nextMap[rId] || nextMap[rId].length === 0) {
                  nextMap[rId] = [msg];
                }
              }
              return { roomMessages: nextMap };
            });
          }
        })
        .catch(console.warn);

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
      // Cihazın Expo Push Token'ını al ve sunucudaki profile kaydet
      registerForPushNotificationsAsync()
        .then((pushToken) => {
          if (pushToken) {
            api.put('/users/me/push-token', { pushToken }).catch(() => {});
          }
        })
        .catch(console.warn);

      const socket = connectSocket(token);

      // 1. Yeni mesaj geldiğinde
      socket.on('new_message', (message: Message) => {
        // Eğer bu mesaj bizim az önce gönderdiğimiz geçici (isPending) mesajsa temizle
        set((state) => {
          const rMsgs = state.roomMessages[message.roomId] || [];
          const hasMatchingTemp = rMsgs.some(
            (m) => m.isPending && m.content === message.content && m.senderId === message.senderId,
          );
          if (hasMatchingTemp) {
            const nextRMsgs = rMsgs.filter(
              (m) => !(m.isPending && m.content === message.content && m.senderId === message.senderId),
            );
            const nextActive = state.messages.filter(
              (m) => !(m.isPending && m.content === message.content && m.senderId === message.senderId),
            );
            return {
              roomMessages: { ...state.roomMessages, [message.roomId]: nextRMsgs },
              messages: nextActive,
            };
          }
          return state;
        });

        const { activeRoom, addMessage, rooms } = get();
        // Odaya ait mesaj havuzuna her durumda ekle
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

      // Karşı tarafın okuduğu bilgisi (Halka 360° dolumu)
      socket.on(
        'messages_read',
        ({
          roomId,
          readAt,
        }: {
          roomId: string;
          userId?: string;
          readAt: string | null;
        }) => {
          set((s) => ({
            rooms: s.rooms.map((r) =>
              r.id === roomId ? { ...r, othersReadAt: readAt } : r,
            ),
            activeRoom:
              s.activeRoom?.id === roomId
                ? { ...s.activeRoom, othersReadAt: readAt }
                : s.activeRoom,
          }));
        },
      );

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
        const state = get();
        const myLastSeenVisibility = state.settings?.lastSeenVisibility ?? 'EVERYONE';
        const isSelf = state.currentUser?.id === data.userId;
        const effectiveStatus = !isSelf && myLastSeenVisibility === 'NOBODY' ? 'HIDDEN' : data.status;
        const effectiveLastSeenAt = !isSelf && myLastSeenVisibility === 'NOBODY' ? null : data.lastSeenAt;

        set((s) => ({
          rooms: s.rooms.map((r) => {
            if (r.peer && r.peer.id === data.userId) {
              return {
                ...r,
                peer: { ...r.peer, status: effectiveStatus, lastSeenAt: effectiveLastSeenAt },
              };
            }
            return r;
          }),
          contacts: s.contacts.map((c) => {
            if (c.user.id === data.userId) {
              return {
                ...c,
                user: { ...c.user, status: effectiveStatus, lastSeenAt: effectiveLastSeenAt },
              };
            }
            return c;
          }),
          activeRoom:
            s.activeRoom?.peer && s.activeRoom.peer.id === data.userId
              ? {
                  ...s.activeRoom,
                  peer: { ...s.activeRoom.peer, status: effectiveStatus, lastSeenAt: effectiveLastSeenAt },
                }
              : s.activeRoom,
        }));
      });

      // 7.1 Profil / gizlilik güncellemesi
      socket.on('user_updated', (data: Partial<User> & { id: string }) => {
        if (!data?.id) return;
        const state = get();
        const myLastSeenVisibility = state.settings?.lastSeenVisibility ?? 'EVERYONE';
        const isSelf = state.currentUser?.id === data.id;
        const effectiveStatus = !isSelf && myLastSeenVisibility === 'NOBODY' ? 'HIDDEN' : data.status;
        const effectiveLastSeenAt = !isSelf && myLastSeenVisibility === 'NOBODY' ? null : data.lastSeenAt;

        set((s) => ({
          rooms: s.rooms.map((r) => {
            if (r.peer && r.peer.id === data.id) {
              return {
                ...r,
                peer: {
                  ...r.peer,
                  ...data,
                  status: effectiveStatus !== undefined ? effectiveStatus : r.peer.status,
                  lastSeenAt: effectiveLastSeenAt !== undefined ? effectiveLastSeenAt : r.peer.lastSeenAt,
                },
              };
            }
            return r;
          }),
          contacts: s.contacts.map((c) => {
            if (c.user.id === data.id) {
              return {
                ...c,
                user: {
                  ...c.user,
                  ...data,
                  status: effectiveStatus !== undefined ? effectiveStatus : c.user.status,
                  lastSeenAt: effectiveLastSeenAt !== undefined ? effectiveLastSeenAt : c.user.lastSeenAt,
                },
              };
            }
            return c;
          }),
          activeRoom:
            s.activeRoom?.peer && s.activeRoom.peer.id === data.id
              ? {
                  ...s.activeRoom,
                  peer: {
                    ...s.activeRoom.peer,
                    ...data,
                    status: effectiveStatus !== undefined ? effectiveStatus : s.activeRoom.peer.status,
                    lastSeenAt: effectiveLastSeenAt !== undefined ? effectiveLastSeenAt : s.activeRoom.peer.lastSeenAt,
                  },
                }
              : s.activeRoom,
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
    api.put('/users/me/push-token', { pushToken: null }).catch(() => {});
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
      const newSettings = res.data;
      set((state) => {
        let rooms = state.rooms;
        let contacts = state.contacts;
        let activeRoom = state.activeRoom;

        // Çevrimiçi durumunu gizlediyse (NOBODY), mütekabiliyet gereği başkalarını da göremez
        if (newSettings.lastSeenVisibility === 'NOBODY') {
          rooms = rooms.map((r) =>
            r.peer ? { ...r, peer: { ...r.peer, status: 'HIDDEN', lastSeenAt: null } } : r,
          );
          contacts = contacts.map((c) => ({
            ...c,
            user: { ...c.user, status: 'HIDDEN', lastSeenAt: null },
          }));
          if (activeRoom?.peer) {
            activeRoom = {
              ...activeRoom,
              peer: { ...activeRoom.peer, status: 'HIDDEN', lastSeenAt: null },
            };
          }
        }

        // DM okundu bilgisini kapattıysa, DM odalarındaki othersReadAt bilgisini temizle
        if (newSettings.readReceipts === false) {
          rooms = rooms.map((r) =>
            r.type === 'DIRECT' ? { ...r, othersReadAt: null } : r,
          );
          if (activeRoom && activeRoom.type === 'DIRECT') {
            activeRoom = { ...activeRoom, othersReadAt: null };
          }
        }

        return {
          settings: newSettings,
          rooms,
          contacts,
          activeRoom,
        };
      });

      // Gizlilik veya okundu bilgisi güncellendiğinde sunucudan güncel durumu çek
      await get().fetchRooms().catch(() => undefined);
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
    if (room) {
      notificationService.clearRoomNotifications(room.id);
      if (socket) {
        socket.emit('join_room', { roomId: room.id });
        get().markAsRead(room.id);
      }

      // Bellek boşsa yerel SQLite'tan hemen 0ms'de yükle
      if (cached.length === 0) {
        localDb
          .getMessages(room.id, 40)
          .then((localMsgs) => {
            if (localMsgs.length > 0 && get().activeRoom?.id === room.id) {
              set((state) => ({
                messages: localMsgs,
                roomMessages: { ...state.roomMessages, [room.id]: localMsgs },
              }));
            }
          })
          .catch(console.warn);
      }
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
    void localDb.clearRoomMessages(roomId);
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
    if (!message.isPending) {
      void localDb.saveMessage(message);
    }
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
      // 1. Sayfalama (Eski mesajlara yukarı kaydırma):
      if (before) {
        const beforeTs = new Date(before).getTime();
        const localOlder = await localDb.getMessages(roomId, 40, beforeTs);

        if (localOlder.length > 0) {
          set((state) => {
            const existingForRoom = state.roomMessages[roomId] || [];
            const existingIds = new Set(existingForRoom.map((m) => m.id));
            const filteredNew = localOlder.filter((m) => !existingIds.has(m.id));
            const mergedRoomMessages = [...existingForRoom, ...filteredNew];
            const shouldUpdateActive = !state.activeRoom || state.activeRoom.id === roomId;

            return {
              roomMessages: {
                ...state.roomMessages,
                [roomId]: mergedRoomMessages,
              },
              ...(shouldUpdateActive ? { messages: mergedRoomMessages } : {}),
            };
          });
          return true;
        }

        const res = await api.get(`/messages/room/${roomId}`, {
          params: { limit: 40, before },
        });
        const serverOlder: Message[] = res.data || [];
        if (serverOlder.length > 0) {
          void localDb.saveMessages(serverOlder);
        }

        set((state) => {
          const existingForRoom = state.roomMessages[roomId] || [];
          const existingIds = new Set(existingForRoom.map((m) => m.id));
          const filteredNew = serverOlder.filter((m) => !existingIds.has(m.id));
          const mergedRoomMessages = [...existingForRoom, ...filteredNew];
          const shouldUpdateActive = !state.activeRoom || state.activeRoom.id === roomId;

          return {
            roomMessages: {
              ...state.roomMessages,
              [roomId]: mergedRoomMessages,
            },
            ...(shouldUpdateActive ? { messages: mergedRoomMessages } : {}),
          };
        });
        return true;
      }

      // 2. İlk açılış (Odaya giriş):
      const localMsgs = await localDb.getMessages(roomId, 40);
      if (localMsgs.length > 0) {
        set((state) => {
          const shouldUpdateActive = !state.activeRoom || state.activeRoom.id === roomId;
          return {
            roomMessages: {
              ...state.roomMessages,
              [roomId]: localMsgs,
            },
            ...(shouldUpdateActive ? { messages: localMsgs } : {}),
          };
        });

        const newest = localMsgs[0];
        try {
          const res = await api.get(`/messages/room/${roomId}`, {
            params: { limit: 40, after: newest.createdAt },
          });
          const newDelta: Message[] = res.data || [];
          if (newDelta.length > 0) {
            void localDb.saveMessages(newDelta);
            set((state) => {
              const current = state.roomMessages[roomId] || localMsgs;
              const deltaIds = new Set(newDelta.map((m) => m.id));
              const filteredOld = current.filter((m) => !deltaIds.has(m.id));
              const merged = [...newDelta, ...filteredOld].sort(
                (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
              );
              const shouldUpdateActive = !state.activeRoom || state.activeRoom.id === roomId;
              return {
                roomMessages: { ...state.roomMessages, [roomId]: merged },
                ...(shouldUpdateActive ? { messages: merged } : {}),
              };
            });
          }
        } catch {
          // Ağ hatası olsa bile local mesajlar zaten ekranda, sessizce geç
        }
        return true;
      }

      // 3. Yerelde henüz hiç mesaj yoksa (cihaza ilk kez yüklendiğinde) sunucudan tam çek
      const res = await api.get(`/messages/room/${roomId}`, {
        params: { limit: 40 },
      });
      const newMessages: Message[] = res.data || [];
      if (newMessages.length > 0) {
        void localDb.saveMessages(newMessages);
      }

      set((state) => {
        const existingForRoom = state.roomMessages[roomId] || [];
        const newIds = new Set(newMessages.map((m) => m.id));
        const localOnly = existingForRoom.filter((m) => !newIds.has(m.id));
        const mergedRoomMessages = [...localOnly, ...newMessages].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        const shouldUpdateActive = !state.activeRoom || state.activeRoom.id === roomId;

        return {
          roomMessages: {
            ...state.roomMessages,
            [roomId]: mergedRoomMessages,
          },
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
    const currentUser = get().currentUser;
    const tempId = `temp_${Date.now()}`;
    const nowIso = new Date().toISOString();

    const optimisticMessage: Message = {
      id: tempId,
      roomId,
      senderId: currentUser?.id || 'me',
      content,
      replyToId: replyToId || null,
      createdAt: nowIso,
      type: 'TEXT',
      sender: currentUser || { id: 'me', username: 'me', displayName: 'Ben' },
      isPending: true,
    };

    get().addMessage(optimisticMessage);

    const socket = getSocket();
    if (socket && socket.connected) {
      socket.emit(
        'send_message',
        { roomId, content, replyToId, tempId },
        (ack: any) => {
          if (ack?.ok && ack?.message) {
            void localDb.saveMessage(ack.message);
            set((state) => {
              const rMsgs = (state.roomMessages[roomId] || []).map((m) =>
                m.id === tempId ? { ...ack.message, isPending: false } : m,
              );
              const activeMsgs = state.messages.map((m) =>
                m.id === tempId ? { ...ack.message, isPending: false } : m,
              );
              return {
                roomMessages: { ...state.roomMessages, [roomId]: rMsgs },
                messages: activeMsgs,
              };
            });
          }
        },
      );
    } else {
      try {
        const res = await api.post(`/messages/room/${roomId}`, {
          content,
          replyToId,
        });
        if (res.data) {
          void localDb.saveMessage(res.data);
        }
        set((state) => {
          const rMsgs = (state.roomMessages[roomId] || []).map((m) =>
            m.id === tempId ? { ...res.data, isPending: false } : m,
          );
          const activeMsgs = state.messages.map((m) =>
            m.id === tempId ? { ...res.data, isPending: false } : m,
          );
          return {
            roomMessages: { ...state.roomMessages, [roomId]: rMsgs },
            messages: activeMsgs,
          };
        });
      } catch (err) {
        console.error('sendMessage error:', err);
      }
    }
  },

  editMessage: async (messageId: string, content: string) => {
    try {
      const res = await api.patch(`/messages/${messageId}`, { content });
      const updatedMsg: Message = res.data;
      void localDb.updateMessageContent(messageId, content, updatedMsg.editedAt || undefined);
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
      void localDb.deleteMessage(messageId, true);
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
    notificationService.clearRoomNotifications(roomId);
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
