import { PermissionsAndroid, Platform } from 'react-native';
import notifee, {
  AndroidForegroundServiceType,
  AndroidImportance,
  Event,
  EventType,
} from '@notifee/react-native';
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

export const CALL_FG_CHANNEL_ID = 'ongoing-call-channel';
export const CALL_NOTIFICATION_ID = 'active_call_notif';

type CallPressListener = () => void;
const pressListeners = new Set<CallPressListener>();

type RoomPressListener = (roomId: string) => void;
const roomPressListeners = new Set<RoomPressListener>();
let pendingNavigationRoomId: string | null = null;

/**
 * Notifee ön plan ve arka plan bildirim olaylarını (Cevapla/Reddet aksiyonları, Okundu işaretleme, tıklamalar) tek merkezden yönetir.
 */
export async function handleNotifeeEvent({ type, detail }: Event) {
  const { notification, pressAction } = detail;
  const pressActionId = pressAction?.id;
  const data = notification?.data;
  const roomId = data?.roomId as string | undefined;
  const callId =
    (data?.callId as string) ||
    (notification?.id?.startsWith('call_')
      ? notification.id.replace('call_', '')
      : undefined);

  if (type === EventType.ACTION_PRESS) {
    if (pressActionId === 'answer_call') {
      console.log('📞 [Notifee Action] answer_call tıklandı, callId:', callId);
      void callSoundService.stopAll();
      if (callId) {
        if (notification?.id) {
          await notifee.cancelNotification(notification.id).catch(() => {});
        }
        await notifee.cancelNotification(`call_${callId}`).catch(() => {});
        callKeepService.reportConnectedCall(callId);

        const chatStore = getChatStore()?.getState();
        if (chatStore) {
          if (!chatStore.activeCall && data) {
            const isVideo = (data.video as any) === true || String(data.video) === 'true';
            const currentUser = chatStore.currentUser || {
              id: '',
              username: 'Ben',
              displayName: 'Ben',
            };
            chatStore.setActiveCall({
              callId,
              roomId: (data.roomId as string) || '',
              caller: {
                id: '',
                username: (data.callerName as string) || 'Kullanıcı',
                displayName: (data.callerName as string) || 'Kullanıcı',
              },
              callee: currentUser,
              video: isVideo,
              state: 'ringing',
              startedAt: Date.now(),
              mediaRoom: (data.roomId as string) ? `call_${data.roomId}` : `call_${callId}`,
            });
          }
          await chatStore.acceptCall(callId);
        }
      }
      // Uygulamayı arama modalına yönlendir
      pressListeners.forEach((listener) => {
        try {
          listener();
        } catch {}
      });
    } else if (pressActionId === 'decline_call') {
      console.log('📞 [Notifee Action] decline_call tıklandı, callId:', callId);
      void callSoundService.stopAll();
      if (callId) {
        if (notification?.id) {
          await notifee.cancelNotification(notification.id).catch(() => {});
        }
        await notifee.cancelNotification(`call_${callId}`).catch(() => {});
        await getChatStore()?.getState()?.declineCall(callId);
      }
    } else if (pressActionId === 'mark_read' && roomId) {
      if (notification?.id) {
        await notifee.cancelNotification(notification.id).catch(() => {});
      }
      await notifee.cancelNotification(`chat_${roomId}`).catch(() => {});
      try {
        const { notificationService } = require('./notifications');
        await notificationService.clearRoomNotifications(roomId);
      } catch {}
      await getChatStore()?.getState()?.markAsRead(roomId);
    }
  } else if (type === EventType.PRESS) {
    if (data?.type === 'message' && roomId) {
      try {
        const { notificationService } = require('./notifications');
        void notificationService.clearRoomNotifications(roomId);
      } catch {}
      if (roomPressListeners.size > 0) {
        roomPressListeners.forEach((listener) => {
          try {
            listener(roomId);
          } catch {}
        });
      } else {
        pendingNavigationRoomId = roomId;
      }
      return;
    }

    pressListeners.forEach((listener) => {
      try {
        listener();
      } catch {}
    });
  }
}

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

  // Ortak Notifee dinleyicileri (Arka plan ve ön plan olayları)
  try {
    notifee.onBackgroundEvent(handleNotifeeEvent);
    notifee.onForegroundEvent(handleNotifeeEvent);
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

  /**
   * Sohbet mesajı bildirimine tıklandığında ilgili odaya yönlendirmek için dinleyici kaydet
   */
  onRoomNotificationPress(callback: RoomPressListener) {
    roomPressListeners.add(callback);
    if (pendingNavigationRoomId) {
      const target = pendingNavigationRoomId;
      pendingNavigationRoomId = null;
      setTimeout(() => {
        try {
          callback(target);
        } catch {}
      }, 100);
    }
    return () => {
      roomPressListeners.delete(callback);
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

