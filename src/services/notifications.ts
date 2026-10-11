import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Uygulama açıkken bildirimlerin görünüm davranışı
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;
    const isSilent = Boolean(data?.isSilent || data?.type === 'active_call');
    return {
      shouldShowAlert: !isSilent,
      shouldPlaySound: !isSilent,
      shouldSetBadge: false,
      shouldShowBanner: !isSilent,
      shouldShowList: true,
    };
  },
});

class NotificationService {
  private isConfigured = false;
  private currentCallNotificationId: string | null = null;

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
        // 1. Mesaj Bildirim Kanalı (Öncelikli & Sesli)
        await Notifications.setNotificationChannelAsync('messages_channel', {
          name: 'Mesajlar',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#38BDF8',
        });

        // 2. Gelen Arama Bildirim Kanalı (En yüksek öncelik / Heads-up)
        await Notifications.setNotificationChannelAsync('calls_channel', {
          name: 'Gelen Aramalar',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 1000, 1000, 1000],
          lightColor: '#10B981',
        });

        // Eski ses çıkaran ongoing kanalını temizle
        try {
          await Notifications.deleteNotificationChannelAsync('ongoing_calls_channel');
        } catch {
          // yut
        }

        // 3. Aktif Görüşme Bildirim Kanalı (Canlı, sessiz, ötmeyen bildirim çubuğu)
        await Notifications.setNotificationChannelAsync('ongoing_calls_channel_v2', {
          name: 'Aktif Görüşmeler (Canlı Bildirim)',
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

  // Giden / Yeni gelen mesajlar için bildirim
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

      await Notifications.scheduleNotificationAsync({
        content: {
          title: senderName,
          body: displayText,
          data: { roomId, type: 'message' },
          sound: true,
          color: '#38BDF8',
          ...(Platform.OS === 'android' ? { channelId: 'messages_channel' } : {}),
        },
        trigger: null, // Hemen göster
      });
    } catch (err) {
      console.warn('Mesaj bildirimi gösterme hatası:', err);
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

  // Aktif arama devam ederken bildirim panelinde kalıcı sessiz canlı arama kartı göster
  async showOngoingCallNotification(
    otherUserName: string,
    isVideo: boolean,
    callId: string,
    durationText?: string,
  ) {
    try {
      await Notifications.scheduleNotificationAsync({
        identifier: 'chrono_ongoing_call',
        content: {
          title: isVideo ? '📹 Chrono Görüntülü Arama' : '📞 Chrono Sesli Arama',
          body: `${otherUserName} ile görüşme devam ediyor ${durationText ? `(${durationText})` : ''} · Dokunarak uygulamaya dönün`,
          data: { callId, type: 'active_call', isSilent: true },
          sound: false,
          color: '#10B981',
          priority: Notifications.AndroidNotificationPriority.LOW,
          sticky: true,
          autoDismiss: false,
          vibrate: [],
          ...(Platform.OS === 'android' ? { channelId: 'ongoing_calls_channel_v2' } : {}),
        },
        trigger: null,
      });
    } catch (err) {
      console.warn('Aktif arama bildirimi hatası:', err);
    }
  }

  // Aktif arama sonlandığında bildirim panelindeki kalıcı kartı temizle
  async dismissOngoingCallNotification() {
    try {
      await Notifications.dismissNotificationAsync('chrono_ongoing_call');
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
