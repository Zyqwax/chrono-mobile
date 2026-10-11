import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  EventType,
} from '@notifee/react-native';

const CALL_FG_CHANNEL_ID = 'chrono_call_foreground';
const CALL_NOTIFICATION_ID = 'chrono_ongoing_call';

type CallPressListener = () => void;
const pressListeners = new Set<CallPressListener>();

// Android ortamında bildirime tıklandığında uygulamayı ve aktif görüşmeyi ön plana taşıma dinleyicisi
if (Platform.OS === 'android') {
  try {
    notifee.onForegroundEvent(({ type, detail }) => {
      if (
        type === EventType.PRESS &&
        (detail.notification?.id === CALL_NOTIFICATION_ID ||
          detail.notification?.data?.type === 'active_call')
      ) {
        pressListeners.forEach((listener) => {
          try {
            listener();
          } catch {
            // yut
          }
        });
      }
    });
  } catch (err) {
    console.warn('Notifee event dinleyicisi hatası:', err);
  }
}

export interface StartForegroundCallOptions {
  callId: string;
  otherUserName: string;
  isVideo: boolean;
  startTime?: number;
}

class ForegroundServiceManager {
  private isRunning = false;

  /**
   * Bildirime tıklandığında modalı açmak için dinleyici kaydet
   */
  onNotificationPress(callback: CallPressListener) {
    pressListeners.add(callback);
    return () => {
      pressListeners.delete(callback);
    };
  }

  /**
   * Görüşme bağlandığında canlı arama kartını Android bildirim panelinde başlatır.
   * Not: Android 14+ SecurityException çökmesini önlemek için doğrudan kalıcı ongoing bildirim kullanılır.
   */
  async startCallForegroundService({
    callId,
    otherUserName,
    isVideo,
    startTime = Date.now(),
  }: StartForegroundCallOptions): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      // 1. Düşük öncelikli, sessiz ve titreşimsiz kanal oluştur
      await notifee.createChannel({
        id: CALL_FG_CHANNEL_ID,
        name: 'Chrono Aktif Görüşme',
        importance: AndroidImportance.LOW,
        vibration: false,
        sound: undefined,
        lights: true,
        lightColor: '#10B981',
      });

      // 2. Canlı bildirim kartını başlat (ongoing: true, donanımsal kronometre)
      await notifee.displayNotification({
        id: CALL_NOTIFICATION_ID,
        title: isVideo ? '📹 Chrono Görüntülü Arama' : '📞 Chrono Sesli Arama',
        body: `${otherUserName} ile görüşme devam ediyor · Dokunarak dönün`,
        data: {
          callId,
          type: 'active_call',
        },
        android: {
          channelId: CALL_FG_CHANNEL_ID,
          asForegroundService: false, // Android 14/15 FGS SecurityException çökmesini önler
          ongoing: true, // Kullanıcı bildirimi yana kaydırıp kapatamaz
          autoCancel: false,
          color: '#10B981',
          showChronometer: true, // Android native kronometre
          chronometerDirection: 'up',
          timestamp: startTime,
          smallIcon: 'ic_launcher',
          pressAction: {
            id: 'default',
          },
        },
      });

      this.isRunning = true;
      console.log('🚀 Canlı arama bildirim kartı başlatıldı.');
    } catch (err) {
      console.warn('Canlı arama bildirimi başlatma hatası:', err);
    }
  }

  /**
   * Görüşme sonlandığında bildirimi temizler.
   */
  async stopCallForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      this.isRunning = false;
      await notifee.cancelNotification(CALL_NOTIFICATION_ID).catch(() => {});
      console.log('🛑 Canlı arama bildirimi temizlendi.');
    } catch (err) {
      console.warn('Bildirim temizleme hatası:', err);
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const foregroundServiceManager = new ForegroundServiceManager();
