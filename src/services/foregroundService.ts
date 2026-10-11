import { PermissionsAndroid, Platform } from 'react-native';
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
  EventType,
} from '@notifee/react-native';

export const CALL_FG_CHANNEL_ID = 'ongoing-call-channel';
export const CALL_NOTIFICATION_ID = 'active_call_notif';

type CallPressListener = () => void;
const pressListeners = new Set<CallPressListener>();

// Android 14+ Foreground Service runner kaydı (Global dosya seviyesinde, component dışı)
if (Platform.OS === 'android') {
  try {
    notifee.registerForegroundService((_notification) => {
      return new Promise(() => {
        // Arama sürdüğü sürece bu promise resolve edilmez (servis arka planda canlı kalır).
      });
    });
    console.log('🛡️ Android Foreground Service runner başarıyla kaydedildi.');
  } catch (err) {
    console.warn('registerForegroundService kaydı hatası:', err);
  }

  // Notifee background event dinleyicisi (uyarı loglarını önler)
  try {
    notifee.onBackgroundEvent(async () => {});
  } catch {}

  // Bildirime tıklandığında uygulamayı ve aktif görüşmeyi ön plana taşıma dinleyicisi
  try {
    notifee.onForegroundEvent(({ type, detail }) => {
      if (
        type === EventType.PRESS &&
        (detail.notification?.id === CALL_NOTIFICATION_ID ||
          detail.notification?.id === 'chrono_ongoing_call' ||
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
  callId?: string;
  otherUserName?: string;
  callerName?: string;
  isVideo?: boolean;
  startTime?: number;
}

/**
 * Arama başladığında Android 14+ uyumlu güvenli Foreground Service başlatır.
 * Hem nesne parametresi hem de (callerName, startTime) fonksiyon imzası desteklenir.
 */
export async function startCallForegroundService(
  optionsOrCallerName: string | StartForegroundCallOptions,
  maybeStartTime?: number,
): Promise<void> {
  if (Platform.OS !== 'android') return;

  let callerName = 'Kullanıcı';
  let callId = 'call_active';
  let isVideo = false;
  let startTime = Date.now();

  if (typeof optionsOrCallerName === 'string') {
    callerName = optionsOrCallerName;
    if (typeof maybeStartTime === 'number') {
      startTime = maybeStartTime;
    }
  } else if (optionsOrCallerName && typeof optionsOrCallerName === 'object') {
    callerName =
      optionsOrCallerName.callerName ||
      optionsOrCallerName.otherUserName ||
      'Kullanıcı';
    callId = optionsOrCallerName.callId || 'call_active';
    isVideo = !!optionsOrCallerName.isVideo;
    startTime = optionsOrCallerName.startTime || Date.now();
  }

  try {
    // 1. Android 13+ Bildirim ve Mikrofon izni kontrolü (İzin yoksa servis başlatma! SecurityException'ı önler)
    const notifSettings = await notifee.requestPermission();
    const isNotifGranted =
      (notifSettings as any)?.granted ??
      (notifSettings?.authorizationStatus !== undefined &&
        notifSettings.authorizationStatus >= 1);

    if (!isNotifGranted) {
      console.warn('⚠️ Bildirim izni verilmedi (POST_NOTIFICATIONS), foreground service başlatılamıyor.');
      return;
    }

    let micGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
    );
    if (!micGranted) {
      const micStatus = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      );
      micGranted = micStatus === PermissionsAndroid.RESULTS.GRANTED;
    }

    if (!micGranted) {
      console.warn('⚠️ Mikrofon izni verilmedi (RECORD_AUDIO), foreground service başlatılamıyor.');
      return;
    }

    // 2. Kanal Oluştur (Sessiz ve titreşimsiz düşük öncelikli kanal)
    const channelId = await notifee.createChannel({
      id: CALL_FG_CHANNEL_ID,
      name: 'Devam Eden Arama',
      importance: AndroidImportance.LOW,
      sound: undefined,
      vibration: false,
    });

    // 3. Bildirimi ve Servisi Başlat (Android 14+ foregroundServiceType desteğiyle)
    await notifee.displayNotification({
      id: CALL_NOTIFICATION_ID,
      title: isVideo
        ? `📹 Chrono Görüntülü Arama: ${callerName}`
        : `📞 Görüşme Sürüyor: ${callerName}`,
      body: 'Görüşmeye dönmek için dokunun',
      data: {
        callId,
        type: 'active_call',
      },
      android: {
        channelId,
        asForegroundService: true,
        // Android 14+ için zorunlu servis tipleri (MICROPHONE ve PHONE_CALL):
        foregroundServiceTypes: [
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE,
          AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_PHONE_CALL,
        ],
        ongoing: true,
        autoCancel: false,
        color: '#10B981',
        showChronometer: true,
        chronometerDirection: 'up',
        timestamp: startTime,
        pressAction: {
          id: 'default',
        },
      },
    });

    foregroundServiceManager.setRunning(true);
    console.log('🚀 Android Foreground Service (Aktif Arama) başarıyla başlatıldı.');
  } catch (error) {
    console.error('Foreground service başlatılamadı:', error);
  }
}

/**
 * Arama sonlandığında Foreground Service ve bildirimleri güvenle temizler.
 */
export async function stopCallForegroundService(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    foregroundServiceManager.setRunning(false);
    await notifee.stopForegroundService();
    console.log('🛑 Android Foreground Service durduruldu.');
  } catch (e) {
    console.warn('Servis durdurma hatası:', e);
  }

  try {
    await notifee.cancelNotification(CALL_NOTIFICATION_ID);
    await notifee.cancelNotification('chrono_ongoing_call');
  } catch (e) {
    console.warn('Bildirim iptal hatası:', e);
  }
}

class ForegroundServiceManager {
  private isRunning = false;

  setRunning(value: boolean) {
    this.isRunning = value;
  }

  isServiceRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Bildirime tıklandığında arama modalını açmak için dinleyici kaydet
   */
  onNotificationPress(callback: CallPressListener) {
    pressListeners.add(callback);
    return () => {
      pressListeners.delete(callback);
    };
  }

  async startCallForegroundService(
    options: StartForegroundCallOptions,
  ): Promise<void> {
    return startCallForegroundService(options);
  }

  async stopCallForegroundService(): Promise<void> {
    return stopCallForegroundService();
  }
}

export const foregroundServiceManager = new ForegroundServiceManager();

