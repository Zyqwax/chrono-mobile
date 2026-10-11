import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { foregroundServiceManager } from './foregroundService';

// Uygulama açıkken bildirimlerin görünüm davranışı
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isSilent = Boolean(data?.isSilent || data?.type === 'active_call');
    return {
      shouldShowBanner: !isSilent,
      shouldShowList: true,
      shouldPlaySound: !isSilent,
      shouldSetBadge: false,
    };
  },
});

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

        // 1. Sohbet Mesaj Bildirim Kanalı (Öncelikli & Titreşimli)
        await Notifications.setNotificationChannelAsync('chat-messages', {
          name: 'Sohbet Mesajları',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38BDF8',
          enableVibrate: true,
          showBadge: true,
        });

        // 2. Gelen Arama Bildirim Kanalı (En yüksek öncelik / Heads-up)
        await Notifications.setNotificationChannelAsync('calls_channel', {
          name: 'Gelen Aramalar',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 1000, 1000, 1000],
          lightColor: '#10B981',
          enableVibrate: true,
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
  async showMessageNotification(senderName: string, text: string, roomId: string) {
    try {
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
          sound: true,
          color: '#38BDF8',
          ...(Platform.OS === 'android' ? { channelId: 'chat-messages' } : {}),
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

  // Gelen arama bildirimi (Heads-up / Tam bildirim)
  async showCallNotification(callerName: string, isVideo: boolean, callId: string) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: isVideo ? '📹 Gelen Görüntülü Arama' : '📞 Gelen Sesli Arama',
          body: `${callerName} sizi arıyor...`,
          data: { callId, type: 'call' },
          sound: true,
          color: '#10B981',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' ? { channelId: 'calls_channel' } : {}),
        },
        trigger: null,
      });
      this.currentCallNotificationId = id;
    } catch (err) {
      console.warn('Arama bildirimi gösterme hatası:', err);
    }
  }

  // Arama sonlandığında gelen arama bildirimini temizle
  async dismissCallNotification() {
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
