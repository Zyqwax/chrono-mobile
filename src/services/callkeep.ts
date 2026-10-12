import { Platform } from 'react-native';

let RNCallKeep: any = null;
let isCallKeepAvailable = false;

try {
  // Native build ortamında modülü yükle
  RNCallKeep = require('react-native-callkeep').default;
  if (RNCallKeep && typeof RNCallKeep.setup === 'function') {
    isCallKeepAvailable = true;
  }
} catch (e) {
  // Expo Go veya native olmayan ortamda sessizce devre dışı bırak
  isCallKeepAvailable = false;
}

const displayedCallIds = new Set<string>();

export interface CallKeepCallbacks {
  onAnswerCall: (callId: string) => void;
  onEndCall: (callId: string) => void;
}

class CallKeepService {
  private isInitialized = false;

  async setup(callbacks: CallKeepCallbacks) {
    if (!isCallKeepAvailable || !RNCallKeep || this.isInitialized) return;

    try {
      const options = {
        ios: {
          appName: 'Chrono',
          supportsVideo: true,
          maximumCallGroups: '1',
          maximumCallsPerCallGroup: '1',
        },
        android: {
          alertTitle: 'Arama İzni Gerekli',
          alertDescription: 'Chrono uygulamasının arama yapabilmesi ve alabilmesi için telefon izinlerine ihtiyacı var.',
          cancelButton: 'İptal',
          okButton: 'Tamam',
          imageName: 'ic_launcher',
          selfManaged: true,
          additionalPermissions: ['android.permission.READ_PHONE_STATE', 'android.permission.CALL_PHONE'],
          foregroundService: {
            channelId: 'chrono_calls',
            channelName: 'Chrono Aramalar',
            notificationTitle: 'Chrono Aktif Arama',
            notificationIcon: 'ic_launcher',
          },
        },
      };

      await RNCallKeep.setup(options);
      RNCallKeep.setAvailable(true);

      if (Platform.OS === 'android') {
        try {
          RNCallKeep.registerPhoneAccount();
          RNCallKeep.registerAndroidEvents();
        } catch (e) {
          console.warn('CallKeep registerPhoneAccount error:', e);
        }
      }

      RNCallKeep.addEventListener('answerCall', ({ callUUID }: { callUUID: string }) => {
        displayedCallIds.delete(callUUID);
        callbacks.onAnswerCall(callUUID);
      });

      RNCallKeep.addEventListener('endCall', ({ callUUID }: { callUUID: string }) => {
        displayedCallIds.delete(callUUID);
        callbacks.onEndCall(callUUID);
      });

      this.isInitialized = true;
      console.log('📱 CallKeep (CallKit / TelecomManager) başarıyla başlatıldı.');
    } catch (err) {
      console.warn('CallKeep kurulum uyarısı:', err);
    }
  }

  async hasPhoneAccount(): Promise<boolean> {
    if (Platform.OS !== 'android' || !isCallKeepAvailable || !RNCallKeep) return true;
    try {
      return await RNCallKeep.hasPhoneAccount();
    } catch {
      return false;
    }
  }

  openPhoneAccounts() {
    if (Platform.OS === 'android' && isCallKeepAvailable && RNCallKeep) {
      try {
        RNCallKeep.openPhoneAccounts();
      } catch (e) {
        console.warn('openPhoneAccounts error:', e);
      }
    }
  }

  displayIncomingCall(callId: string, callerName: string, hasVideo = false) {
    if (!isCallKeepAvailable || !RNCallKeep) return;
    if (displayedCallIds.has(callId)) {
      console.log(`📱 [CallKeep] Arama zaten gösterildi (deduped): ${callId}`);
      return;
    }
    displayedCallIds.add(callId);
    try {
      RNCallKeep.displayIncomingCall(
        callId,
        callerName,
        callerName,
        'number',
        hasVideo,
      );
    } catch (err) {
      console.warn('CallKeep gelen arama gösterme hatası:', err);
    }
  }

  startOutgoingCall(callId: string, calleeName: string, hasVideo = false) {
    if (!isCallKeepAvailable || !RNCallKeep) return;
    try {
      RNCallKeep.startCall(callId, calleeName, calleeName, 'number', hasVideo);
    } catch (err) {
      console.warn('CallKeep giden arama hatası:', err);
    }
  }

  reportConnectedCall(callId: string) {
    if (!isCallKeepAvailable || !RNCallKeep) return;
    try {
      RNCallKeep.setCurrentCallActive(callId);
    } catch (err) {
      console.warn('CallKeep arama aktif hatası:', err);
    }
  }

  endCall(callId: string) {
    displayedCallIds.delete(callId);
    if (!isCallKeepAvailable || !RNCallKeep) return;
    try {
      RNCallKeep.endCall(callId);
    } catch (err) {
      console.warn('CallKeep arama sonlandırma hatası:', err);
    }
  }
}

export const callKeepService = new CallKeepService();
