import { Platform } from 'react-native';
import notifee, {
  AndroidImportance,
  EventType,
  type Notification,
} from '@notifee/react-native';

const CALL_FG_CHANNEL_ID = 'chrono_call_foreground';
const CALL_NOTIFICATION_ID = 'chrono_ongoing_call';

type CallPressListener = () => void;
const pressListeners = new Set<CallPressListener>();

let isForegroundServiceRegistered = false;

// Android ortamında Foreground Service işleyicisini tepe noktada kaydet
if (Platform.OS === 'android') {
  try {
    notifee.registerForegroundService((notification: Notification) => {
      return new Promise<void>(() => {
        // Bu Promise çözümlenmediği sürece Android, Foreground Service'i
        // ve bağlı olan WebRTC ses akışını arka planda/ekran kapalıyken öldürmez.
      });
    });
    isForegroundServiceRegistered = true;
    console.log('🛡️ Android Foreground Service runner başarıyla kaydedildi.');
  } catch (err) {
    console.warn('Foreground service kayıt uyarısı:', err);
  }

  // Bildirime tıklandığında uygulamayı ve aktif görüşmeyi ön plana taşıma dinleyicisi
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
   * Görüşme bağlandığında Android Foreground Service'i ve canlı arama kartını başlatır.
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

      // 2. Canlı bildirim kartını ve Foreground Service'i başlat
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
          asForegroundService: true, // Android Foreground Service'i bu bildirime bağlar
          ongoing: true, // Kullanıcı bildirimi yana kaydırıp kapatamaz
          autoCancel: false,
          color: '#10B981',
          showChronometer: true, // Android native kronometre (CPU uykudayken de ilerler)
          chronometerDirection: 'up',
          timestamp: startTime,
          smallIcon: 'ic_launcher',
          pressAction: {
            id: 'default',
          },
        },
      });

      this.isRunning = true;
      console.log('🚀 Android Foreground Service (Aktif Arama) başlatıldı.');
    } catch (err) {
      console.warn('Foreground Service başlatma hatası:', err);
    }
  }

  /**
   * Görüşme sonlandığında Foreground Service'i ve bildirimi temizler.
   */
  async stopCallForegroundService(): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      this.isRunning = false;
      await notifee.stopForegroundService();
      await notifee.cancelNotification(CALL_NOTIFICATION_ID).catch(() => {});
      console.log('🛑 Android Foreground Service durduruldu.');
    } catch (err) {
      console.warn('Foreground Service durdurma hatası:', err);
    }
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }
}

export const foregroundServiceManager = new ForegroundServiceManager();
