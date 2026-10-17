import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AppState, Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidStyle,
  AndroidVisibility,
} from '@notifee/react-native';
import { foregroundServiceManager } from './foregroundService';
import { callSoundService } from './sound';
import { callKeepService } from './callkeep';

// Require cycle kırılması için Zustand store referansı dinamik çözümlenir
const getChatStore = () => {
  try {
    return require('../store/useChatStore').useChatStore;
  } catch {
    return null;
  }
};

export interface MessageNotificationOptions {
  messageId?: string;
  roomId: string;
  roomName?: string;
  roomType?: 'DIRECT' | 'ROOM' | string;
  roomIcon?: string | null;
  senderId?: string;
  senderName: string;
  senderAvatar?: string | null;
  messageType?: 'TEXT' | 'IMAGE' | 'AUDIO' | 'SYSTEM' | string;
  content?: string | null;
  timestamp?: number;
  preview?: boolean;
}

interface StackedMessageItem {
  messageId?: string;
  text: string;
  timestamp: number;
  senderName: string;
  senderAvatar?: string;
}

const isValidHttpUrl = (url?: string | null): url is string => {
  return typeof url === 'string' && (url.startsWith('http://') || url.startsWith('https://'));
};

/**
 * Mesaj içeriğini WhatsApp / Telegram bildirim formatına dönüştürür.
 * Ham Cloudinary URL'leri yerine "📷 Fotoğraf" veya "🎤 Sesli mesaj" gösterir.
 */
export function formatNotificationMessageText(
  content?: string | null,
  messageType?: string | null,
  preview = true,
): string {
  if (!preview) {
    return 'Yeni mesaj';
  }

  const normalizedType = (messageType || 'TEXT').toUpperCase();
  if (normalizedType === 'IMAGE') {
    return '📷 Fotoğraf';
  }
  if (normalizedType === 'AUDIO') {
    return '🎤 Sesli mesaj';
  }

  const raw = (content || '').trim();
  if (!raw) {
    return 'Yeni mesaj';
  }

  // E2EE çözüldükten sonra içerik bir medya URL'si ise temiz etiket göster
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    const lower = raw.toLowerCase();
    if (
      lower.includes('/image/upload/') ||
      lower.match(/\.(jpg|jpeg|png|webp|gif)(\?|$)/)
    ) {
      return '📷 Fotoğraf';
    }
    if (
      lower.includes('/video/upload/') ||
      lower.match(/\.(m4a|aac|mp3|wav|ogg|opus)(\?|$)/)
    ) {
      return '🎤 Sesli mesaj';
    }
  }

  // Arama kaydı sistem mesajı kontrolü
  if (raw.startsWith('__CALL_LOG__:')) {
    try {
      const data = JSON.parse(raw.replace('__CALL_LOG__:', ''));
      const isVideo = Boolean(data?.video);
      if (data?.status === 'missed' || data?.status === 'declined') {
        return isVideo ? '📹 Cevapsız görüntülü arama' : '📞 Cevapsız sesli arama';
      }
      return isVideo ? '📹 Görüntülü arama' : '📞 Sesli arama';
    } catch {
      return '📞 Arama';
    }
  }

  return raw;
}

