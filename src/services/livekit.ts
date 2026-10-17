import { ConnectionState, Room, RoomEvent, Track, type VideoTrack } from 'livekit-client';
import { AudioSession, AndroidAudioTypePresets } from '@livekit/react-native';

let isLiveKitNativeReady = false;

try {
  const { registerGlobals } = require('@livekit/react-native');
  if (typeof registerGlobals === 'function') {
    registerGlobals();
    isLiveKitNativeReady = true;
    console.log('🎙️ LiveKit WebRTC globals başarıyla yüklendi.');
  }
} catch (e) {
  // Expo Go veya WebRTC olmayan ortam
  isLiveKitNativeReady = false;
}

export type VideoFacingMode = 'user' | 'environment';

export type VideoTracksState = {
  local: VideoTrack | null;
  remote: VideoTrack | null;
  remoteTracks: Record<string, VideoTrack>;
  facingMode: VideoFacingMode;
};

type TrackChangeListener = (tracks: VideoTracksState) => void;

class LiveKitService {
  private currentRoom: Room | null = null;
  private isConnecting = false;
  private isDisconnecting = false;
  private connectedToken: string | null = null;
  private localVideoTrack: VideoTrack | null = null;
  private remoteVideoTrack: VideoTrack | null = null;
  private remoteVideoTracks: Map<string, VideoTrack> = new Map();
  private cameraFacing: VideoFacingMode = 'user';
  private trackListeners: Set<TrackChangeListener> = new Set();

  isConnectingOrConnected(): boolean {
    return (
      this.isConnecting ||
      (!!this.currentRoom &&
        (this.currentRoom.state === ConnectionState.Connected ||
          this.currentRoom.state === ConnectionState.Connecting))
    );
  }

  getCurrentTracks(): VideoTracksState {
    const remoteTracks: Record<string, VideoTrack> = {};
    for (const [id, track] of this.remoteVideoTracks.entries()) {
      remoteTracks[id] = track;
    }
    return {
      local: this.localVideoTrack,
      remote: this.remoteVideoTrack,
      remoteTracks,
      facingMode: this.cameraFacing,
    };
  }

  getFacingMode(): VideoFacingMode {
    return this.cameraFacing;
  }

  subscribeTracks(listener: TrackChangeListener) {
    this.trackListeners.add(listener);
    listener(this.getCurrentTracks());
    return () => {
      this.trackListeners.delete(listener);
    };
  }

  private notifyTrackListeners() {
    const state = this.getCurrentTracks();
    this.trackListeners.forEach((l) => {
      try {
        l(state);
      } catch (err) {
        console.warn('Track listener hatası:', err);
      }
    });
  }

  async connect(
    serverUrl: string,
    token: string,
    enableMic = true,
    enableCam = false,
  ): Promise<Room | null> {
    // 1. Zaten bir bağlantı süreci işleniyorsa ikinci çağrıyı doğrudan engelle
    if (this.isConnecting) {
      console.log('⚠️ [LiveKitService] Zaten bir bağlantı süreci aktif, mükerrer connect engellendi.');
      return this.currentRoom;
    }

    // 2. Eğer aynı token ile zaten bağlı veya bağlanıyorsa mevcut Room korunur
    if (
      this.currentRoom &&
      this.connectedToken === token &&
      (this.currentRoom.state === ConnectionState.Connected ||
        this.currentRoom.state === ConnectionState.Connecting)
    ) {
      console.log('ℹ️ [LiveKitService] Aynı token ile zaten bağlı veya bağlanıyor, mevcut bağlantı korunuyor.');
      return this.currentRoom;
    }

    // 3. Mevcut bir oda varsa ve farklı bir odaya geçiliyorsa önce temizle
    if (this.currentRoom) {
      await this.disconnect();
    }

    this.isConnecting = true;
    this.connectedToken = token;

    try {
      const room = new Room({
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
        publishDefaults: {
          videoSimulcastLayers: [],
        },
      });

      this.currentRoom = room;

      room.on(RoomEvent.Connected, () => {
        console.log('🟢 LiveKit odasına bağlandı:', room.name);
      });

      room.on(RoomEvent.Disconnected, () => {
        console.log('🔴 LiveKit odasından ayrıldı.');
        if (this.currentRoom === room) {
          this.connectedToken = null;
          this.localVideoTrack = null;
          this.remoteVideoTrack = null;
          this.remoteVideoTracks.clear();
          this.notifyTrackListeners();
        }
      });

      // Uzak katılımcı odadan ayrıldığında
      room.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('👋 Katılımcı odadan ayrıldı:', participant.identity);
        this.remoteVideoTracks.delete(participant.identity);
        this.remoteVideoTrack = this.remoteVideoTracks.values().next().value || null;
        this.notifyTrackListeners();
      });

