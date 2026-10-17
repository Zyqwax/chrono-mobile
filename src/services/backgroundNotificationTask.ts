import { AppState } from 'react-native';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { callKeepService } from './callkeep';
import { notificationService } from './notifications';
import { cryptoService } from './cryptoService';
import { useChatStore } from '../store/useChatStore';

export const CHRONO_BG_NOTIFICATION_TASK = 'CHRONO_BG_NOTIFICATION_TASK';

TaskManager.defineTask(CHRONO_BG_NOTIFICATION_TASK, async ({ data, executionInfo, error }: any) => {
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

    if (payload?.body && typeof payload.body === 'string' && payload.body.startsWith('{')) {
      try {
        payload = { ... JSON.parse(payload.body), ...payload };
      } catch {}
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
      await notificationService.showCallNotification(callerName, isVideo, callId, roomId);
    } else if (type === 'call_cancelled' && callId) {
      // Yalnızca gelen arama çalma bildirimini temizle
      await notificationService.dismissCallNotification(callId, false);

      const chatStore = useChatStore.getState();
      const currentCall = chatStore.activeCall;
      if (currentCall && currentCall.callId === callId) {
        if (currentCall.state === 'ringing') {
          chatStore.setActiveCall(null);
        }
      }
    } else if (type === 'message' && roomId) {
      // Uygulama şu an ön planda açıksa (active), bildirim gösterme
      if (AppState.currentState === 'active') {
        return;
      }

      const messageId = payload?.messageId ? String(payload.messageId) : undefined;
      if (messageId && notificationService.hasNotifiedMessage(messageId)) {
        return;
      }

      const senderName = payload?.senderName || payload?.title || 'Kullanıcı';
      const senderAvatar = payload?.senderAvatar || null;
      const roomName = payload?.roomName || senderName;
      const roomType = payload?.roomType || 'DIRECT';
      const roomIcon = payload?.roomIcon || null;
      const messageType = payload?.messageType || 'TEXT';
      const preview =
        payload?.preview === undefined
          ? true
          : payload.preview === true || payload.preview === 'true';

      let resolvedContent: string | null = payload?.content || null;

      // E2EE şifreli mesaj ise cihazdaki özel anahtar ile arka planda çöz
      if (
        !resolvedContent &&
        payload?.ciphertext &&
        payload?.nonce &&
        payload?.senderPublicKey
      ) {
        try {
          const decrypted = await cryptoService.decryptMessage(
            String(payload.ciphertext),
            String(payload.nonce),
            String(payload.senderPublicKey),
          );
          if (decrypted) {
            resolvedContent = decrypted;
          }
        } catch (decErr) {
          console.warn('[CHRONO_BG_NOTIFICATION_TASK] E2EE çözme uyarısı:', decErr);
        }
      }

      if (!resolvedContent) {
        resolvedContent = payload?.body || 'Yeni mesaj';
      }

      const timestamp = payload?.createdAt
        ? new Date(payload.createdAt).getTime() || Date.now()
        : Date.now();

      await notificationService.showMessageNotification({
        messageId,
        roomId,
        roomName,
        roomType,
        roomIcon,
        senderId: payload?.senderId,
        senderName,
        senderAvatar,
        messageType,
        content: resolvedContent,
        timestamp,
        preview,
      });
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
