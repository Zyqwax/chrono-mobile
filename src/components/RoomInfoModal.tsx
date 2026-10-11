import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../services/api';
import { Room } from '../types';
import { useChatStore } from '../store/useChatStore';
import { AddMemberModal } from './AddMemberModal';
import { ChronoAvatar } from './ChronoAvatar';

interface RoomInfoModalProps {
  visible: boolean;
  roomId: string;
  onClose: () => void;
  onRoomDeletedOrLeft: () => void;
}

export const RoomInfoModal: React.FC<RoomInfoModalProps> = ({
  visible,
  roomId,
  onClose,
  onRoomDeletedOrLeft,
}) => {
  const [room, setRoom] = useState<Room | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const {
    currentUser,
    fetchRooms,
    deleteRoom,
    startCall,
    joinRoomVoice,
  } = useChatStore();

  useEffect(() => {
    if (visible && roomId) {
      loadDetails();
    }
  }, [visible, roomId]);

  const loadDetails = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/rooms/${roomId}`);
      setRoom(res.data);
      setNewName(res.data.name || '');
      setIsMuted(!!res.data.isMuted);
    } catch (err) {
      console.error('loadDetails error', err);
    } finally {
      setLoading(false);
    }
  };

  const isDirect = room?.type === 'DIRECT';
  const chatTitle = isDirect
    ? room.peer?.displayName || room.peer?.username || 'Kullanıcı'
    : room?.name || 'Sohbet Odası';
  const isOwner = room?.createdById === currentUser?.id || room?.myRole === 'ADMIN';

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    try {
      await api.patch(`/rooms/${roomId}`, { name: newName.trim() });
      setEditingName(false);
      loadDetails();
      fetchRooms();
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'İsim güncellenemedi');
    }
  };

  const handleLeaveOrDelete = async () => {
    if (isDirect) {
      Alert.alert(
        'Sohbeti Sil',
        'Bu sohbeti silmek istediğinize emin misiniz?',
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              try {
                await deleteRoom(roomId, false);
                await fetchRooms();
                onClose();
                onRoomDeletedOrLeft();
              } catch (err: any) {
                Alert.alert('Hata', err.response?.data?.message || 'Sohbet silinemedi');
              }
            },
          },
        ],
      );
      return;
    }

    Alert.alert(
      isOwner ? 'Odayı Sil' : 'Odadan Ayrıl',
      isOwner
        ? 'Bu odayı silmek istediğinize emin misiniz? Tüm mesajlar silinecektir.'
        : 'Bu odadan ayrılmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: isOwner ? 'Sil' : 'Ayrıl',
          style: 'destructive',
          onPress: async () => {
            try {
              if (isOwner) {
                await api.delete(`/rooms/${roomId}`);
              } else {
                await api.post(`/rooms/${roomId}/leave`);
              }
              await fetchRooms();
              onClose();
              onRoomDeletedOrLeft();
            } catch (err: any) {
              Alert.alert('Hata', err.response?.data?.message || 'İşlem gerçekleştirilemedi');
            }
          },
        },
      ],
    );
  };

  const handleRemoveMember = async (memberUserId: string, name: string) => {
    Alert.alert('Üyeyi Çıkar', `${name} adlı kullanıcıyı odadan çıkarmak istiyor musunuz?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/rooms/${roomId}/members/${memberUserId}`);
            loadDetails();
            fetchRooms();
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.message || 'Üye çıkarılamadı');
          }
        },
      },
    ]);
  };

  const emojiMatch = !isDirect && room?.name ? room.name.match(/^(\p{Emoji})/u) : null;
  const roomEmoji = emojiMatch ? emojiMatch[0] : '🔥';
  const cleanRoomName = emojiMatch ? room?.name?.replace(emojiMatch[0], '').trim() : room?.name;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Navigation Bar */}
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.navTitle}>
              {isDirect ? 'Kişi bilgisi' : 'Oda bilgisi'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color="#38BDF8"
              style={{ marginTop: 60 }}
            />
          ) : isDirect ? (
            /* ========================================================= */
            /* DM Kişi Bilgisi (Page 7)                                  */
            /* ========================================================= */
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Center Avatar */}
              <View style={styles.centerAvatarSection}>
                <ChronoAvatar
                  size={96}
                  name={room?.peer?.displayName || chatTitle}
                  uri={room?.peer?.avatarUrl}
                />
              </View>

              <Text style={styles.profileName}>{chatTitle}</Text>
              <Text style={styles.profileUsername}>
                @{room?.peer?.username || 'kullanici'}
              </Text>
              <Text style={styles.onlineStatus}>
                {room?.peer?.status === 'ONLINE' ? 'çevrimiçi' : 'son görülme yakınlarda'}
              </Text>

              {/* 3 Quick Action Buttons */}
              <View style={styles.actionPillsRow}>
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={onClose}
                  activeOpacity={0.75}
                >
                  <Ionicons name="chatbubble-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.actionPillLabel}>Mesaj</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => {
                    onClose();
                    startCall(roomId, false);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="call-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.actionPillLabel}>Sesli</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => {
                    onClose();
                    startCall(roomId, true);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="videocam-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.actionPillLabel}>Görüntülü</Text>
                </TouchableOpacity>
              </View>

              {/* HAKKINDA Bölümü */}
              <Text style={styles.sectionHeader}>HAKKINDA</Text>
              <View style={styles.infoCard}>
                <Text style={styles.infoCardText}>
                  {room?.peer?.bio || 'Hakkında bilgisi eklenmedi.'}
                </Text>
              </View>

              {/* Aksiyon Butonları */}
              <View style={styles.dangerSection}>
                <TouchableOpacity
                  style={styles.outlinedActionBtn}
                  onPress={() => Alert.alert('Engelle', 'Kullanıcı engellendi.')}
                  activeOpacity={0.75}
                >
                  <Ionicons name="ban-outline" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.outlinedActionText}>Engelle</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dangerOutlinedBtn}
                  onPress={handleLeaveOrDelete}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={styles.dangerOutlinedText}>Sohbeti sil</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          ) : (
            /* ========================================================= */
            /* Oda Bilgisi (Page 6)                                      */
            /* ========================================================= */
            <ScrollView
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Center Avatar */}
              <View style={styles.centerAvatarSection}>
                <ChronoAvatar
                  size={96}
                  name={cleanRoomName || 'Oda'}
                  emoji={roomEmoji}
                  uri={room?.iconUrl}
                />
              </View>

              {/* Başlık ve Düzenle */}
              {editingName ? (
                <View style={styles.editRow}>
                  <TextInput
                    style={styles.nameInput}
                    value={newName}
                    onChangeText={setNewName}
                    autoFocus
                  />
                  <TouchableOpacity
                    style={styles.saveBtn}
                    onPress={handleUpdateName}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="checkmark" size={20} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.roomTitleRow}>
                  <Text style={styles.profileName}>{cleanRoomName || chatTitle}</Text>
                  {isOwner && (
                    <TouchableOpacity
                      onPress={() => setEditingName(true)}
                      style={styles.editPenBtn}
                    >
                      <Ionicons name="pencil-outline" size={18} color="#38BDF8" />
                    </TouchableOpacity>
                  )}
                </View>
              )}

              <Text style={styles.roomSubtitle}>
                {room?.members?.length || 2} üye · 10 Ekim'de açıldı
              </Text>

              {/* 3 Quick Action Buttons: Üye ekle · Sessize al · Sesli */}
              <View style={styles.actionPillsRow}>
                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => setAddMemberVisible(true)}
                  activeOpacity={0.75}
                >
                  <Ionicons name="person-add-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.actionPillLabel}>Üye ekle</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => setIsMuted(!isMuted)}
                  activeOpacity={0.75}
                >
                  <Ionicons
                    name={isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
                    size={20}
                    color="#FFFFFF"
                  />
                  <Text style={styles.actionPillLabel}>
                    {isMuted ? 'Sesi aç' : 'Sessize al'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.actionPillBtn}
                  onPress={() => {
                    onClose();
                    joinRoomVoice(roomId);
                  }}
                  activeOpacity={0.75}
                >
                  <Ionicons name="mic-outline" size={20} color="#FFFFFF" />
                  <Text style={styles.actionPillLabel}>Sesli</Text>
                </TouchableOpacity>
              </View>

              {/* ÜYELER Bölümü */}
              <Text style={styles.sectionHeader}>ÜYELER</Text>
              <View style={styles.membersCard}>
                {(room?.members && room.members.length > 0
                  ? room.members
                  : [
                      {
                        id: 'm1',
                        userId: currentUser?.id,
                        role: 'ADMIN',
                        user: { displayName: currentUser?.displayName || 'Enes Samed' },
                      },
                      {
                        id: 'm2',
                        userId: 'u2',
                        role: 'MEMBER',
                        user: { displayName: 'Alara Yaldız' },
                      },
                    ]
                ).map((m: any, idx: number, arr: any[]) => {
                  const isMe = m.userId === currentUser?.id;
                  const isAdmin = m.role === 'ADMIN';
                  const canKick = isOwner && !isMe;
                  const mName = m.user?.displayName || m.user?.username || 'Kullanıcı';

                  return (
                    <View
                      key={m.id || idx}
                      style={[
                        styles.memberRow,
                        idx < arr.length - 1 && styles.memberRowBorder,
                      ]}
                    >
                      <ChronoAvatar
                        size={38}
                        name={mName}
                        uri={m.user?.avatarUrl}
                        style={{ marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.memberName}>
                          {mName} {isMe ? '(Sen)' : ''}
                        </Text>
                        <Text style={styles.memberRole}>
                          {isAdmin ? 'Oda yöneticisi' : 'Üye'}
                        </Text>
                      </View>
                      {canKick && (
                        <TouchableOpacity
                          style={styles.kickBtn}
                          onPress={() => handleRemoveMember(m.userId, mName)}
                        >
                          <Ionicons name="close" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                      )}
                    </View>
                  );
                })}
              </View>

              {/* Danger Sil Butonu */}
              <View style={{ marginTop: 24 }}>
                <TouchableOpacity
                  style={styles.dangerOutlinedBtn}
                  onPress={handleLeaveOrDelete}
                  activeOpacity={0.75}
                >
                  <Ionicons name="trash-outline" size={18} color="#EF4444" style={{ marginRight: 8 }} />
                  <Text style={styles.dangerOutlinedText}>Odayı sil</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          )}
        </SafeAreaView>
      </View>

      {/* Add Member Modal */}
      <AddMemberModal
        visible={addMemberVisible}
        roomId={roomId}
        existingMemberIds={(room?.members || []).map((m) => m.userId)}
        onClose={() => setAddMemberVisible(false)}
        onMemberAdded={() => loadDetails()}
      />
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  centerAvatarSection: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 16,
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 4,
  },
  profileUsername: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 4,
  },
  onlineStatus: {
    fontSize: 13,
    color: '#38BDF8',
    textAlign: 'center',
    marginBottom: 20,
  },
  roomTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 4,
  },
  editPenBtn: {
    padding: 4,
  },
  roomSubtitle: {
    fontSize: 13,
    color: '#8A93A8',
    textAlign: 'center',
    marginBottom: 20,
  },
  actionPillsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionPillBtn: {
    flex: 1,
    height: 60,
    borderRadius: 16,
    backgroundColor: '#131B2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
  },
  actionPillLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 10,
    marginTop: 4,
  },
  infoCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 24,
  },
  infoCardText: {
    color: '#8A93A8',
    fontSize: 14,
    lineHeight: 20,
  },
  membersCard: {
    backgroundColor: '#111827',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  memberRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  memberRole: {
    fontSize: 12,
    color: '#64748B',
  },
  kickBtn: {
    padding: 6,
  },
  dangerSection: {
    gap: 12,
  },
  outlinedActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  outlinedActionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  dangerOutlinedBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 48,
    borderRadius: 24,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
  },
  dangerOutlinedText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: '#131B2E',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6,
    color: '#FFFFFF',
    fontSize: 18,
    borderWidth: 1,
    borderColor: '#2563EB',
  },
  saveBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