// Uygulama açıkken bildirimlerin görünüm davranışı (Foreground Filtering / Çift Bildirim Engelleyici)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;

    // 1. Arama bildirimleri (Notifee ve CallKeep tarafından yönetilir, Expo Notification bastırılır)
    if (data?.type === 'incoming_call' || data?.type === 'call_cancelled') {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // 2. Sohbet mesajı bildirimleri:
    // Uygulama açıkken (foreground) veya Android'de Notifee MessagingStyle kullanılırken
    // Expo'nun ham push bildirimi ikinci kez göstermesini tamamen engelle!
    if (
      data?.type === 'message' ||
      data?.roomId ||
      AppState.currentState === 'active'
    ) {
      return {
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // 3. Sessiz veya devam eden arama bildirimleri
    const isSilent = Boolean(data?.isSilent || data?.type === 'active_call');
    if (isSilent) {
      return {
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    return {
      shouldShowBanner: false,
      shouldShowList: false,
      shouldPlaySound: false,
      shouldSetBadge: false,
    };
  },
});

/**
 * Fiziksel cihaz kontrolü, Android MAX önem kanalı ve EAS projectId ile Expo Push Token alır.
 */
export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('chat-messages', {
      name: 'Sohbet Mesajları',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#38BDF8',
      enableVibrate: true,
      showBadge: true,
    });
  }

  // Bildirim izni kontrolü
  let finalStatus = 'undetermined';
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
  } catch (permErr: any) {
    console.warn('Bildirim izni istenirken hata:', permErr?.message || permErr);
  }

  // Emülatör kontrolü: Emülatörlerde gerçek FCM/APNS token'ı üretilemez.
  if (!Device.isDevice) {
    const emulatorToken = `ExponentPushToken[emulator-${Platform.OS}-${(Device.modelName || 'device').replace(/[^a-zA-Z0-9]/g, '')}]`;
    console.log('📱 [Emulator] Emülatör tespit edildi, test Expo push token kullanılıyor:', emulatorToken);
    return emulatorToken;
  }

  if (finalStatus !== 'granted') {
    console.warn('⚠️ Push bildirim izni verilmedi (İzin Durumu:', finalStatus, ')');
    return null;
  }

  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    Constants?.easConfig?.projectId ??
    (Constants as any)?.manifest2?.extra?.eas?.projectId ??
    '6cce0529-7a23-43ce-be0f-d4990f2f03cc';

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    console.log('📲 Expo Push Token başarıyla alındı:', tokenData.data);
    return tokenData.data;
  } catch (error: any) {
    console.warn('Expo push token projectId ile alınamadı, parametresiz deneniyor:', error?.message || error);
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      console.log('📲 Expo Push Token başarıyla alındı (fallback):', tokenData.data);
      return tokenData.data;
    } catch (err2: any) {
      console.error(
        '❌ Expo push token alınamadı. (Android APK standalone için Firebase google-services.json gereklidir):',
        err2?.message || err2,
      );
      return null;
    }
  }
}

class NotificationService {
  private isConfigured = false;
  private currentCallNotificationId: string | null = null;
  private callTimeouts = new Map<string, any>();
  private activeRingingCallIds = new Set<string>();
  private notifiedMessageIds = new Set<string>();
  private roomMessagesHistory = new Map<string, StackedMessageItem[]>();

  hasNotifiedMessage(messageId?: string | null): boolean {
    if (!messageId) return false;
    return this.notifiedMessageIds.has(messageId);
  }

  markMessageNotified(messageId?: string | null) {
    if (!messageId) return;
    this.notifiedMessageIds.add(messageId);
    if (this.notifiedMessageIds.size > 300) {
      const first = this.notifiedMessageIds.values().next().value;
      if (first) this.notifiedMessageIds.delete(first);
    }
  }

