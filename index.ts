import { registerGlobals } from '@livekit/react-native';
registerGlobals();

// LiveKit / WebRTC görüşmesi sonlandırılırken peer connection kapatılması sırasında
// fırlayabilen zararsız 'NegotiationError: PC manager is closed' unhandled rejection'ını bastır
if (typeof globalThis !== 'undefined') {
  const originalRejectionHandler = (globalThis as any).onunhandledrejection;
  (globalThis as any).onunhandledrejection = (event: any) => {
    const reason = event?.reason || event;
    const msg = String(reason?.message || reason);
    if (
      msg.includes('PC manager is closed') ||
      reason?.name === 'NegotiationError'
    ) {
      return;
    }
    if (typeof originalRejectionHandler === 'function') {
      originalRejectionHandler(event);
    }
  };
}

import './src/services/foregroundService';
import './src/services/backgroundNotificationTask';
import 'expo-router/entry';
