import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';
import { Room } from '../types';
import { useChatStore } from '../store/useChatStore';
import { AddMemberModal } from './AddMemberModal';
import { chronoTheme } from '../theme/colors';

const { colors, radius } = chronoTheme;

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
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [addMemberVisible, setAddMemberVisible] = useState(false);
  const {
    currentUser,
    fetchRooms,
    deleteRoom,
    startCall,
    uploadRoomIcon,
    removeRoomIcon,
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

  const handlePickAndUploadIcon = async () => {
    try {
      const permissionResult =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert(
          'İzin Gerekli',
          'Fotoğraf seçebilmek için galeri iznine ihtiyacımız var.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setUploadingIcon(true);

      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || 'room_icon.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type,
      } as any);

      const updated = await uploadRoomIcon(roomId, formData);
      setRoom(updated);
      await fetchRooms();
      Alert.alert('Başarılı', 'Oda simgesi başarıyla güncellendi.');
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.response?.data?.message ||
        'Görsel yüklenirken bir sorun oluştu.';
      Alert.alert('Yükleme Hatası', msg);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleRemoveIcon = () => {
    Alert.alert(
      'Simgeyi Kaldır',
      'Oda simgesini kaldırmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            try {
              setUploadingIcon(true);
              const updated = await removeRoomIcon(roomId);
              setRoom(updated);
              await fetchRooms();
              Alert.alert('Başarılı', 'Oda simgesi kaldırıldı.');
            } catch (err: any) {
              Alert.alert(
                'Hata',
                err.response?.data?.message || err?.message || 'Simge kaldırılamadı',
              );
            } finally {
              setUploadingIcon(false);
            }
          },
        },
      ],
    );
  };

  const handleIconOptions = () => {
    if (!isOwner) return;

    const options: any[] = [
      {
        text: 'Galeriden Fotoğraf Seç',
        onPress: handlePickAndUploadIcon,
      },
    ];

    if (room?.iconUrl) {
      options.push({
        text: 'Fotoğrafı Kaldır',
        style: 'destructive',
        onPress: handleRemoveIcon,
      });
    }

    options.push({ text: 'İptal', style: 'cancel' });

    Alert.alert('Oda Simgesi', 'Oda görselini güncellemek için bir işlem seçin:', options);
  };

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
      isOwner ? 'Sohbet Odasını Sil' : 'Sohbet Odasından Ayrıl',
      isOwner
        ? 'Bu sohbet odasını silmek istediğinize emin misiniz? Tüm mesajlar silinecektir.'
        : 'Bu sohbet odasından ayrılmak istediğinize emin misiniz?',
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
              Alert.alert(
                'Hata',
                err.response?.data?.message || 'İşlem gerçekleştirilemedi',
              );
            }
          },
        },
      ],
    );
  };

  const handleRemoveMember = async (memberUserId: string, name: string) => {
    Alert.alert('Üyeyi Çıkar', `${name} adlı kullanıcıyı sohbet odasından çıkarmak istiyor musunuz?`, [
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

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.overlay}>
        <SafeAreaView style={styles.container}>
          {/* Navigation Top Bar */}
          <View style={styles.navHeader}>
            <TouchableOpacity onPress={onClose} style={styles.iconBtn} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.navTitle}>
              {isDirect ? 'Kişi Bilgisi' : 'Sohbet Odası Bilgisi'}
            </Text>
            <View style={{ width: 40 }} />
          </View>

          {loading ? (
            <ActivityIndicator
              size="large"
              color={colors.primaryLight}
              style={{ marginTop: 60 }}
            />
          ) : isDirect ? (
            /* DM Kişi Detay Sayfası */
            <View style={styles.dmProfileContent}>
              <View style={[styles.largeAvatar, { marginBottom: 16 }]}>
                {room?.peer?.avatarUrl ? (
                  <Image source={{ uri: room.peer.avatarUrl }} style={styles.largeAvatarImg} />
                ) : (
                  <Text style={styles.largeAvatarText}>
                    {chatTitle.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>

              <Text style={styles.dmName}>{chatTitle}</Text>
              <Text style={styles.dmUsername}>@{room?.peer?.username || 'kullanici'}</Text>
              <Text style={styles.dmStatus}>
                {room?.peer?.status === 'ONLINE' ? 'çevrimiçi' : 'son görülme yakınlarda'}
              </Text>

              <View style={styles.dmActionRow}>
                <TouchableOpacity
                  style={styles.dmActionBtn}
                  onPress={() => {
                    onClose();
                    startCall(roomId, false);
                  }}
                >
                  <Ionicons name="call" size={20} color="#FFFFFF" />
                  <Text style={styles.dmActionText}>Sesli Ara</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.dmActionBtn}
                  onPress={() => {
                    onClose();
                    startCall(roomId, true);
                  }}
                >
                  <Ionicons name="videocam" size={20} color="#FFFFFF" />
                  <Text style={styles.dmActionText}>Görüntülü</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.dmInfoCard}>
                <Text style={styles.dmInfoLabel}>Hakkında (Bio)</Text>
                <Text style={styles.dmInfoValue}>
                  {room?.peer?.bio || 'Hakkında bilgisi eklenmedi.'}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.dangerActionBtn}
                onPress={handleLeaveOrDelete}
              >
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                <Text style={styles.dangerActionText}>Sohbeti Sil</Text>
              </TouchableOpacity>
            </View>
          ) : (
            /* Sohbet Odası Detay Sayfası */
            <FlatList
              data={room?.members || []}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={
                <View style={styles.headerContent}>
                  {/* Avatar */}
                  <TouchableOpacity
                    style={styles.largeAvatarContainer}
                    onPress={handleIconOptions}
                    disabled={!isOwner || uploadingIcon}
                    activeOpacity={isOwner ? 0.8 : 1}
                  >
                    <View style={styles.largeAvatar}>
                      {uploadingIcon ? (
                        <ActivityIndicator color="#ffffff" size="small" />
                      ) : room?.iconUrl ? (
                        <Image source={{ uri: room.iconUrl }} style={styles.largeAvatarImg} />
                      ) : (
                        <Text style={styles.largeAvatarText}>
                          {chatTitle.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    {isOwner && (
                      <View style={styles.avatarCameraBadge}>
                        <Ionicons name="camera" size={16} color="#ffffff" />
                      </View>
                    )}
                  </TouchableOpacity>

                  {/* Title & Edit */}
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
                        <Ionicons name="checkmark" size={20} color="#ffffff" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={styles.titleRow}>
                      <Text style={styles.roomNameTitle}>{chatTitle}</Text>
                      {isOwner && (
                        <TouchableOpacity
                          onPress={() => setEditingName(true)}
                          style={styles.editIconBtn}
                        >
                          <Ionicons
                            name="pencil-outline"
                            size={18}
                            color={colors.primaryLight}
                          />
                        </TouchableOpacity>
                      )}
                    </View>
                  )}

                  {/* Room Meta */}
                  <Text style={styles.roomMetaText}>
                    {room?.members?.length || 1} üye
                  </Text>

                  {/* Description Card */}
                  {room?.description ? (
                    <View style={styles.descCard}>
                      <Text style={styles.descTitle}>Açıklama</Text>
                      <Text style={styles.descBody}>{room.description}</Text>
                    </View>
                  ) : null}

                  {/* Member Management Actions */}
                  <View style={styles.actionSection}>
                    <TouchableOpacity
                      style={styles.primaryActionBtn}
                      onPress={() => setAddMemberVisible(true)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name="person-add-outline"
                        size={20}
                        color="#ffffff"
                        style={{ marginRight: 8 }}
                      />
                      <Text style={styles.primaryActionText}>Üye Ekle</Text>
                    </TouchableOpacity>
                  </View>

                  <Text style={styles.sectionTitle}>ÜYELER</Text>
                </View>
              }
              renderItem={({ item }) => {
                const isMemberAdmin = item.role === 'ADMIN';
                const isMe = item.userId === currentUser?.id;
                const canKick = isOwner && !isMe;

                return (
                  <View style={styles.memberRow}>
                    <View style={styles.memberAvatar}>
                      <Text style={styles.memberAvatarText}>
                        {(item.user.displayName || item.user.username)
                          .charAt(0)
                          .toUpperCase()}
                      </Text>
                    </View>

                    <View style={styles.memberInfo}>
                      <View style={styles.memberNameRow}>
                        <Text style={styles.memberName}>
                          {item.user.displayName || item.user.username}
                        </Text>
                        {isMe && <Text style={styles.youBadge}> (Sen)</Text>}
                      </View>
                      <Text style={styles.memberStatus}>
                        {isMemberAdmin ? 'Oda Yöneticisi' : 'Üye'}
                      </Text>
                    </View>

                    {canKick && (
                      <TouchableOpacity
                        style={styles.kickBtn}
                        onPress={() =>
                          handleRemoveMember(
                            item.userId,
                            item.user.displayName || item.user.username,
                          )
                        }
                      >
                        <Ionicons name="close-circle-outline" size={20} color={colors.error} />
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListFooterComponent={
                <View style={styles.footerActions}>
                  <TouchableOpacity
                    style={styles.dangerActionBtn}
                    onPress={handleLeaveOrDelete}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={isOwner ? 'trash-outline' : 'log-out-outline'}
                      size={20}
                      color={colors.error}
                      style={{ marginRight: 8 }}
                    />
                    <Text style={styles.dangerActionText}>
                      {isOwner ? 'Sohbet Odasını Sil' : 'Odadan Ayrıl'}
                    </Text>
                  </TouchableOpacity>
                </View>
              }
            />
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
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  headerContent: {
    alignItems: 'center',
    paddingTop: 24,
    paddingHorizontal: 20,
  },
  largeAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  largeAvatarContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarCameraBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: colors.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.surfaceElevated,
    elevation: 3,
  },
  largeAvatarImg: {
    width: 84,
    height: 84,
    borderRadius: 42,
  },
  largeAvatarText: {
    color: '#ffffff',
    fontSize: 32,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  roomNameTitle: {
    color: colors.textPrimary,
    fontSize: 22,
    fontWeight: '700',
  },
  editIconBtn: {
    padding: 6,
    marginLeft: 6,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  nameInput: {
    backgroundColor: colors.inputBackground,
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primaryLight,
    minWidth: 180,
  },
  saveBtn: {
    backgroundColor: colors.primary,
    padding: 10,
    borderRadius: radius.md,
    marginLeft: 8,
  },
  roomMetaText: {
    color: colors.textSecondary,
    fontSize: 14,
    marginBottom: 20,
  },
  descCard: {
    backgroundColor: colors.surfaceElevated,
    width: '100%',
    padding: 16,
    borderRadius: radius.lg,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  descTitle: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  descBody: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 20,
  },
  actionSection: {
    width: '100%',
    marginBottom: 24,
  },
  primaryActionBtn: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  primaryActionText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  sectionTitle: {
    alignSelf: 'flex-start',
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  memberAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  memberAvatarText: {
    color: colors.primaryLight,
    fontSize: 18,
    fontWeight: '700',
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  memberName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  youBadge: {
    color: colors.primaryLight,
    fontSize: 14,
  },
  memberStatus: {
    color: colors.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  kickBtn: {
    padding: 8,
  },
  footerActions: {
    padding: 24,
    paddingBottom: 40,
  },
  dangerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingVertical: 14,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
    marginHorizontal: 20,
    marginTop: 20,
  },
  dangerActionText: {
    color: colors.error,
    fontSize: 15,
    fontWeight: '700',
  },
  dmProfileContent: {
    alignItems: 'center',
    paddingTop: 30,
    paddingHorizontal: 20,
  },
  dmName: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  dmUsername: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  dmStatus: {
    fontSize: 13,
    color: '#38BDF8',
    marginBottom: 20,
  },
  dmActionRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  dmActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 8,
  },
  dmActionText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  dmInfoCard: {
    width: '100%',
    backgroundColor: '#151E2B',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  dmInfoLabel: {
    fontSize: 12,
    color: colors.primaryLight,
    fontWeight: '700',
    marginBottom: 4,
  },
  dmInfoValue: {
    fontSize: 15,
    color: colors.textPrimary,
  },
});