  async init() {
    if (this.isConfigured) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      if (existingStatus !== 'granted') {
        await Notifications.requestPermissionsAsync();
      }

      if (Platform.OS === 'android') {
        // Eski kanalları temizle
        try {
          await Notifications.deleteNotificationChannelAsync('messages_channel');
          await Notifications.deleteNotificationChannelAsync('ongoing_calls_channel');
          await Notifications.deleteNotificationChannelAsync('ongoing_calls_channel_v2');
          await notifee.deleteChannel('chrono_incoming_calls_v2').catch(() => {});
          await notifee.deleteChannel('chrono_incoming_calls_v3').catch(() => {});
        } catch {
          // yut
        }

        // 1. Notifee Sohbet Mesajları Kanalı (WhatsApp/Telegram MessagingStyle için)
        await notifee.createChannel({
          id: 'chrono_chat_messages_v2',
          name: 'Sohbet Mesajları',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          vibration: true,
          vibrationPattern: [250, 200, 250],
          lights: true,
          lightColor: '#38BDF8',
          badge: true,
        });

        // 2. Notifee Gelen Arama Kanalı (En yüksek öncelik / Heads-up / Zil Sesi)
        await notifee.createChannel({
          id: 'chrono_incoming_calls_v4',
          name: 'Gelen Aramalar',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          bypassDnd: true,
          sound: 'default',
          vibration: true,
          vibrationPattern: [1000, 800, 1000, 800],
          lights: true,
          lightColor: '#10B981',
        });

        // 3. Expo Sohbet Mesaj Bildirim Kanalı
        await Notifications.setNotificationChannelAsync('chat-messages', {
          name: 'Sohbet Mesajları',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38BDF8',
          enableVibrate: true,
          showBadge: true,
        });

        // 4. Canlı Sesli Arama Bildirim Kanalı (Sessiz, titreşimsiz, düşük önem düzeyi)
        await Notifications.setNotificationChannelAsync('ongoing-call', {
          name: 'Aktif Görüşme',
          importance: Notifications.AndroidImportance.LOW,
          vibrationPattern: [],
          sound: null,
          enableVibrate: false,
          lightColor: '#10B981',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 5. Sessiz Bildirim Kanalı (Sesli sohbet başlangıçları vb.)
        await Notifications.setNotificationChannelAsync('silent_channel', {
          name: 'Sessiz Bildirimler',
          importance: Notifications.AndroidImportance.LOW,
          vibrationPattern: [],
          sound: null,
          enableVibrate: false,
        });
      }

      this.isConfigured = true;
    } catch (err) {
      console.warn('NotificationService init hatası:', err);
    }
  }

  /**
   * WhatsApp / Telegram tarzı gruplanmış (stacked) sohbet mesajı bildirimi.
   * - Uygulama aktif olarak ekranda açıksa (AppState === 'active') yeni sistem bildirimi fırlatmaz
   *   (böylece uygulama içindeyken hem in-app hem push bildirim gelmesi önlenir).
   * - Aynı sohbetten gelen tüm mesajlar tek bir `chat_${roomId}` bildirim kartında alt alta stack'lenir.
   */
  async showMessageNotification(
    optionsOrSenderName: MessageNotificationOptions | string,
    maybeBody?: string,
    maybeRoomId?: string,
  ) {
    try {
      const opts: MessageNotificationOptions =
        typeof optionsOrSenderName === 'string'
          ? {
              senderName: optionsOrSenderName,
              content: maybeBody || '',
              roomId: maybeRoomId || '',
            }
          : optionsOrSenderName;

      const { roomId, messageId } = opts;
      if (!roomId) return;

      // 1. Mesaj ID bazlı tekilleştirme (Hem Socket hem Push aynı mesajı tetiklerse ikincisini yoksay)
      if (messageId) {
        if (this.hasNotifiedMessage(messageId)) {
          return;
        }
        this.markMessageNotified(messageId);
      }

      // 2. Kullanıcı şu an uygulamanın içindeyse (foreground), sistem bildirim çubuğundan
      // üst üste bildirim düşürme! (Kullanıcı zaten uygulama içinde sohbet listesini veya ekranı görüyor)
      const isAppActive = AppState.currentState === 'active';
      const storeState = getChatStore()?.getState?.();
      const activeRoomId = storeState?.activeRoom?.id;

      if (isAppActive) {
        // Eğer kullanıcı o an ilgili odanın içindeyse mevcut bildirimleri de temizle
        if (activeRoomId === roomId) {
          void this.clearRoomNotifications(roomId);
        }
        return;
      }

      // 3. Oda ve gönderen bilgilerini zenginleştir
      const storeRoom = storeState?.rooms?.find((r: any) => r.id === roomId);
      const roomType = opts.roomType || storeRoom?.type || 'DIRECT';
      const isGroup = roomType === 'ROOM';

      const senderName =
        opts.senderName ||
        storeRoom?.peer?.displayName ||
        storeRoom?.peer?.username ||
        'Kullanıcı';

      const conversationTitle = isGroup
        ? opts.roomName || storeRoom?.name || 'Grup Sohbeti'
        : senderName;

      const senderAvatar = isValidHttpUrl(opts.senderAvatar)
        ? opts.senderAvatar
        : isValidHttpUrl(storeRoom?.peer?.avatarUrl)
          ? storeRoom.peer.avatarUrl
          : undefined;

      const largeIconUrl = isGroup
        ? isValidHttpUrl(opts.roomIcon)
          ? opts.roomIcon
          : isValidHttpUrl(storeRoom?.iconUrl)
            ? storeRoom.iconUrl
            : senderAvatar
        : senderAvatar;

      const settings = storeState?.settings;
      const previewEnabled = opts.preview ?? settings?.messagePreview ?? true;

      const formattedText = formatNotificationMessageText(
        opts.content,
        opts.messageType,
        previewEnabled,
      );

      // 4. Bu odaya ait okunmamış bildirim mesajlarını yığına (stack) ekle
      const existingStack = this.roomMessagesHistory.get(roomId) || [];
      if (messageId && existingStack.some((m) => m.messageId === messageId)) {
        return;
      }

      const timestamp = opts.timestamp || Date.now();
      const updatedStack: StackedMessageItem[] = [
        ...existingStack,
        {
          messageId,
          text: formattedText,
          timestamp,
          senderName,
          senderAvatar,
        },
      ].slice(-10); // En fazla son 10 mesajı stack'te tut

      this.roomMessagesHistory.set(roomId, updatedStack);
      const notifId = `chat_${roomId}`;
      const messageCount = updatedStack.length;

      // 5. Android: Notifee AndroidStyle.MESSAGING ile WhatsApp/Telegram tarzı konuşma kartı
      if (Platform.OS === 'android') {
        await notifee.createChannel({
          id: 'chrono_chat_messages_v2',
          name: 'Sohbet Mesajları',
          importance: AndroidImportance.HIGH,
          visibility: AndroidVisibility.PUBLIC,
          sound: 'default',
          vibration: true,
          vibrationPattern: [250, 200, 250],
          lights: true,
          lightColor: '#38BDF8',
          badge: true,
        });

        const summaryHeader = isGroup
          ? messageCount > 1
            ? `${conversationTitle} (${messageCount} yeni mesaj)`
            : conversationTitle
          : messageCount > 1
            ? `${conversationTitle} · ${messageCount} yeni mesaj`
            : conversationTitle;

        await notifee.displayNotification({
          id: notifId,
          title: conversationTitle,
          subtitle: messageCount > 1 ? `${messageCount} yeni mesaj` : undefined,
          body: isGroup ? `${senderName}: ${formattedText}` : formattedText,
          data: {
            roomId,
            type: 'message',
            roomName: conversationTitle,
            roomType,
          },
          android: {
            channelId: 'chrono_chat_messages_v2',
            category: AndroidCategory.MESSAGE,
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            groupId: 'chrono_chat_group',
            color: '#2563EB',
            smallIcon: 'ic_launcher',
            ...(largeIconUrl
              ? {
                  largeIcon: largeIconUrl,
                  circularLargeIcon: true,
                }
              : {}),
            showTimestamp: true,
            timestamp,
            autoCancel: true,
            pressAction: {
              id: 'default',
              launchActivity: 'default',
            },
            style: {
              type: AndroidStyle.MESSAGING,
              person: {
                name: storeState?.currentUser?.displayName || 'Ben',
              },
              title: isGroup || messageCount > 1 ? summaryHeader : undefined,
              group: isGroup,
              messages: updatedStack.map((item) => ({
                text: item.text,
                timestamp: item.timestamp,
                person: {
                  name: item.senderName,
                  ...(item.senderAvatar ? { icon: item.senderAvatar } : {}),
                },
              })),
            },
            actions: [
              {
                title: 'Okundu Olarak İşaretle',
                pressAction: {
                  id: 'mark_read',
                },
              },
            ],
          },
        });
        return;
      }

      // 6. iOS: Aynı identifier (`chat_${roomId}`) ile tek kartta güncelle
      const iosLines = updatedStack.map((item) =>
        isGroup ? `${item.senderName}: ${item.text}` : item.text,
      );
      await Notifications.scheduleNotificationAsync({
        identifier: notifId,
        content: {
          title: conversationTitle,
          subtitle: messageCount > 1 ? `${messageCount} yeni mesaj` : undefined,
          body: iosLines.slice(-4).join('\n'),
          data: { roomId, type: 'message' },
          sound: 'default',
        },
        trigger: null,
      });
    } catch (err) {
      console.warn('showMessageNotification hatası:', err);
    }
  }

  /**
   * Kullanıcı odaya girdiğinde (bildirime tıklamadan doğrudan uygulama içinden girse bile)
   * ilgili odanın bildirimlerini ve mesaj stack'ini tamamen temizler.
   */
  async clearRoomNotifications(roomId: string) {
    if (!roomId) return;
    this.roomMessagesHistory.delete(roomId);

    if (Platform.OS === 'android') {
      try {
        await notifee.cancelNotification(`chat_${roomId}`).catch(() => {});
        await notifee.cancelDisplayedNotification(`chat_${roomId}`).catch(() => {});

        const displayed = await notifee.getDisplayedNotifications();
        let remainingChatNotifs = 0;

        for (const item of displayed) {
          const nId = item.id || item.notification?.id;
          const nData: any = item.notification?.data || {};
          const nRoomId = nData?.roomId;

          if (
            nId === `chat_${roomId}` ||
            nId === `room_${roomId}` ||
            nRoomId === roomId ||
            (nId && nId.startsWith(`msg_${roomId}`))
          ) {
            if (nId) {
              await notifee.cancelNotification(nId).catch(() => {});
            }
          } else if (nData?.type === 'message' && nId !== 'chrono_chat_summary') {
            remainingChatNotifs++;
          }
        }

        if (remainingChatNotifs === 0) {
          await notifee.cancelNotification('chrono_chat_summary').catch(() => {});
        }
      } catch {
        // yut
      }
    }

    try {
      await Notifications.dismissNotificationAsync(`chat_${roomId}`).catch(() => {});
      await Notifications.dismissNotificationAsync(`room_${roomId}`).catch(() => {});
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const notif of presented) {
        const identifier = notif.request?.identifier;
        const notifData: any = notif.request?.content?.data || {};
        let targetRoomId = notifData?.roomId;

        if (!targetRoomId && typeof notifData?.dataString === 'string') {
          try {
            targetRoomId = JSON.parse(notifData.dataString)?.roomId;
          } catch {}
        }
        if (!targetRoomId && (notif.request?.trigger as any)?.remoteMessage?.data) {
          const rmData = (notif.request?.trigger as any).remoteMessage.data;
          targetRoomId = rmData?.roomId;
          if (!targetRoomId && typeof rmData?.dataString === 'string') {
            try {
              targetRoomId = JSON.parse(rmData.dataString)?.roomId;
            } catch {}
          }
        }

        if (
          targetRoomId === roomId ||
          identifier === `chat_${roomId}` ||
          identifier === `room_${roomId}` ||
          (identifier && identifier.startsWith(`msg_${roomId}`))
        ) {
          await Notifications.dismissNotificationAsync(identifier).catch(() => {});
        }
      }
    } catch {
      // yut
    }
  }

