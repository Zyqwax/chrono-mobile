import { Room, RoomEvent, Track, type VideoTrack } from 'livekit-client';

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

export type VideoTracksState = {
  local: VideoTrack | null;
  remote: VideoTrack | null;
};

type TrackChangeListener = (tracks: VideoTracksState) => void;

class LiveKitService {
  private currentRoom: Room | null = null;
  private localVideoTrack: VideoTrack | null = null;
  private remoteVideoTrack: VideoTrack | null = null;
  private trackListeners: Set<TrackChangeListener> = new Set();

  getCurrentTracks(): VideoTracksState {
    return {
      local: this.localVideoTrack,
      remote: this.remoteVideoTrack,
    };
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
      if (camPub?.videoTrack && typeof (camPub.videoTrack as any).restartTrack === 'function') {
        try {
          const currentFacing = (camPub.videoTrack as any).facingMode;
          const nextFacing = currentFacing === 'environment' ? 'user' : 'environment';
          await (camPub.videoTrack as any).restartTrack({ facingMode: nextFacing });
          this.localVideoTrack = camPub.videoTrack;
          this.notifyTrackListeners();
        } catch (err) {
          console.warn('Kamera değiştirme hatası:', err);
        }
      }
    }
  }

  async disconnect() {
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
    this.notifyTrackListeners();
  }
}

export const liveKitService = new LiveKitService();
