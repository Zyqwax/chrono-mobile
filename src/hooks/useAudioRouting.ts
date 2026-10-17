import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { AudioSession } from '@livekit/react-native';
import { callKeepService } from '../services/callkeep';

export type AudioOutputDevice = 'bluetooth' | 'headset' | 'speaker' | 'earpiece';

export interface UseAudioRoutingOptions {
  callId?: string | null;
  isVideo?: boolean;
  isActive?: boolean;
}

export interface UseAudioRoutingReturn {
  availableOutputs: AudioOutputDevice[];
  currentOutput: AudioOutputDevice;
  selectAudioOutput: (target: AudioOutputDevice) => Promise<void>;
  toggleSpeaker: () => Promise<void>;
  refreshOutputs: () => Promise<void>;
  showRoutePicker: () => Promise<void>;
  isBluetoothAvailable: boolean;
  isHeadsetAvailable: boolean;
  hasMultipleOutputs: boolean;
  isAudioReady: boolean;
}

/**
 * Ses oturumunu (AudioSession), ses çıkış cihazlarını (Bluetooth, Kulaklık, Hoparlör, Ahize)
 * ve CallKeep entegrasyonunu yöneten modüler custom hook.
 */
export function useAudioRouting({
  callId = null,
  isVideo = false,
  isActive = false,
}: UseAudioRoutingOptions = {}): UseAudioRoutingReturn {
  const [availableOutputs, setAvailableOutputs] = useState<AudioOutputDevice[]>([
    'speaker',
    'earpiece',
  ]);
  const [currentOutput, setCurrentOutput] = useState<AudioOutputDevice>(
    isVideo ? 'speaker' : 'earpiece',
  );
  const [isAudioReady, setIsAudioReady] = useState(false);

  const isVideoRef = useRef(isVideo);
  isVideoRef.current = isVideo;

  const isSessionStartedRef = useRef(false);
  const userSelectedRef = useRef(false);

  // Mevcut ses çıkış cihazlarını sorgula ve güncelle
  const refreshOutputs = useCallback(async () => {
    try {
      if (Platform.OS === 'android') {
        const raw = await AudioSession.getAudioOutputs();
        const valid: AudioOutputDevice[] = [];

        if (Array.isArray(raw)) {
          for (const item of raw) {
            const lower = String(item).toLowerCase();
            if (lower === 'bluetooth' && !valid.includes('bluetooth')) valid.push('bluetooth');
            else if (lower === 'headset' && !valid.includes('headset')) valid.push('headset');
            else if (lower === 'speaker' && !valid.includes('speaker')) valid.push('speaker');
            else if (lower === 'earpiece' && !valid.includes('earpiece')) valid.push('earpiece');
          }
        }

        // En az hoparlör ve ahize daima olmalı
        if (!valid.includes('speaker')) valid.push('speaker');
        if (!valid.includes('earpiece')) valid.push('earpiece');

        // CallKeep audio routes kontrolü ile çift doğrulama
        try {
          const ckRoutes = await callKeepService.getAudioRoutes();
          if (Array.isArray(ckRoutes)) {
            for (const r of ckRoutes) {
              const rType = String(r.type || r.name || '').toLowerCase();
              if (rType.includes('bluetooth') && !valid.includes('bluetooth')) {
                valid.push('bluetooth');
              }
              if (rType.includes('headset') && !valid.includes('headset')) {
                valid.push('headset');
              }
              if (r.selected) {
                if (rType.includes('bluetooth')) setCurrentOutput('bluetooth');
                else if (rType.includes('speaker')) setCurrentOutput('speaker');
                else if (rType.includes('headset')) setCurrentOutput('headset');
                else if (rType.includes('phone') || rType.includes('earpiece')) setCurrentOutput('earpiece');
              }
            }
          }
        } catch {
          // yut
        }

        setAvailableOutputs(valid);

        // Kullanıcı elle bir seçim yapmadıysa öncelik sıralamasına göre aktif cihazı belirle
        if (!userSelectedRef.current) {
          if (valid.includes('bluetooth')) {
            setCurrentOutput('bluetooth');
          } else if (valid.includes('headset')) {
            setCurrentOutput('headset');
          } else if (isVideoRef.current) {
            setCurrentOutput('speaker');
          } else {
            setCurrentOutput('earpiece');
          }
        }
      } else {
        // iOS ortamı
        const iosOutputs: AudioOutputDevice[] = ['speaker', 'earpiece'];

        // CallKeep üzerinden Bluetooth / harici rota kontrolü
        try {
          const ckRoutes = await callKeepService.getAudioRoutes();
          let hasBluetooth = false;
          if (Array.isArray(ckRoutes)) {
            for (const r of ckRoutes) {
              const rType = String(r.type || r.name || '').toLowerCase();
              if (rType.includes('bluetooth') || rType.includes('airplay') || rType.includes('headset')) {
                hasBluetooth = true;
                if (!iosOutputs.includes('bluetooth')) {
                  iosOutputs.push('bluetooth');
                }
              }
              if (r.selected) {
                if (rType.includes('bluetooth') || rType.includes('airplay')) {
                  setCurrentOutput('bluetooth');
                } else if (rType.includes('speaker')) {
                  setCurrentOutput('speaker');
                } else {
                  setCurrentOutput('earpiece');
                }
              }
            }
          }
          // iOS'te genel olarak AirPlay / Bluetooth picker her zaman açılabilir
          if (!hasBluetooth && !iosOutputs.includes('bluetooth')) {
            iosOutputs.push('bluetooth');
          }
        } catch {
          if (!iosOutputs.includes('bluetooth')) {
            iosOutputs.push('bluetooth');
          }
        }

        setAvailableOutputs(iosOutputs);
      }
    } catch (err) {
      console.warn('[useAudioRouting] refreshOutputs hatası:', err);
    }
  }, []);

  // Hedef ses çıkış cihazını seç
  const selectAudioOutput = useCallback(
    async (target: AudioOutputDevice) => {
      userSelectedRef.current = true;
      try {
        if (Platform.OS === 'android') {
          await AudioSession.selectAudioOutput(target);
          setCurrentOutput(target);

          // CallKeep senkronizasyonu
          if (callId) {
            const routeName =
              target === 'speaker'
                ? 'Speaker'
                : target === 'bluetooth'
                ? 'Bluetooth'
                : target === 'headset'
                ? 'Headset'
                : 'Phone';
            await callKeepService.setAudioRoute(callId, routeName);
          }
        } else {
          // iOS
          if (target === 'bluetooth') {
            await AudioSession.showAudioRoutePicker();
            setCurrentOutput('bluetooth');
          } else if (target === 'speaker') {
            await AudioSession.selectAudioOutput('force_speaker');
            setCurrentOutput('speaker');
          } else {
            await AudioSession.selectAudioOutput('default');
            setCurrentOutput('earpiece');
          }

          if (callId && target !== 'bluetooth') {
            const routeName = target === 'speaker' ? 'Speaker' : 'Phone';
            await callKeepService.setAudioRoute(callId, routeName);
          }
        }
      } catch (err) {
        console.warn(`[useAudioRouting] selectAudioOutput(${target}) hatası:`, err);
      }
    },
    [callId],
  );

  // Basit hoparlör/ahize veya sıradaki çıkışa geçiş fonksiyonu
  const toggleSpeaker = useCallback(async () => {
    if (availableOutputs.includes('bluetooth')) {
      // Bluetooth varsa: Bluetooth -> Hoparlör -> Ahize döngüsü
      if (currentOutput === 'bluetooth') {
        await selectAudioOutput('speaker');
      } else if (currentOutput === 'speaker') {
        await selectAudioOutput('earpiece');
      } else {
        await selectAudioOutput('bluetooth');
      }
    } else {
      // Sadece hoparlör ve ahize
      const next = currentOutput === 'speaker' ? 'earpiece' : 'speaker';
      await selectAudioOutput(next);
    }
  }, [availableOutputs, currentOutput, selectAudioOutput]);

  // iOS native ses menüsünü aç
  const showRoutePicker = useCallback(async () => {
    try {
      await AudioSession.showAudioRoutePicker();
    } catch (err) {
      console.warn('[useAudioRouting] showRoutePicker hatası:', err);
    }
  }, []);

  // Oturum Başlatma ve Önceliklendirme: Yalnızca isActive değişiminde çalışır!
  useEffect(() => {
    if (!isActive) {
      setIsAudioReady(false);
      if (isSessionStartedRef.current) {
        AudioSession.stopAudioSession().catch(() => {});
        isSessionStartedRef.current = false;
        userSelectedRef.current = false;
      }
      return;
    }

    let isMounted = true;

    const startAudio = async () => {
      try {
        await AudioSession.configureAudio({
          android: {
            preferredOutputList: ['bluetooth', 'headset', 'speaker', 'earpiece'],
            audioTypeOptions: {
              manageAudioFocus: true,
              audioMode: 'inCommunication',
              audioFocusMode: 'gainTransientExclusive',
              audioStreamType: 'voiceCall',
              audioAttributesUsageType: 'voiceCommunication',
              audioAttributesContentType: 'speech',
              forceHandleAudioRouting: true,
            },
          },
          ios: {
            defaultOutput: isVideoRef.current ? 'speaker' : 'earpiece',
          },
        });

        await AudioSession.startAudioSession();
        isSessionStartedRef.current = true;

        if (isMounted) {
          await refreshOutputs();
          setIsAudioReady(true);
        }
      } catch (err) {
        console.warn('[useAudioRouting] configureAudio hatası:', err);
        if (isMounted) {
          setIsAudioReady(true); // Hata olsa bile arama bağlantısının tıkanmaması için hazır işaretle
        }
      }
    };

    startAudio();

    // CallKeep rota değişimlerini dinle
    const unsubCallKeep = callKeepService.addOnAudioRouteChange((data) => {
      if (!isMounted) return;
      if (data?.output) {
        const lower = data.output.toLowerCase();
        if (lower.includes('bluetooth')) setCurrentOutput('bluetooth');
        else if (lower.includes('speaker')) setCurrentOutput('speaker');
        else if (lower.includes('headset')) setCurrentOutput('headset');
        else if (lower.includes('phone') || lower.includes('earpiece')) setCurrentOutput('earpiece');
      }
      refreshOutputs();
    });

    // AppState ön plana geldiğinde cihazları tara
    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && isMounted) {
        refreshOutputs();
      }
    });

    // Aktif görüşme süresince periyodik (2.5 sn) donanım çıkış kontrolü (kulaklık takma/çıkarma)
    const interval = setInterval(() => {
      if (isMounted) {
        refreshOutputs();
      }
    }, 2500);

    return () => {
      isMounted = false;
      setIsAudioReady(false);
      unsubCallKeep();
      appStateSub.remove();
      clearInterval(interval);
      if (isSessionStartedRef.current) {
        AudioSession.stopAudioSession().catch(() => {});
        isSessionStartedRef.current = false;
        userSelectedRef.current = false;
      }
    };
  }, [isActive, refreshOutputs]);

  // Video açık/kapalı durumu arama esnasında değişirse hoparlör/ahize uyumunu yumuşakça ayarla
  useEffect(() => {
    if (!isActive || userSelectedRef.current) return;
    if (isVideo && currentOutput === 'earpiece' && !availableOutputs.includes('bluetooth') && !availableOutputs.includes('headset')) {
      selectAudioOutput('speaker');
    }
  }, [isVideo, isActive, currentOutput, availableOutputs, selectAudioOutput]);

  const isBluetoothAvailable = availableOutputs.includes('bluetooth');
  const isHeadsetAvailable = availableOutputs.includes('headset');
  const hasMultipleOutputs = availableOutputs.length > 1;

  return {
    availableOutputs,
    currentOutput,
    selectAudioOutput,
    toggleSpeaker,
    refreshOutputs,
    showRoutePicker,
    isBluetoothAvailable,
    isHeadsetAvailable,
    hasMultipleOutputs,
    isAudioReady,
  };
}
