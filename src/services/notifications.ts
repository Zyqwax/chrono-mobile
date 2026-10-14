import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
} from '@notifee/react-native';
import { foregroundServiceManager } from './foregroundService';
import { useChatStore } from '../store/useChatStore';
import { callSoundService } from './sound';
import { callKeepService } from './callkeep';

// Uygulama açıkken bildirimlerin görünüm davranışı (Foreground Filtering / Çift Bildirim Engelleyici)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    const data = notification.request.content.data;

    // 1. Arama bildirimleri (Notifee ve CallKeep tarafından yönetilir, Expo Notification bastırılır)
    if (data?.type === 'incoming_call' || data?.type === 'call_cancelled') {
      return {
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: false,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // 2. Aktif oda kontrolü: Eğer kullanıcı o an bildirimin geldiği odayı açık tutuyorsa bildirimi ve sesi bastır
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

    // 3. Sessiz veya devam eden arama bildirimleri
    const isSilent = Boolean(data?.isSilent || data?.type === 'active_call');
    if (isSilent) {
      return {
        shouldShowAlert: false,
        shouldShowBanner: false,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      };
    }

    // 4. Diğer durumlarda banner/list göster, ses kullanıcı ayarına göre
    const settings = useChatStore?.getState?.()?.settings;
    const shouldPlaySound = settings?.inAppSounds ?? true;

    return {
      shouldShowAlert: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound,
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
          await notifee.deleteChannel('chrono_incoming_calls_v2').catch(() => {});
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

  /**
   * Yeni sohbet mesajı bildirimi (Uygulama açıkken/arka plandayken gelen soket mesajları için anlık bildirim)
   */
  async showMessageNotification(senderName: string, body: string, roomId: string) {
    try {
      const activeRoomId = useChatStore?.getState?.()?.activeRoom?.id;
      if (activeRoomId === roomId) return;

      const settings = useChatStore?.getState?.()?.settings;
      const shouldPlaySound = settings?.inAppSounds ?? true;

      await Notifications.scheduleNotificationAsync({
        identifier: `msg_${roomId}_${Date.now()}`,
        content: {
          title: senderName,
          body: body || 'Yeni bir mesajınız var',
          data: { roomId, type: 'message' },
          sound: shouldPlaySound ? 'default' : undefined,
          priority: Notifications.AndroidNotificationPriority.HIGH,
        },
        trigger: null,
      });
    } catch (err) {
      console.warn('showMessageNotification hatası:', err);
    }
  }

  // Kullanıcı odaya girdiğinde ilgili odanın bildirimlerini temizle
  async clearRoomNotifications(roomId: string) {
    try {
      await Notifications.dismissNotificationAsync(`chat_${roomId}`).catch(() => {});
      const presented = await Notifications.getPresentedNotificationsAsync();
      for (const notif of presented) {
        const notifData = notif.request?.content?.data;
        if (notifData?.roomId === roomId || notif.request?.identifier === `chat_${roomId}`) {
          await Notifications.dismissNotificationAsync(notif.request.identifier).catch(() => {});
        }
      }
    } catch (err) {
      // yut
    }
  }

  // Gelen arama bildirimi (Heads-up / Tam bildirim, kesintisiz zil sesi ve titreşim)
  async showCallNotification(callerName: string, isVideo: boolean, callId: string) {
    try {
      if (Platform.OS === 'android') {
        try {
          await notifee.deleteChannel('chrono_incoming_calls_v2').catch(() => {});
          await notifee.createChannel({
            id: 'chrono_incoming_calls_v3',
            name: 'Gelen Aramalar',
            importance: AndroidImportance.HIGH,
            sound: 'ringtone',
            vibration: true,
            vibrationPattern: [0, 1000, 800, 1000],
          });

          const notifId = `call_${callId}`;
          await notifee.displayNotification({
            id: notifId,
            title: isVideo ? '📹 Gelen Görüntülü Arama' : '📞 Gelen Sesli Arama',
            body: `${callerName} sizi arıyor...`,
            data: { callId, type: 'incoming_call', roomId: '', callerName, video: String(isVideo) },
            android: {
              channelId: 'chrono_incoming_calls_v3',
              category: AndroidCategory.CALL,
              importance: AndroidImportance.HIGH,
              visibility: AndroidVisibility.PUBLIC,
              sound: 'ringtone',
              loopSound: true,
              ongoing: true,
              autoCancel: false,
              timeoutAfter: 30000,
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

          // 30 saniyelik zaman aşımı: Arama yanıtlanmazsa temizle
          if (this.callTimeouts.has(callId)) {
            clearTimeout(this.callTimeouts.get(callId));
          }
          const timeout = setTimeout(() => {
            void this.dismissCallNotification(callId);
            const state = useChatStore?.getState?.();
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
          title: isVideo ? '📹 Gelen Görüntülü Arama' : '📞 Gelen Sesli Arama',
          body: `${callerName} sizi arıyor...`,
          data: { callId, type: 'incoming_call' },
          sound: 'ringtone.wav',
          color: '#10B981',
          priority: Notifications.AndroidNotificationPriority.MAX,
          ...(Platform.OS === 'android' ? { channelId: 'calls_channel_v2' } : {}),
        },
        trigger: null,
      });
      this.currentCallNotificationId = notifId;
    } catch (err) {
      console.warn('Arama bildirimi gösterme hatası:', err);
    }
  }

  // Arama sonlandığında gelen arama bildirimini ve sesleri temizle
  async dismissCallNotification(callId?: string) {
    void callSoundService.stopAll();

    if (callId) {
      if (this.callTimeouts.has(callId)) {
        clearTimeout(this.callTimeouts.get(callId));
        this.callTimeouts.delete(callId);
      }
      callKeepService.endCall(callId);
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