  // Gelen arama bildirimi (Heads-up / Tam bildirim, kesintisiz zil sesi ve titreşim)
  async showCallNotification(callerName: string, isVideo: boolean, callId: string, roomId = '') {
    try {
      // Aynı callId için çift çağrıyı (Socket + Background Push) engelle
      if (callId && this.activeRingingCallIds.has(callId)) {
        return;
      }
      if (callId) {
        this.activeRingingCallIds.add(callId);
      }

      // Gelen aramada diğer medyaları duraklatıp zil sesini başlat
      void callSoundService.startIncomingRingtone();

      if (Platform.OS === 'android') {
        try {
          await notifee.deleteChannel('chrono_incoming_calls_v2').catch(() => {});
          await notifee.deleteChannel('chrono_incoming_calls_v3').catch(() => {});
          await notifee.createChannel({
            id: 'chrono_incoming_calls_v4',
            name: 'Gelen Aramalar',
            importance: AndroidImportance.HIGH,
            visibility: AndroidVisibility.PUBLIC,
            bypassDnd: true,
            sound: 'default',
            vibration: true,
            vibrationPattern: [1000, 800, 1000, 800],
          });

          const notifId = `call_${callId}`;
          await notifee.displayNotification({
            id: notifId,
            title: callerName,
            subtitle: isVideo ? 'Chrono Görüntülü Arama' : 'Chrono Sesli Arama',
            body: isVideo ? '📹 Gelen görüntülü arama...' : '📞 Gelen sesli arama...',
            data: { callId, type: 'incoming_call', roomId, callerName, video: String(isVideo) },
            android: {
              channelId: 'chrono_incoming_calls_v4',
              category: AndroidCategory.CALL,
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
              color: '#10B981',
              smallIcon: 'ic_launcher',
              sound: 'default',
              loopSound: true,
              ongoing: true,
              autoCancel: false,
              timeoutAfter: 30000,
              vibrationPattern: [1000, 800, 1000, 800],
              pressAction: { id: 'default', launchActivity: 'default' },
              fullScreenAction: { id: 'default', launchActivity: 'default' },
              actions: [
                {
                  title: 'Cevapla',
                  pressAction: { id: 'answer_call', launchActivity: 'default' },
                },
                {
                  title: 'Reddet',
                  pressAction: { id: 'decline_call' },
                },
              ],
            },
          });
          this.currentCallNotificationId = notifId;

          // 30 saniyelik zaman aşımı: Arama yanıtlanmazsa temizle
          if (this.callTimeouts.has(callId)) {
            clearTimeout(this.callTimeouts.get(callId));
          }
          const timeout = setTimeout(() => {
            void this.dismissCallNotification(callId);
            const state = getChatStore()?.getState?.();
            if (state?.activeCall?.callId === callId && state.activeCall.state === 'ringing') {
              state.declineCall(callId);
            }
            this.callTimeouts.delete(callId);
          }, 30000);
          this.callTimeouts.set(callId, timeout);

          return;
        } catch (e) {
          console.warn('Notifee arama bildirimi hatası:', e);
        }
      }

      // iOS ve fallback ortamlar için expo-notifications
      const notifId = `call_${callId}`;
      await Notifications.scheduleNotificationAsync({
        identifier: notifId,
        content: {
          title: callerName,
          body: isVideo ? '📹 Gelen görüntülü arama...' : '📞 Gelen sesli arama...',
          data: { callId, type: 'incoming_call', roomId },
          sound: 'ringtone.wav',
          color: '#10B981',
          priority: Notifications.AndroidNotificationPriority.MAX,
        },
        trigger: null,
      });
      this.currentCallNotificationId = notifId;
    } catch (err) {
      console.warn('Arama bildirimi gösterme hatası:', err);
    }
  }

