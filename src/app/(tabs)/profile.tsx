import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
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
import { useRouter } from 'expo-router';
import { chronoTheme } from '../../theme/colors';
import { useChatStore } from '../../store/useChatStore';
import { useShallow } from 'zustand/react/shallow';

import * as ImagePicker from 'expo-image-picker';

const { colors } = chronoTheme;

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, updateProfile, uploadAvatar, removeAvatar } = useChatStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      updateProfile: s.updateProfile,
      uploadAvatar: s.uploadAvatar,
      removeAvatar: s.removeAvatar,
    })),
  );

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const openEditModal = () => {
    setDisplayName(currentUser?.displayName || '');
    setUsername(currentUser?.username || '');
    setBio(currentUser?.bio || '');
    setEditModalVisible(true);
  };

  const handleSaveProfile = async () => {
    if (!displayName.trim()) {
      Alert.alert('Uyarı', 'Görünen isim boş bırakılamaz');
      return;
    }
    setSaving(true);
    try {
      await updateProfile({
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      setEditModalVisible(false);
      Alert.alert('Başarılı', 'Profil bilgileriniz güncellendi');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Profil güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  const handlePickAndUploadImage = async () => {
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
      setUploadingAvatar(true);

      const formData = new FormData();
      const filename = asset.uri.split('/').pop() || 'avatar.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('file', {
        uri: asset.uri,
        name: filename,
        type,
      } as any);

      await uploadAvatar(formData);
      Alert.alert('Başarılı', 'Profil fotoğrafınız Cloudinary ile güncellendi.');
    } catch (err: any) {
      const msg =
        err?.message ||
        err?.response?.data?.message ||
        'Fotoğraf yüklenirken bir sorun oluştu.';
      Alert.alert('Yükleme Hatası', msg);
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleAvatarOptions = () => {
    const options: any[] = [
      {
        text: 'Galeriden Fotoğraf Seç',
        onPress: handlePickAndUploadImage,
      },
    ];

    if (currentUser?.avatarUrl) {
      options.push({
        text: 'Fotoğrafı Kaldır',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeAvatar();
            Alert.alert('Başarılı', 'Profil fotoğrafı kaldırıldı ve Cloudinary\'den silindi.');
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.message || 'Fotoğraf kaldırılamadı');
          }
        },
      });
    }

    options.push({ text: 'İptal', style: 'cancel' });

    Alert.alert('Profil Fotoğrafı', 'Günde en fazla 2 kez fotoğraf değiştirebilirsiniz.', options);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Üst Bar */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
        <TouchableOpacity
          style={styles.headerBtn}
          onPress={() => router.push('/(tabs)/settings')}
          activeOpacity={0.7}
        >
          <Ionicons name="settings-outline" size={22} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Büyük Profil Fotoğrafı & Durum */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={handleAvatarOptions}
            activeOpacity={0.8}
          >
            {currentUser?.avatarUrl ? (
              <Image source={{ uri: currentUser.avatarUrl }} style={styles.avatarImg} />
            ) : (
              <View style={styles.avatarFallback}>
                <Text style={styles.avatarFallbackText}>
                  {(currentUser?.displayName || currentUser?.username || 'Z')
                    .slice(0, 1)
                    .toUpperCase()}
                </Text>
              </View>
            )}
            {uploadingAvatar && (
              <View style={styles.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
            <View style={styles.cameraBadge}>
              <Ionicons name="camera" size={14} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          <Text style={styles.nameText}>
            {currentUser?.displayName || currentUser?.username || 'Kullanıcı'}
          </Text>
          <Text style={styles.onlineStatusText}>çevrimiçi</Text>
        </View>

        {/* Hızlı Aksiyon Butonları: [Fotoğrafı Değiştir] [Bilgiyi Düzenle] [Ayarlar] */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleAvatarOptions}
            activeOpacity={0.75}
          >
            <Ionicons name="camera-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.actionBtnText}>Fotoğraf</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={openEditModal}
            activeOpacity={0.75}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.actionBtnText}>Bilgiyi Düzenle</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => router.push('/(tabs)/settings')}
            activeOpacity={0.75}
          >
            <Ionicons name="settings-outline" size={18} color={colors.textPrimary} />
            <Text style={styles.actionBtnText}>Ayarlar</Text>
          </TouchableOpacity>
        </View>

        {/* Gerçek DB Bilgi Kartı */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>@{currentUser?.username || 'kullanici'}</Text>
            <Text style={styles.infoLabel}>Kullanıcı adı</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>
              {currentUser?.bio || 'Henüz bir hakkında bilgisi eklenmedi.'}
            </Text>
            <Text style={styles.infoLabel}>Hakkında (Bio)</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{currentUser?.email || 'Belirtilmedi'}</Text>
            <Text style={styles.infoLabel}>E-posta</Text>
          </View>
        </View>

        {/* Telegram Tarzı İpuçları Kartı */}
        <View style={styles.tipCard}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primaryLight} />
          <Text style={styles.tipText}>
            Diğer kullanıcılar kullanıcı adınızı (@{currentUser?.username}) aratarak sizinle doğrudan birebir sohbet başlatabilir.
          </Text>
        </View>
      </ScrollView>

      {/* Profil Düzenleme Modalı */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Profili Düzenle</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primaryLight} />
              ) : (
                <Ionicons name="checkmark" size={26} color={colors.primaryLight} />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 16 }}>
            <Text style={styles.inputLabel}>Görünen İsim</Text>
            <TextInput
              style={styles.textInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Görünen İsim"
              placeholderTextColor={colors.textSecondary}
            />

            <Text style={styles.inputLabel}>Kullanıcı Adı</Text>
            <TextInput
              style={styles.textInput}
              value={username}
              onChangeText={setUsername}
              placeholder="kullanici_adi"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Hakkında (Bio)</Text>
            <TextInput
              style={[styles.textInput, { height: 80, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Kendinizden bahsedin..."
              placeholderTextColor={colors.textSecondary}
              multiline
              maxLength={70}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 20,
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImg: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#38BDF8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarUploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 48,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarFallbackText: {
    fontSize: 38,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#0284C7',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  onlineStatusText: {
    fontSize: 13,
    color: '#38BDF8',
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 18,
  },
  actionBtn: {
    flex: 1,
    height: 48,
    backgroundColor: '#151E2B',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    gap: 4,
  },
  actionBtnText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  infoCard: {
    backgroundColor: '#151E2B',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
  },
  infoRow: {
    paddingVertical: 4,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 2,
  },
  infoLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    marginVertical: 10,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  tipText: {
    flex: 1,
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  editModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.06)',
  },
  editModalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  inputLabel: {
    fontSize: 13,
    color: colors.primaryLight,
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: '#151E2B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
});
