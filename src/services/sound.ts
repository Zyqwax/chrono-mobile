// expo-audio modülünü dinamik/güvenli olarak yükle
let createAudioPlayerFn: any = null;
let setAudioModeAsyncFn: any = null;

try {
  const expoAudio = require('expo-audio');
  createAudioPlayerFn = expoAudio.createAudioPlayer;
  setAudioModeAsyncFn = expoAudio.setAudioModeAsync;
} catch (err) {
  console.warn('expo-audio modülü yüklenemedi:', err);
}

// Ses varlıkları: Giden arama santral çalma sesi ve gelen arama zil sesi
const OUTGOING_SOUND = require('../../assets/sounds/outgoing_ringback.wav');
const INCOMING_RINGTONE = require('../../assets/sounds/ringtone.wav');

class CallSoundService {
  private currentPlayer: any = null;
  private isPlayingOutgoing = false;
  private isPlayingIncoming = false;

  /**
   * Ses odağını (Audio Focus) 'doNotMix' olarak yapılandırır.
   * Bu sayede arama yaparken veya arama geldiğinde arka planda çalan diğer medyalar
   * (Spotify, YouTube, Müzik vb.) otomatik olarak duraklatılır.
   */
  private async configureAudioMode(isIncomingRingtone = false) {
    if (setAudioModeAsyncFn) {
      try {
        await setAudioModeAsyncFn({
          playsInSilentMode: true,
          interruptionMode: 'doNotMix',
          interruptionModeAndroid: 'doNotMix',
          shouldRouteThroughEarpiece: !isIncomingRingtone,
        });
      } catch {
        // Bazı sürümlerde yalnızca temel alanlar desteklenebilir
        try {
          await setAudioModeAsyncFn({
            playsInSilentMode: true,
            interruptionMode: 'doNotMix',
          });
        } catch {
          // yut
        }
      }
    }
  }

  /**
   * Gelen arama için zil sesi çal (diğer medyaları duraklatır ve hoparlörden çalar)
   */
  async startIncomingRingtone() {
    if (this.isPlayingIncoming && this.currentPlayer) return;
    await this.stopAll();

    if (!createAudioPlayerFn) return;

    try {
      await this.configureAudioMode(true);
      const player = createAudioPlayerFn(INCOMING_RINGTONE);
      if (player) {
        player.loop = true;
        if ('volume' in player) {
          player.volume = 1.0;
        }
        player.play();
        this.currentPlayer = player;
        this.isPlayingIncoming = true;
        console.log('🔔 Gelen arama zil sesi başlatıldı.');
      }
    } catch (err) {
      console.warn('Gelen arama zil sesi çalınamadı:', err);
    }
  }

  /**
   * Giden arama için arama çalma sesi ("düüüt... düüüt...")
   */
  async startOutgoingRingback() {
    if (this.isPlayingOutgoing && this.currentPlayer) return;
    await this.stopAll();

    if (!createAudioPlayerFn) return;

    try {
      await this.configureAudioMode(false);
      const player = createAudioPlayerFn(OUTGOING_SOUND);
      if (player) {
        player.loop = true;
        if ('volume' in player) {
          player.volume = 0.85;
        }
        player.play();
        this.currentPlayer = player;
        this.isPlayingOutgoing = true;
        console.log('📞 Giden arama çalma sesi başlatıldı.');
      }
    } catch (err) {
      console.warn('Giden arama sesi çalınamadı:', err);
    }
  }

  /**
   * Çalan sesi durdur ve belleği temizle
   */
  async stopAll() {
    if (this.currentPlayer) {
      try {
        this.currentPlayer.pause();
        if (typeof this.currentPlayer.remove === 'function') {
          this.currentPlayer.remove();
        } else if (typeof this.currentPlayer.release === 'function') {
          this.currentPlayer.release();
        }
      } catch (err) {
        // yut
      }
      this.currentPlayer = null;
    }
    this.isPlayingOutgoing = false;
    this.isPlayingIncoming = false;
  }
}

export const callSoundService = new CallSoundService();