  // Arama sonlandığında gelen arama bildirimini ve sesleri temizle
  async dismissCallNotification(callId?: string, endCallKeep = false) {
    void callSoundService.stopAll();

    if (callId) {
      this.activeRingingCallIds.delete(callId);
      if (this.callTimeouts.has(callId)) {
        clearTimeout(this.callTimeouts.get(callId));
        this.callTimeouts.delete(callId);
      }
      if (endCallKeep) {
        callKeepService.endCall(callId);
      }
    } else {
      this.activeRingingCallIds.clear();
    }

    if (Platform.OS === 'android') {
      try {
        if (callId) {
          await notifee.cancelNotification(`call_${callId}`);
        }
        if (this.currentCallNotificationId) {
          await notifee.cancelNotification(this.currentCallNotificationId);
        }
        await notifee.cancelNotification('call_notif');
      } catch {
        // yut
      }
    }

    const idToDismiss = callId ? `call_${callId}` : this.currentCallNotificationId;
    if (idToDismiss) {
      try {
        await Notifications.dismissNotificationAsync(idToDismiss);
      } catch (err) {
        // yut
      }
    }
    if (this.currentCallNotificationId) {
      try {
        await Notifications.dismissNotificationAsync(this.currentCallNotificationId);
      } catch (err) {
        // yut
      }
      this.currentCallNotificationId = null;
    }
  }

