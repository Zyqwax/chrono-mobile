import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { callKeepService } from './callkeep';
import { notificationService } from './notifications';
import { useChatStore } from '../store/useChatStore';

export const CHRONO_BG_NOTIFICATION_TASK = 'CHRONO_BG_NOTIFICATION_TASK';

TaskManager.defineTask(CHRONO_BG_NOTIFICATION_TASK, async ({ data, executionInfo, error }: any) => {
  // Geçici log: Gelen payload yapısını doğrulamak için ilk satırda yazdırılır
  console.log('🔔 [CHRONO_BG_NOTIFICATION_TASK] Gelen veri:', JSON.stringify(data));

  if (error) {
    console.error('❌ [CHRONO_BG_NOTIFICATION_TASK] Task execution hatası:', error);
    return;
  }

  try {
    let payload: any = data;

    // Expo SDK sürümleri ve FCM / APNs yapıları arasındaki payload farklılıklarını çözümle
    if (data?.notification?.data) {
      payload = data.notification.data;
    } else if (data?.data) {
      payload = data.data;
    }

    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload);
      } catch {}
    }

    if (payload?.dataString && typeof payload.dataString === 'string') {
      try {
        payload = { ...payload, ...JSON.parse(payload.dataString) };
      } catch {}
    } else if (payload?.data && typeof payload.data === 'object') {
      payload = { ...payload, ...payload.data };
    }

    const type = payload?.type;
    const callId = payload?.callId;
    const roomId = payload?.roomId || '';
    const callerName = payload?.callerName || 'Chrono';
    const isVideo =
      payload?.video === true ||
      payload?.video === 'true' ||
      payload?.video === 1 ||
      payload?.video === '1';

    console.log(
      `🔔 [CHRONO_BG_NOTIFICATION_TASK] Çözümlendi -> type: ${type}, callId: ${callId}, callerName: ${callerName}, isVideo: ${isVideo}`,
    );

    if (type === 'incoming_call' && callId) {
      // Arka planda store'u hazırla (uygulama açıldığında görüşme modalı hazır olsun)
      const chatStore = useChatStore.getState();
      if (!chatStore.activeCall) {
        const currentUser = chatStore.currentUser || {
          id: '',
          username: 'Ben',
          displayName: 'Ben',
        };
        chatStore.setActiveCall({
          callId,
          roomId,
          caller: {
            id: '',
            username: callerName,
            displayName: callerName,
          },
          callee: currentUser,
          video: isVideo,
          state: 'ringing',
          startedAt: Date.now(),
          mediaRoom: roomId ? `call_${roomId}` : `call_${callId}`,
        });
      }

      // CallKeep ve Notifee ile arama çalmasını başlat (Set tabanlı dedupe çift girişi engeller)
      callKeepService.displayIncomingCall(callId, callerName, isVideo);
      await notificationService.showCallNotification(callerName, isVideo, callId);
    } else if (type === 'call_cancelled' && callId) {
      console.log(`🔔 [CHRONO_BG_NOTIFICATION_TASK] Arama iptal edildi, bildirim kaldırılıyor: ${callId}`);
      await notificationService.dismissCallNotification(callId);
      const chatStore = useChatStore.getState();
      if (chatStore.activeCall?.callId === callId) {
        chatStore.setActiveCall(null);
      }
    }
  } catch (err) {
    console.error('❌ [CHRONO_BG_NOTIFICATION_TASK] Hata:', err);
  }
});

// Arka plan bildirim dinleyicisini Expo Notifications motoruna kaydet
Notifications.registerTaskAsync(CHRONO_BG_NOTIFICATION_TASK)
  .then(() => {
    console.log('✅ [CHRONO_BG_NOTIFICATION_TASK] Görev Notifications servisine kaydedildi.');
  })
  .catch((err) => {
    console.warn('⚠️ [CHRONO_BG_NOTIFICATION_TASK] registerTaskAsync uyarısı:', err?.message || err);
  });