      // Uzak katılımcı video akışı bağlandığında
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Video) {
          console.log('📹 Uzak kamera yayını alındı:', participant.identity);
          this.remoteVideoTracks.set(participant.identity, track as VideoTrack);
          this.remoteVideoTrack = track as VideoTrack;
          this.notifyTrackListeners();
        }
      });

      // Uzak katılımcı video akışını kapattığında
      room.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Video) {
          console.log('📹 Uzak kamera yayını kapandı:', (participant as any)?.identity);
          const pIdentity = (participant as any)?.identity;
          if (pIdentity) {
            this.remoteVideoTracks.delete(pIdentity);
          } else {
            for (const [id, t] of this.remoteVideoTracks.entries()) {
              if (t === track || (t as any)?.sid === (track as any)?.sid) {
                this.remoteVideoTracks.delete(id);
                break;
              }
            }
          }
          this.remoteVideoTrack = this.remoteVideoTracks.values().next().value || null;
          this.notifyTrackListeners();
        }
      });

      // Kendi kameramız yayınlandığında
      room.on(RoomEvent.LocalTrackPublished, (publication) => {
        if (publication.track?.kind === Track.Kind.Video) {
          console.log('📹 Yerel kamera yayını başladı');
          this.localVideoTrack = publication.track as VideoTrack;
          this.notifyTrackListeners();
        }
      });

      // Kendi kameramız durdurulduğunda
      room.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.track?.kind === Track.Kind.Video) {
          console.log('📹 Yerel kamera yayını durduruldu');
          this.localVideoTrack = null;
          this.notifyTrackListeners();
        }
      });

      await room.connect(serverUrl, token);

      if (enableMic) {
        await room.localParticipant.setMicrophoneEnabled(true).catch((err) => {
          console.warn('Mikrofon açma uyarısı:', err?.message);
        });
      }

      if (enableCam) {
        await room.localParticipant.setCameraEnabled(true).catch((err) => {
          console.warn('Kamera açma uyarısı:', err?.message);
        });
        const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (camPub?.videoTrack) {
          this.localVideoTrack = camPub.videoTrack;
        }
      }

      // Halihazırda odada olan uzak katılımcıların video yayınlarını tara
      for (const p of room.remoteParticipants.values()) {
        for (const pub of p.videoTrackPublications.values()) {
          if (pub.videoTrack) {
            this.remoteVideoTracks.set(p.identity, pub.videoTrack);
            this.remoteVideoTrack = pub.videoTrack;
          }
        }
      }

      this.notifyTrackListeners();
      return room;
    } catch (err: any) {
      console.warn('LiveKit bağlantı hatası:', err?.message || err);
      this.connectedToken = null;
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  async setMicrophoneEnabled(enabled: boolean) {
    if (this.currentRoom?.localParticipant) {
      await this.currentRoom.localParticipant.setMicrophoneEnabled(enabled).catch(console.warn);
    }
  }

  async setCameraEnabled(enabled: boolean) {
    if (this.currentRoom?.localParticipant) {
      await this.currentRoom.localParticipant.setCameraEnabled(enabled).catch(console.warn);
      const camPub = this.currentRoom.localParticipant.getTrackPublication(Track.Source.Camera);
      this.localVideoTrack = enabled && camPub?.videoTrack ? camPub.videoTrack : null;
      this.notifyTrackListeners();
    }
  }

  async switchCamera() {
    if (this.currentRoom?.localParticipant) {
      const camPub = this.currentRoom.localParticipant.getTrackPublication(Track.Source.Camera);
      const videoTrack = camPub?.videoTrack as any;
      if (videoTrack) {
        try {
          const nextFacing: VideoFacingMode = this.cameraFacing === 'user' ? 'environment' : 'user';

          if (typeof videoTrack.restartTrack === 'function') {
            await videoTrack.restartTrack({ facingMode: nextFacing });
          } else if (videoTrack.mediaStreamTrack && typeof videoTrack.mediaStreamTrack._switchCamera === 'function') {
            videoTrack.mediaStreamTrack._switchCamera();
          }

          this.cameraFacing = nextFacing;
          this.localVideoTrack = camPub?.videoTrack || this.localVideoTrack;
          this.notifyTrackListeners();
        } catch (err) {
          console.warn('Kamera değiştirme hatası:', err);
        }
      }
    }
  }

  async setSpeakerOutput(enabled: boolean) {
    try {
      await AudioSession.selectAudioOutput(enabled ? 'speaker' : 'earpiece');
    } catch (err) {
      console.warn('Hoparlör yönlendirme hatası:', err);
    }
  }

  async selectAudioOutput(target: string) {
    try {
      await AudioSession.selectAudioOutput(target);
    } catch (err) {
      console.warn('Ses çıkışı yönlendirme hatası:', err);
    }
  }

  async getAudioOutputs(): Promise<string[]> {
    try {
      return await AudioSession.getAudioOutputs();
    } catch {
      return [];
    }
  }

  async disconnect() {
    if (this.isDisconnecting) return;
    this.isDisconnecting = true;
    this.isConnecting = false;
    this.connectedToken = null;

    const room = this.currentRoom;
    this.currentRoom = null;

    if (this.localVideoTrack) {
      try {
        this.localVideoTrack.stop();
      } catch {}
      this.localVideoTrack = null;
    }

    if (room) {
      try {
        // Event dinleyicilerini hemen temizle ki erken abort veya kapatma esnasında
        // 'cannot send signal request before connected, type: leave' ya da
        // 'Cannot read property client of undefined' hataları oluşmasın
        room.removeAllListeners();
        // stopTracks = true ile yerel transceiver ve yayınlar derhal durdurulur
        if (room.state === ConnectionState.Connected || room.state === ConnectionState.Connecting) {
          await room.disconnect(true).catch((err: any) => {
            // Teardown esnasında PC manager kapandığı için fırlayan NegotiationError'ı yakala
            if (
              err?.name === 'NegotiationError' ||
              String(err?.message || err).includes('PC manager is closed')
            ) {
              return;
            }
            console.warn('LiveKit disconnect uyarısı:', err);
          });
        }
      } catch (err: any) {
        if (
          err?.name === 'NegotiationError' ||
          String(err?.message || err).includes('PC manager is closed')
        ) {
          // Teardown sırasında beklenen yarış durumu, güvenle yutulur
        } else {
          console.warn('LiveKit bağlantı kesme hatası:', err);
        }
      }
    }

    this.remoteVideoTrack = null;
    this.cameraFacing = 'user';
    this.notifyTrackListeners();
    this.isDisconnecting = false;
  }
}

export const liveKitService = new LiveKitService();