  // Aktif arama devam ederken Android Foreground Service veya bildirim panelinde canlı arama kartı göster (Kronometreli)
  async showOngoingCallNotification(
    otherUserName: string,
    isVideo: boolean,
    callId: string,
    startTime: number = Date.now(),
  ) {
    if (Platform.OS === 'android') {
      await foregroundServiceManager.startCallForegroundService({
        callId,
        otherUserName,
        isVideo,
        startTime,
      });
      return;
    }

    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'active_voice_call', // Sabit identifier
        content: {
          title: isVideo ? '📹 Chrono Görüntülü Arama' : '📞 Chrono Sesli Arama',
          body: `${otherUserName} ile görüşme devam ediyor · Dokunarak uygulamaya dönün`,
          data: { callId, type: 'active_call', isSilent: true, startTime },
          sound: false,
          color: '#10B981',
          priority: Notifications.AndroidNotificationPriority.LOW,
          sticky: true,
          autoDismiss: false,
        },
        trigger: null,
      });
    } catch (err) {
      console.warn('Aktif arama bildirimi hatası:', err);
    }
  }

  // Aktif arama sonlandığında (hang up / reject) canlı kartı kapat ve servisi durdur
  async dismissOngoingCallNotification() {
    try {
      if (Platform.OS === 'android') {
        await foregroundServiceManager.stopCallForegroundService();
      }
      await Notifications.dismissNotificationAsync('active_voice_call');
      await Notifications.dismissNotificationAsync('active_call_notif').catch(() => {});
      await Notifications.dismissNotificationAsync('chrono_ongoing_call').catch(() => {});
    } catch (err) {
      // yut
    }
  }

  // Odalardaki sesli sohbet için SESSİZ bildirim (arama gibi çalmaz)
  async showSilentVoiceRoomNotification(roomName: string, userDisplayName: string, roomId: string) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: `🎙️ ${roomName}`,
          body: `${userDisplayName} sesli sohbete katıldı`,
          data: { roomId, type: 'voice_room', isSilent: true },
          sound: false,
          ...(Platform.OS === 'android' ? { channelId: 'silent_channel' } : {}),
        },
        trigger: null,
      });
    } catch (err) {
      console.warn('Sessiz sesli sohbet bildirimi hatası:', err);
    }
  }
}

export const notificationService = new NotificationService();
