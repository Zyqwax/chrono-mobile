import React, { useEffect, useState } from 'react';
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../store/useChatStore';
import { liveKitService } from '../services/livekit';
import { ChronoAvatar } from './ChronoAvatar';

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
  const [speakerOn, setSpeakerOn] = useState(false);

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

  const handleToggleSpeaker = () => {
    const next = !speakerOn;
    setSpeakerOn(next);
    liveKitService.setSpeakerOutput(next);
  };

  const handleLeave = () => {
    leaveRoomVoice();
    onClose();
  };

  // Eğer katılımcı listesinde henüz kimse yoksa veya sadece biz varsak listeyi hazırla
  const displayList = voiceParticipants.length > 0
    ? voiceParticipants
    : [
        {
          id: currentUser?.id || 'me',
          displayName: currentUser?.displayName || currentUser?.username || 'Sen',
          isSpeaking: true,
          isMuted: isMuted,
        },
      ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
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
                  CANLI SESLİ SOHBET · {formatTime(duration)}
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

          {/* Katılımcı Izgarası (Ekran 7) */}
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
                .filter((p) => p.id !== (currentUser?.id || 'me'))
                .map((item) => (
                  <View key={item.id} style={styles.participantItem}>
                    <ChronoAvatar
                      size={84}
                      name={item.displayName || 'U'}
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

            {/* Hoparlör */}
            <TouchableOpacity
              style={[
                styles.actionBtn,
                speakerOn ? styles.actionBtnWhite : styles.actionBtnDark,
              ]}
              onPress={handleToggleSpeaker}
              activeOpacity={0.7}
            >
              <Ionicons
                name={speakerOn ? 'volume-high' : 'volume-medium'}
                size={24}
                color={speakerOn ? '#0B0F1A' : '#FFFFFF'}
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
