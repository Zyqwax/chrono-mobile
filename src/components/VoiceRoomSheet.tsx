import React from 'react';
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
import { chronoTheme } from '../theme/colors';

const { colors, radius } = chronoTheme;

interface VoiceRoomSheetProps {
  visible: boolean;
  roomName: string;
  onClose: () => void;
}

export const VoiceRoomSheet: React.FC<VoiceRoomSheetProps> = ({
  visible,
  roomName,
  onClose,
}) => {
  const {
    voiceParticipants,
    isMuted,
    isVideoOn,
    toggleMute,
    toggleVideo,
    leaveRoomVoice,
  } = useChatStore();

  const handleLeave = () => {
    leaveRoomVoice();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.sheetContainer} edges={['bottom']}>
          {/* Top Drag Indicator */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.sheetHeader}>
            <View>
              <View style={styles.liveBadgeRow}>
                <View style={styles.livePulseDot} />
                <Text style={styles.liveBadge}>CANLI SESLİ SOHBET</Text>
              </View>
              <Text style={styles.roomTitle}>{roomName}</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-down" size={26} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Participants Grid */}
          <View style={styles.participantsArea}>
            <Text style={styles.countText}>
              {voiceParticipants.length} Katılımcı
            </Text>

            <FlatList
              data={voiceParticipants}
              keyExtractor={(item) => item.id}
              numColumns={3}
              columnWrapperStyle={{ gap: 16, justifyContent: 'center' }}
              contentContainerStyle={{ paddingVertical: 20 }}
              renderItem={({ item }) => (
                <View style={styles.participantCard}>
                  <View
                    style={[
                      styles.avatarWrapper,
                      item.isSpeaking && styles.speakingHalo,
                    ]}
                  >
                    <View style={styles.avatarCircle}>
                      <Text style={styles.avatarText}>
                        {item.displayName?.charAt(0).toUpperCase() || 'U'}
                      </Text>
                    </View>
                    {item.isMuted && (
                      <View style={styles.mutedBadge}>
                        <Ionicons name="mic-off" size={12} color="#ffffff" />
                      </View>
                    )}
                  </View>
                  <Text style={styles.participantName} numberOfLines={1}>
                    {item.displayName}
                  </Text>
                </View>
              )}
            />
          </View>

          {/* Action Bar (Telegram Voice Action Buttons) */}
          <View style={styles.actionBar}>
            {/* Toggle Mute */}
            <TouchableOpacity
              style={[styles.actionBtn, isMuted ? styles.actionBtnMuted : styles.actionBtnActive]}
              onPress={toggleMute}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isMuted ? 'mic-off' : 'mic'}
                size={26}
                color="#ffffff"
              />
              <Text style={styles.actionBtnText}>
                {isMuted ? 'Susturuldu' : 'Mikrofon'}
              </Text>
            </TouchableOpacity>

            {/* Toggle Video */}
            <TouchableOpacity
              style={[styles.actionBtn, isVideoOn && styles.actionBtnActive]}
              onPress={toggleVideo}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isVideoOn ? 'videocam' : 'videocam-off'}
                size={26}
                color="#ffffff"
              />
              <Text style={styles.actionBtnText}>Kamera</Text>
            </TouchableOpacity>

            {/* Leave Voice */}
            <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave} activeOpacity={0.8}>
              <Ionicons name="call" size={26} color="#ffffff" />
              <Text style={styles.actionBtnText}>Ayrıl</Text>
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
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: colors.surfaceElevated, // #1A243B
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    minHeight: 440,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderLight,
    alignSelf: 'center',
    marginBottom: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  liveBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.online,
  },
  liveBadge: {
    color: colors.primaryLight,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  roomTitle: {
    color: colors.textPrimary,
    fontSize: 19,
    fontWeight: '700',
    marginTop: 2,
  },
  closeBtn: {
    padding: 6,
  },
  participantsArea: {
    flex: 1,
    paddingVertical: 12,
  },
  countText: {
    color: colors.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '500',
  },
  participantCard: {
    alignItems: 'center',
    width: 90,
  },
  avatarWrapper: {
    position: 'relative',
    padding: 4,
    borderRadius: 40,
  },
  speakingHalo: {
    borderWidth: 2.5,
    borderColor: colors.online,
  },
  avatarCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.borderLight,
  },
  avatarText: {
    color: colors.primaryLight,
    fontSize: 22,
    fontWeight: '700',
  },
  mutedBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    backgroundColor: colors.error,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
  },
  participantName: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
    textAlign: 'center',
  },
  actionBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: 16,
    paddingBottom: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  actionBtnActive: {
    backgroundColor: colors.primary, // #2563EB
    borderColor: colors.primaryLight,
  },
  actionBtnMuted: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  actionBtnText: {
    color: colors.textPrimary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 4,
  },
  leaveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: colors.error,
    transform: [{ rotate: '135deg' }],
  },
});
