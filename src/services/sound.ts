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

// Ses varlıkları (Yalnızca giden arama santral çalma sesi; gelen aramada cihazın varsayılan zil sesi çalar)
const OUTGOING_SOUND = require('../../assets/sounds/outgoing_ringback.wav');

class CallSoundService {
  private currentPlayer: any = null;
  private isPlayingOutgoing = false;

  private async configureAudioMode() {
    if (setAudioModeAsyncFn) {
      try {
        await setAudioModeAsyncFn({
          playsInSilentMode: true,
          interruptionMode: 'duckOthers',
        });
      } catch {
        // yut
      }
    }
  }

  /**
   * Giden arama için arama çalma sesi ("düüüt... düüüt...")
   */
  async startOutgoingRingback() {
    if (this.isPlayingOutgoing) return;
    await this.stopAll();

    if (!createAudioPlayerFn) return;

    try {
      await this.configureAudioMode();
      const player = createAudioPlayerFn(OUTGOING_SOUND);
      if (player) {
        player.loop = true;
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
  }
}

export const callSoundService = new CallSoundService();
