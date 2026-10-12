import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import notifee, { AndroidCategory, AndroidImportance } from '@notifee/react-native';
import { foregroundServiceManager } from './foregroundService';
import { useChatStore } from '../store/useChatStore';
import { callSoundService } from './sound';

// Uygulama açıkken bildirimlerin görünüm davranışı (Foreground Filtering / Çift Bildirim Engelleyici)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isSilent = Boolean(data?.isSilent || data?.type === 'active_call');

    // Aktif oda kontrolü: Eğer kullanıcı o an bildirimin geldiği odayı açık tutuyorsa bildirimi ve sesi bastır!
    const activeRoomId = useChatStore?.getState?.()?.activeRoom?.id;
    if (data?.roomId && activeRoomId === data.roomId) {
      return {
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    return {
      shouldShowAlert: !isSilent,
      shouldShowBanner: !isSilent,
      shouldShowList: true,
      shouldPlaySound: !isSilent,
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
  // Geliştirme ve test süreçlerinde DB'de push token'ın boş kalmaması için geçerli Expo formatında belirteç üretilir.
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
    '293cda25-728d-4ab4-b77f-df2db668e2f1';

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
  // Oda bazlı okunmamış mesaj sayaçları (WhatsApp stili stackleme için)
  private roomUnreadCounts = new Map<string, number>();

  async init() {
    if (this.isConfigured) return;

    try {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (Platform.OS === 'android') {
        // Eski kanalları temizle
        try {
          await Notifications.deleteNotificationChannelAsync('messages_channel');
          await Notifications.deleteNotificationChannelAsync('ongoing_calls_channel');
          await Notifications.deleteNotificationChannelAsync('ongoing_calls_channel_v2');
        } catch {
          // yut
        }

        // 1. Sohbet Mesaj Bildirim Kanalı (En yüksek öncelik MAX & Titreşimli)
        await Notifications.setNotificationChannelAsync('chat-messages', {
          name: 'Sohbet Mesajları',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38BDF8',
          enableVibrate: true,
          showBadge: true,
        });

        // 2. Gelen Arama Bildirim Kanalı (En yüksek öncelik / Heads-up / Zil Sesi Akışı)
        await Notifications.setNotificationChannelAsync('calls_channel_v2', {
          name: 'Gelen Aramalar',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 1000, 800, 1000],
          lightColor: '#10B981',
          enableVibrate: true,
          sound: undefined,
          audioAttributes: {
            usage: Notifications.AndroidAudioUsage.NOTIFICATION_RINGTONE,
            contentType: Notifications.AndroidAudioContentType.SONIFICATION,
            flags: {
              enforceAudibility: true,
              requestHardwareAudioVideoSynchronization: false,
            },
          },
        });

        // 3. Canlı Sesli Arama Bildirim Kanalı (Sessiz, titreşimsiz, düşük önem düzeyi)
        await Notifications.setNotificationChannelAsync('ongoing-call', {
          name: 'Aktif Görüşme',
          importance: Notifications.AndroidImportance.LOW,
          vibrationPattern: [],
          sound: null,
          enableVibrate: false,
          lightColor: '#10B981',
          lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
        });

        // 4. Sessiz Bildirim Kanalı (Sesli sohbet başlangıçları vb.)
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

  // Sohbet odasından yeni mesaj geldiğinde bildirim göster (WhatsApp stili stackleme)
  async showMessageNotification(
    senderName: string,
    text: string,
    roomId: string,
    options?: { playSound?: boolean },
  ) {
    try {
      const playSound = options?.playSound ?? true;

      // Eğer arama JSON objesi geldiyse bildirim olarak ham JSON gösterme
      let displayText = text;
      if (typeof text === 'string' && text.trim().startsWith('{') && text.includes('"status"')) {
        try {
          const parsed = JSON.parse(text);
          if (parsed.status === 'ended') {
            // Normal sonlanan arama için bildirim gösterilmez
            return;
          }
          if (
            parsed.status === 'missed' ||
            parsed.status === 'declined' ||
            parsed.status === 'busy' ||
            parsed.status === 'cancelled'
          ) {
            displayText = parsed.video ? '📹 Cevapsız görüntülü arama' : '📞 Cevapsız sesli arama';
          } else {
            return;
          }
        } catch {
          // JSON parse edilemediyse normal metin olarak devam et
        }
      }

      // Oda bazlı okunmamış mesaj sayacını artır
      const unreadCount = (this.roomUnreadCounts.get(roomId) || 0) + 1;
      this.roomUnreadCounts.set(roomId, unreadCount);

      // WhatsApp Stili Format:
      // 1 mesaj varsa sadece mesaj metni; birden fazla varsa "${unreadCount} yeni mesaj: ${sonMesaj}"
      const notificationBody =
        unreadCount > 1 ? `${unreadCount} yeni mesaj: ${displayText}` : displayText;

      await Notifications.scheduleNotificationAsync({
        identifier: `chat_${roomId}`, // Sabit identifier: bildirim paneli dolmak yerine mevcut bildirim güncellenir
        content: {
          title: senderName,
          body: notificationBody,
          data: { roomId, type: 'message' },
          sound: playSound,
          color: '#38BDF8',
          ...(Platform.OS === 'android'
            ? { channelId: playSound ? 'chat-messages' : 'silent_channel' }
            : {}),
          ...(Platform.OS === 'ios' ? { threadIdentifier: `room_${roomId}` } : {}),
        },
        trigger: null, // Hemen göster
      });
    } catch (err) {
      console.warn('Mesaj bildirimi gösterme hatası:', err);
    }
  }

  // Kullanıcı odaya girdiğinde ilgili odanın bildirimini temizle ve sayacı sıfırla
  async clearRoomNotifications(roomId: string) {
    try {
      this.roomUnreadCounts.delete(roomId);
      await Notifications.dismissNotificationAsync(`chat_${roomId}`);
    } catch (err) {
      // yut
    }
  }

  // Gelen arama bildirimi (Heads-up / Tam bildirim, kesintisiz zil sesi ve titreşim)
  async showCallNotification(callerName: string, isVideo: boolean, callId: string) {
    try {
      if (Platform.OS === 'android') {
        try {
          await notifee.createChannel({
            id: 'chrono_incoming_calls_v2',
            name: 'Gelen Aramalar',
            importance: AndroidImportance.HIGH,
            sound: undefined,
            vibration: true,
            vibrationPattern: [0, 1000, 800, 1000],
          });

          const notifId = await notifee.displayNotification({
            id: `call_${callId}`,
            title: isVideo ? '📹 Gelen Görüntülü Arama' : '📞 Gelen Sesli Arama',
            body: `${callerName} sizi arıyor...`,
            data: { callId, type: 'call' },
            android: {
              channelId: 'chrono_incoming_calls_v2',
              category: AndroidCategory.CALL,
              importance: AndroidImportance.HIGH,
              sound: 'default',
              loopSound: true,
              ongoing: true,
              vibrationPattern: [0, 1000, 800, 1000],
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
          return;
        } catch (e) {
          console.warn('Notifee arama bildirimi hatası:', e);
        }
      }

      // iOS ve fallback ortamlar için expo-notifications
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: isVideo ? '📹 Gelen Görüntülü Arama' : '📞 Gelen Sesli Arama',
          body: `${callerName} sizi arıyor...`,
          data: { callId, type: 'call' },
          sound: true,
          color: '#10B981',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' ? { channelId: 'calls_channel_v2' } : {}),
        },
        trigger: null,
      });
      this.currentCallNotificationId = id;
    } catch (err) {
      console.warn('Arama bildirimi gösterme hatası:', err);
    }
  }

  // Arama sonlandığında gelen arama bildirimini ve sesleri temizle
  async dismissCallNotification(callId?: string) {
    void callSoundService.stopAll();

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
      await Notifications.dismissNotificationAsync('active_call_notif').catch(() => { });
      await Notifications.dismissNotificationAsync('chrono_ongoing_call').catch(() => { });
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
