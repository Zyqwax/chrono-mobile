import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView } from '@livekit/react-native';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../store/useChatStore';
import { liveKitService, type VideoTracksState } from '../services/livekit';
import { ChronoAvatar } from './ChronoAvatar';
import { useAudioRouting } from '../hooks/useAudioRouting';
import { AudioOutputPickerModal } from './modals/AudioOutputPickerModal';

interface VoiceRoomSheetProps {
  visible: boolean;
  roomName: string;
  onClose: () => void;
  onInvite?: () => void;
}

export const VoiceRoomSheet: React.FC<VoiceRoomSheetProps> = ({
  visible,
  roomName,
  onClose,
  onInvite,
}) => {
  const {
    currentUser,
    voiceParticipants,
    isMuted,
    isVideoOn,
    toggleMute,
    toggleVideo,
    leaveRoomVoice,
  } = useChatStore();

  const [duration, setDuration] = useState(134); // ~02:14
  const [audioPickerVisible, setAudioPickerVisible] = useState(false);
  const [videoTracks, setVideoTracks] = useState<VideoTracksState>({
    local: null,
    remote: null,
    facingMode: 'user',
    remoteTracks: {},
  });

  // Canlı LiveKit video kanallarını dinle
  useEffect(() => {
    const unsub = liveKitService.subscribeTracks((tracks) => {
      setVideoTracks(tracks);
    });
    return unsub;
  }, []);

  // Ses oturumu ve cihaz yönlendirme (Bluetooth, Hoparlör, Ahize, Kulaklık)
  const {
    availableOutputs,
    currentOutput,
    selectAudioOutput,
    toggleSpeaker,
    showRoutePicker,
    hasMultipleOutputs,
  } = useAudioRouting({
    isActive: visible,
    isVideo: isVideoOn,
  });

  const handleAudioPress = () => {
    if (hasMultipleOutputs && (availableOutputs.length > 2 || Platform.OS === 'ios')) {
      setAudioPickerVisible(true);
    } else {
      toggleSpeaker();
    }
  };

  const getAudioIcon = () => {
    switch (currentOutput) {
      case 'bluetooth':
        return 'bluetooth';
      case 'headset':
        return 'headset';
      case 'speaker':
        return 'volume-high';
      case 'earpiece':
      default:
        return 'ear-outline';
    }
  };

  const isAudioActive = currentOutput !== 'earpiece';

  useEffect(() => {
    if (!visible) {
      setDuration(0);
      return;
    }
    const interval = setInterval(() => {
      setDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [visible]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleLeave = () => {
    leaveRoomVoice();
    onClose();
  };

  const hasAnyVideo =
    (isVideoOn && !!videoTracks.local) ||
    (videoTracks.remoteTracks && Object.keys(videoTracks.remoteTracks).length > 0) ||
    !!videoTracks.remote;

  // Katılımcı listesini hazırla (kullanıcıyı en başa ekle)
  const isMeInList = voiceParticipants.some((p) => p.userId === currentUser?.id || p.id === currentUser?.id);
  const myParticipant = {
    id: currentUser?.id || 'me',
    userId: currentUser?.id || 'me',
    displayName: currentUser?.displayName || currentUser?.username || 'Sen',
    avatarUrl: currentUser?.avatarUrl,
    isSpeaking: false,
    isMuted: isMuted,
    isVideoOn: isVideoOn,
  };

  const displayList = isMeInList
    ? voiceParticipants.map((p) =>
        p.userId === currentUser?.id || p.id === currentUser?.id
          ? { ...p, isMuted, isVideoOn }
          : p
      )
    : [myParticipant, ...voiceParticipants];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView
          style={[styles.sheetContainer, hasAnyVideo && styles.sheetContainerVideo]}
          edges={['bottom']}
        >
          {/* Üst Sürükleme Çubuğu */}
          <View style={styles.dragHandle} />

          {/* Başlık Alanı (Ekran 7) */}
          <View style={styles.sheetHeader}>
            <View style={{ flex: 1 }}>
              <View style={styles.liveBadgeRow}>
                <View style={styles.liveTripleDots}>
                  <View style={styles.liveDot} />
                  <View style={styles.liveDot} />
                  <View style={styles.liveDot} />
                </View>
                <Text style={styles.liveBadge}>
                  {hasAnyVideo ? 'CANLI GÖRÜNTÜLÜ SOHBET' : 'CANLI SESLİ SOHBET'} · {formatTime(duration)}
                </Text>
              </View>
              <Text style={styles.roomTitle} numberOfLines={1}>
                {roomName}
              </Text>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Katılımcı Sayısı */}
          <Text style={styles.countText}>
            {displayList.length} katılımcı
          </Text>

          {/* Katılımcı Alanı: Görüntülü Arama Izgarası VEYA Klasik Sesli Sohbet Izgarası */}
          {hasAnyVideo ? (
            <ScrollView
              style={styles.videoGridScroll}
              contentContainerStyle={styles.videoGridContainer}
              showsVerticalScrollIndicator={false}
            >
              {displayList.map((item) => {
                const isMe = item.id === currentUser?.id || item.userId === currentUser?.id || item.id === 'me';
                const track = isMe
                  ? (isVideoOn ? videoTracks.local : null)
                  : (videoTracks.remoteTracks[item.id] ||
                     videoTracks.remoteTracks[item.userId || ''] ||
                     (displayList.length <= 2 ? videoTracks.remote : null));

                const itemMuted = isMe ? isMuted : item.isMuted;

                return (
                  <View
                    key={item.id}
                    style={[
                      styles.videoTile,
                      displayList.length === 1 && styles.videoTileSingle,
                      item.isSpeaking && styles.videoTileSpeaking,
                    ]}
                  >
                    {track ? (
                      <VideoView
                        videoTrack={track}
                        style={StyleSheet.absoluteFill}
                        objectFit="cover"
                        mirror={isMe && videoTracks.facingMode === 'user'}
                        zOrder={isMe ? 1 : 0}
                      />
                    ) : (
                      <View style={styles.videoTileAvatarPlaceholder}>
                        <ChronoAvatar
                          size={64}
                          name={item.displayName || 'U'}
                          uri={item.avatarUrl}
                          ringColor={item.isSpeaking ? '#10B981' : '#2563EB'}
                          showRing={true}
                        />
                      </View>
                    )}

                    {/* Yerel kamera çevirme butonu (Sadece 'Sen' ve video açıkken) */}
                    {isMe && track && (
                      <TouchableOpacity
                        style={styles.flipCameraBtn}
                        onPress={() => liveKitService.switchCamera()}
                        activeOpacity={0.8}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="camera-reverse" size={16} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}

                    {/* Katılımcı Alt Bilgi Barı */}
                    <View style={styles.videoTileOverlay}>
                      <Text style={styles.videoTileName} numberOfLines={1}>
                        {isMe ? 'Sen' : item.displayName}
                      </Text>
                      <View style={styles.videoTileMicBadge}>
                        <Ionicons
                          name={itemMuted ? 'mic-off' : 'mic'}
                          size={13}
                          color={itemMuted ? '#EF4444' : '#10B981'}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}

              {/* Davet Et Butonu (Video Kartı Formatında) */}
              <TouchableOpacity
                style={[styles.videoTile, styles.videoTileInvite]}
                onPress={onInvite || onClose}
                activeOpacity={0.8}
              >
                <View style={styles.inviteIconCircle}>
                  <Ionicons name="add" size={28} color="#38BDF8" />
                </View>
                <Text style={styles.inviteLabel}>Davet et</Text>
              </TouchableOpacity>
            </ScrollView>
          ) : (
            <View style={styles.participantsArea}>
              <View style={styles.participantsRow}>
                {/* Ben (Sen) */}
                <View style={styles.participantItem}>
                  <ChronoAvatar
                    size={84}
                    name={currentUser?.displayName || currentUser?.username || 'E'}
                    uri={currentUser?.avatarUrl}
                    ringColor="#10B981"
                    showRing={true}
                  />
                  <View style={styles.speakerRow}>
                    <Text style={styles.participantLabel}>Sen</Text>
                    <Ionicons name="cellular" size={13} color="#10B981" />
                  </View>
                </View>

                {/* Davet Et Butonu */}
                <View style={styles.participantItem}>
                  <TouchableOpacity
                    style={styles.inviteDashedBtn}
                    onPress={onInvite || onClose}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="add" size={32} color="#38BDF8" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onInvite || onClose} activeOpacity={0.7}>
                    <Text style={styles.inviteLabel}>Davet et</Text>
                  </TouchableOpacity>
                </View>

                {/* Diğer Katılımcılar Varsa */}
                {displayList
                  .filter((p) => p.id !== (currentUser?.id || 'me') && p.userId !== (currentUser?.id || 'me'))
                  .map((item) => (
                    <View key={item.id} style={styles.participantItem}>
                      <ChronoAvatar
                        size={84}
                        name={item.displayName || 'U'}
                        uri={item.avatarUrl}
                        ringColor={item.isSpeaking ? '#10B981' : '#2563EB'}
                        showRing={true}
                      />
                      <Text style={styles.participantLabel} numberOfLines={1}>
                        {item.displayName}
                      </Text>
                    </View>
                  ))}
              </View>
            </View>
          )}

          {/* Alt Kontrol Çubuğu (Ekran 7: 3 Yuvarlak Buton + Kırmızı Ayrıl Butonu) */}
          <View style={styles.actionBar}>
            {/* Mikrofon */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                !isMuted ? styles.actionBtnWhite : styles.actionBtnDark,
                isMuted && styles.actionBtnMuted,
              ]}
              onPress={toggleMute}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={24}
                color={!isMuted ? '#0B0F1A' : '#EF4444'}
              />
            </TouchableOpacity>

            {/* Kamera */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isVideoOn ? styles.actionBtnWhite : styles.actionBtnDark,
              ]}
              onPress={toggleVideo}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isVideoOn ? 'videocam' : 'videocam-off'}
                size={24}
                color={isVideoOn ? '#0B0F1A' : '#FFFFFF'}
              />
            </TouchableOpacity>

            {/* Ses Çıkışı (Bluetooth / Hoparlör / Ahize / Kulaklık) */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                isAudioActive ? styles.actionBtnWhite : styles.actionBtnDark,
                currentOutput === 'bluetooth' && {
                  backgroundColor: 'rgba(56, 189, 248, 0.25)',
                  borderColor: '#38BDF8',
                  borderWidth: 1.5,
                },
                currentOutput === 'headset' && {
                  backgroundColor: 'rgba(16, 185, 129, 0.25)',
                  borderColor: '#10B981',
                  borderWidth: 1.5,
                },
              ]}
              onPress={handleAudioPress}
              onLongPress={() => setAudioPickerVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons
                name={getAudioIcon() as any}
                size={24}
                color={
                  currentOutput === 'bluetooth'
                    ? '#38BDF8'
                    : currentOutput === 'headset'
                    ? '#10B981'
                    : currentOutput === 'speaker'
                    ? '#0B0F1A'
                    : '#FFFFFF'
                }
              />
            </TouchableOpacity>

            {/* Ayrıl (Elongated Kırmızı Pill Butonu) */}
            <TouchableOpacity
              style={styles.leavePillBtn}
              onPress={handleLeave}
              activeOpacity={0.8}
            >
              <Ionicons
                name="call"
                size={22}
                color="#FFFFFF"
                style={{ transform: [{ rotate: '135deg' }] }}
              />
              <Text style={styles.leaveBtnText}>Ayrıl</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>

        <AudioOutputPickerModal
          visible={audioPickerVisible}
          onClose={() => setAudioPickerVisible(false)}
          availableOutputs={availableOutputs}
          currentOutput={currentOutput}
          onSelectOutput={selectAudioOutput}
          onOpenSystemPicker={showRoutePicker}
        />
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#0D1322', // Ekran 7 Koyu Lacivert
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
    minHeight: 460,
    borderTopWidth: 1,
    borderTopColor: '#1A243A',
  },
  sheetContainerVideo: {
    height: '86%',
    maxHeight: '92%',
  },
  videoGridScroll: {
    flex: 1,
    marginVertical: 8,
  },
  videoGridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
    paddingBottom: 16,
  },
  videoTile: {
    width: '48%',
    aspectRatio: 0.82,
    backgroundColor: '#121929',
    borderRadius: 18,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1.5,
    borderColor: '#1E2B45',
  },
  videoTileSingle: {
    width: '100%',
    aspectRatio: 1.25,
  },
  videoTileSpeaking: {
    borderColor: '#10B981',
  },
  videoTileAvatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F1626',
  },
  flipCameraBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  videoTileOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: 'rgba(11, 15, 26, 0.75)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 5,
  },
  videoTileName: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    marginRight: 6,
  },
  videoTileMicBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTileInvite: {
    borderStyle: 'dashed',
    borderWidth: 1.5,
    borderColor: '#1E2B45',
    backgroundColor: 'rgba(30, 43, 69, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#223048',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  liveTripleDots: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
  },
  liveDot: {
    width: 3.5,
    height: 3.5,
    borderRadius: 2,
    backgroundColor: '#10B981',
  },
  liveBadge: {
    color: '#10B981',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  roomTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginTop: 6,
    letterSpacing: -0.4,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#141C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  countText: {
    color: '#7E8BA6',
    fontSize: 13,
    fontWeight: '500',
    marginTop: 6,
    marginBottom: 28,
  },
  participantsArea: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 16,
  },
  participantsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 32,
    paddingHorizontal: 12,
    flexWrap: 'wrap',
  },
  participantItem: {
    alignItems: 'center',
    width: 90,
  },
  speakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  participantLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  inviteDashedBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1.5,
    borderColor: '#1E2B45',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(30, 43, 69, 0.2)',
  },
  inviteLabel: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 20,
    paddingBottom: 8,
    gap: 12,
  },
  actionBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDark: {
    backgroundColor: '#151E31',
    borderWidth: 1,
    borderColor: '#22304C',
  },
  actionBtnWhite: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  actionBtnMuted: {
    backgroundColor: '#1E2536',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  leavePillBtn: {
    flex: 1,
    height: 54,
    borderRadius: 27,
    backgroundColor: '#EF4444',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  leaveBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
