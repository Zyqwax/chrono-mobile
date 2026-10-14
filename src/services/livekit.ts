import { Room, RoomEvent, Track, type VideoTrack } from 'livekit-client';
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
  facingMode: VideoFacingMode;
};

type TrackChangeListener = (tracks: VideoTracksState) => void;

class LiveKitService {
  private currentRoom: Room | null = null;
  private localVideoTrack: VideoTrack | null = null;
  private remoteVideoTrack: VideoTrack | null = null;
  private cameraFacing: VideoFacingMode = 'user';
  private trackListeners: Set<TrackChangeListener> = new Set();

  getCurrentTracks(): VideoTracksState {
    return {
      local: this.localVideoTrack,
      remote: this.remoteVideoTrack,
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

  async connect(serverUrl: string, token: string, enableMic = true, enableCam = false): Promise<Room | null> {
    if (this.currentRoom) {
      await this.disconnect();
    }

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
        this.localVideoTrack = null;
        this.remoteVideoTrack = null;
        this.notifyTrackListeners();
      });

      // Uzak katılımcı video akışı bağlandığında
      room.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        if (track.kind === Track.Kind.Video) {
          console.log('📹 Uzak kamera yayını alındı:', participant.identity);
          this.remoteVideoTrack = track as VideoTrack;
          this.notifyTrackListeners();
        }
      });

      // Uzak katılımcı video akışını kapattığında
      room.on(RoomEvent.TrackUnsubscribed, (track) => {
        if (track.kind === Track.Kind.Video) {
          console.log('📹 Uzak kamera yayını kapandı');
          this.remoteVideoTrack = null;
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

      try {
        await AudioSession.configureAudio({
          android: {
            audioTypeOptions: AndroidAudioTypePresets.communication,
            preferredOutputList: enableCam
              ? ['speaker', 'bluetooth', 'headset']
              : ['earpiece', 'speaker', 'bluetooth', 'headset'],
          },
          ios: {
            defaultOutput: enableCam ? 'speaker' : 'earpiece',
          },
        });
        await AudioSession.startAudioSession();
        console.log('🔊 LiveKit AudioSession başlatıldı (arama ses odaklaması devrede).');
      } catch (audioErr) {
        console.warn('AudioSession yapılandırma hatası:', audioErr);
      }

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
            this.remoteVideoTrack = pub.videoTrack;
            break;
          }
        }
        if (this.remoteVideoTrack) break;
      }

      this.notifyTrackListeners();

      return room;
    } catch (err: any) {
      console.warn('LiveKit bağlantı hatası:', err?.message);
      return null;
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

  async disconnect() {
    try {
      await AudioSession.stopAudioSession();
    } catch {
      // yut
    }
    if (this.currentRoom) {
      try {
        await this.currentRoom.disconnect();
      } catch (err) {
        console.warn('LiveKit bağlantı kesme hatası:', err);
      }
      this.currentRoom = null;
    }
    this.localVideoTrack = null;
    this.remoteVideoTrack = null;
    this.cameraFacing = 'user';
    this.notifyTrackListeners();
  }
}

export const liveKitService = new LiveKitService();
