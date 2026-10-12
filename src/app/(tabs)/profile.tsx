import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
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
import { api } from '../../services/api';
import { updateService } from '../../services/updates';
import { ChronoAvatar } from '../../components/ChronoAvatar';
import * as ImagePicker from 'expo-image-picker';

const { colors } = chronoTheme;

export default function ProfileScreen() {
  const router = useRouter();
  const {
    currentUser,
    settings,
    fetchSettings,
    updateSettings,
    updateProfile,
    uploadAvatar,
    removeAvatar,
    logout,
  } = useChatStore(
    useShallow((s) => ({
      currentUser: s.currentUser,
      settings: s.settings,
      fetchSettings: s.fetchSettings,
      updateSettings: s.updateSettings,
      updateProfile: s.updateProfile,
      uploadAvatar: s.uploadAvatar,
      removeAvatar: s.removeAvatar,
      logout: s.logout,
    })),
  );

  const [editModalVisible, setEditModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [displayName, setDisplayName] = useState(currentUser?.displayName || '');
  const [username, setUsername] = useState(currentUser?.username || '');
  const [bio, setBio] = useState(currentUser?.bio || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

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
      Alert.alert('Başarılı', 'Profil fotoğrafınız güncellendi.');
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
            Alert.alert('Başarılı', 'Profil fotoğrafı kaldırıldı.');
          } catch (err: any) {
            Alert.alert('Hata', err.response?.data?.message || 'Fotoğraf kaldırılamadı');
          }
        },
      });
    }

    options.push({ text: 'İptal', style: 'cancel' });
    Alert.alert('Profil Fotoğrafı', undefined, options);
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      Alert.alert('Uyarı', 'Lütfen tüm alanları doldurun');
      return;
    }
    setSavingPassword(true);
    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      Alert.alert('Başarılı', 'Şifreniz başarıyla güncellendi');
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Şifre değiştirilemedi');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Çıkış Yap',
      'Chrono hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: () => {
            logout();
            router.replace('/onboarding');
          },
        },
      ],
    );
  };

  // Picker modal state
  interface PickerOption {
    value: any;
    label: string;
    description?: string;
  }
  interface PickerConfig {
    key: string;
    title: string;
    options: PickerOption[];
  }
  const [activePicker, setActivePicker] = useState<PickerConfig | null>(null);

  const openVisibilityPicker = (
    key: 'lastSeenVisibility' | 'callVisibility' | 'roomInviteVisibility',
    title: string,
  ) => {
    setActivePicker({
      key,
      title,
      options: [
        { value: 'EVERYONE', label: 'Herkes' },
        { value: 'CONTACTS', label: 'Kişilerim' },
        { value: 'NOBODY', label: 'Hiçkimse' },
      ],
    });
  };

  const openTextSizePicker = () => {
    setActivePicker({
      key: 'messageTextSize',
      title: 'Mesaj Metin Boyutu',
      options: [
        { value: 14, label: '14 px' },
        { value: 16, label: '16 px' },
        { value: 18, label: '18 px' },
      ],
    });
  };

  const getVisibilityLabel = (val?: string) => {
    switch (val) {
      case 'EVERYONE':
        return 'Herkes';
      case 'CONTACTS':
        return 'Kişilerim';
      case 'NOBODY':
        return 'Hiçkimse';
      default:
        return 'Herkes';
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Profil Başlık & Avatarı (Page 8) */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            onPress={handleAvatarOptions}
            activeOpacity={0.8}
            style={{ marginBottom: 14 }}
          >
            <ChronoAvatar
              size={96}
              name={currentUser?.displayName || currentUser?.username}
              uri={currentUser?.avatarUrl}
              badge="camera"
            />
            {uploadingAvatar && (
              <View style={styles.avatarUploadingOverlay}>
                <ActivityIndicator size="small" color="#FFFFFF" />
              </View>
            )}
          </TouchableOpacity>

          <Text style={styles.nameText}>
            {currentUser?.displayName || currentUser?.username || 'Enes Samed'}
          </Text>
          <Text style={styles.subtitleText}>
            @{currentUser?.username || 'zyqwax'} ·{' '}
            <Text style={{ color: '#10B981' }}>çevrimiçi</Text>
          </Text>

          {/* Profili Düzenle Pill Butonu */}
          <TouchableOpacity
            style={styles.editProfileBtn}
            onPress={openEditModal}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil-outline" size={15} color="#38BDF8" style={{ marginRight: 6 }} />
            <Text style={styles.editProfileBtnText}>Profili düzenle</Text>
          </TouchableOpacity>
        </View>

        {/* ============================================================= */}
        {/* 1. HESAP                                                      */}
        {/* ============================================================= */}
        <Text style={styles.sectionHeader}>HESAP</Text>
        <View style={styles.cardContainer}>
          {/* E-posta */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="mail-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>
                {currentUser?.email || 'enessamed422@gmail.com'}
              </Text>
              <Text style={styles.itemSubtitle}>E-posta</Text>
            </View>
          </View>

          {/* Bio */}
          <TouchableOpacity
            style={styles.itemRow}
            onPress={openEditModal}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="pencil-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>
                {currentUser?.bio || 'Hakkında bilgisi ekle'}
              </Text>
              <Text style={styles.itemSubtitle}>Bio</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* ============================================================= */}
        {/* 2. GİZLİLİK                                                   */}
        {/* ============================================================= */}
        <Text style={styles.sectionHeader}>GIZLILIK</Text>
        <View style={styles.cardContainer}>
          {/* Son görülme ve çevrimiçi */}
          <TouchableOpacity
            style={[styles.itemRow, styles.itemRowBorder]}
            onPress={() => openVisibilityPicker('lastSeenVisibility', 'Son görülme ve çevrimiçi')}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="time-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Son görülme ve çevrimiçi</Text>
              <Text style={styles.itemSubtitle}>
                {getVisibilityLabel(settings?.lastSeenVisibility)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* Beni arayabilecekler */}
          <TouchableOpacity
            style={[styles.itemRow, styles.itemRowBorder]}
            onPress={() => openVisibilityPicker('callVisibility', 'Beni arayabilecekler')}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="call-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Beni arayabilecekler</Text>
              <Text style={styles.itemSubtitle}>
                {getVisibilityLabel(settings?.callVisibility)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* Odalara davet */}
          <TouchableOpacity
            style={[styles.itemRow, styles.itemRowBorder]}
            onPress={() => openVisibilityPicker('roomInviteVisibility', 'Odalara davet')}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="people-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Odalara davet</Text>
              <Text style={styles.itemSubtitle}>
                {getVisibilityLabel(settings?.roomInviteVisibility)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* Okundu bilgisi */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="lock-closed-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Okundu bilgisi</Text>
              <Text style={styles.itemSubtitle}>
                {settings?.readReceipts ?? true ? 'Açık' : 'Kapalı'}
              </Text>
            </View>
            <Switch
              value={settings?.readReceipts ?? true}
              onValueChange={(val) => updateSettings({ readReceipts: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Şifre değiştir */}
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => setPasswordModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="key-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Şifre değiştir</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* ============================================================= */}
        {/* 3. BİLDİRİMLER                                                */}
        {/* ============================================================= */}
        <Text style={styles.sectionHeader}>BILDIRIMLER</Text>
        <View style={styles.cardContainer}>
          {/* Kişisel sohbetler */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="chatbubble-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Kişisel sohbetler</Text>
            </View>
            <Switch
              value={settings?.notifyPrivate ?? true}
              onValueChange={(val) => updateSettings({ notifyPrivate: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Sohbet odaları */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="people-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Sohbet odaları</Text>
            </View>
            <Switch
              value={settings?.notifyRooms ?? true}
              onValueChange={(val) => updateSettings({ notifyRooms: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Aramalar */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="call-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Aramalar</Text>
            </View>
            <Switch
              value={settings?.notifyCalls ?? true}
              onValueChange={(val) => updateSettings({ notifyCalls: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Mesaj önizlemesi */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="eye-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Mesaj önizlemesi</Text>
            </View>
            <Switch
              value={settings?.messagePreview ?? true}
              onValueChange={(val) => updateSettings({ messagePreview: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Uygulama içi sesler */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="volume-medium-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Uygulama içi sesler</Text>
            </View>
            <Switch
              value={settings?.inAppSounds ?? true}
              onValueChange={(val) => updateSettings({ inAppSounds: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Titreşim */}
          <View style={styles.itemRow}>
            <View style={styles.iconBox}>
              <Ionicons name="phone-portrait-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Titreşim</Text>
            </View>
            <Switch
              value={settings?.inAppVibrate ?? true}
              onValueChange={(val) => updateSettings({ inAppVibrate: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* ============================================================= */}
        {/* 4. TERCİHLER                                                  */}
        {/* ============================================================= */}
        <Text style={styles.sectionHeader}>TERCIHLER</Text>
        <View style={styles.cardContainer}>
          {/* Mesaj metin boyutu */}
          <TouchableOpacity
            style={[styles.itemRow, styles.itemRowBorder]}
            onPress={openTextSizePicker}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="pencil-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Mesaj metin boyutu</Text>
              <Text style={styles.itemSubtitle}>{settings?.messageTextSize || 16} px</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* 24 saat biçimi */}
          <View style={[styles.itemRow, styles.itemRowBorder]}>
            <View style={styles.iconBox}>
              <Ionicons name="time-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>24 saat biçimi</Text>
            </View>
            <Switch
              value={settings?.timeFormat24h ?? true}
              onValueChange={(val) => updateSettings({ timeFormat24h: val })}
              trackColor={{ false: '#334155', true: '#2563EB' }}
              thumbColor="#FFFFFF"
            />
          </View>

          {/* Güncellemeleri denetle */}
          <TouchableOpacity
            style={styles.itemRow}
            onPress={() => updateService.checkAndApplyUpdates(false)}
            activeOpacity={0.7}
          >
            <View style={styles.iconBox}>
              <Ionicons name="sync-outline" size={18} color="#38BDF8" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={styles.itemTitle}>Güncellemeleri denetle</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* ============================================================= */}
        {/* 5. OTURUM                                                     */}
        {/* ============================================================= */}
        <Text style={styles.sectionHeader}>OTURUM</Text>
        <View style={styles.cardContainer}>
          <TouchableOpacity
            style={styles.itemRow}
            onPress={handleLogout}
            activeOpacity={0.7}
          >
            <View style={[styles.iconBox, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
              <Ionicons name="log-out-outline" size={18} color="#EF4444" />
            </View>
            <View style={styles.itemTextContainer}>
              <Text style={[styles.itemTitle, { color: '#EF4444' }]}>Çıkış yap</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Profil Düzenle Modalı */}
      <Modal
        visible={editModalVisible}
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <SafeAreaView style={styles.editModalContainer}>
          <View style={styles.editModalHeader}>
            <TouchableOpacity onPress={() => setEditModalVisible(false)}>
              <Ionicons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.editModalTitle}>Profili Düzenle</Text>
            <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
              {saving ? (
                <ActivityIndicator size="small" color="#38BDF8" />
              ) : (
                <Ionicons name="checkmark" size={26} color="#38BDF8" />
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ padding: 20 }}>
            <Text style={styles.inputLabel}>Görünen İsim</Text>
            <TextInput
              style={styles.modalTextInput}
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Görünen İsim"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.inputLabel}>Kullanıcı Adı</Text>
            <TextInput
              style={styles.modalTextInput}
              value={username}
              onChangeText={setUsername}
              placeholder="kullanici_adi"
              placeholderTextColor="#64748B"
              autoCapitalize="none"
            />

            <Text style={styles.inputLabel}>Hakkında (Bio)</Text>
            <TextInput
              style={[styles.modalTextInput, { height: 90, textAlignVertical: 'top' }]}
              value={bio}
              onChangeText={setBio}
              placeholder="Kendinizden bahsedin..."
              placeholderTextColor="#64748B"
              multiline
              maxLength={80}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Şifre Değiştirme Modalı */}
      <Modal
        visible={passwordModalVisible}
        animationType="fade"
        transparent
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalCardTitle}>Şifre Değiştir</Text>

            <Text style={styles.modalInputLabel}>Mevcut Şifre</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="••••••"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.modalInputLabel}>Yeni Şifre (En az 6 karakter)</Text>
            <TextInput
              style={styles.modalInput}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              placeholder="••••••"
              placeholderTextColor="#64748B"
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setPasswordModalVisible(false)}
              >
                <Text style={styles.modalCancelBtnText}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleChangePassword}
                disabled={savingPassword}
              >
                {savingPassword ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.modalSaveBtnText}>Güncelle</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Seçenek Seçim Modalı */}
      <Modal
        visible={!!activePicker}
        animationType="fade"
        transparent
        onRequestClose={() => setActivePicker(null)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setActivePicker(null)}
        >
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>{activePicker?.title}</Text>
            {activePicker?.options.map((opt) => {
              const isSelected =
                settings?.[activePicker.key as keyof typeof settings] === opt.value;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[
                    styles.pickerRow,
                    isSelected && styles.pickerRowSelected,
                  ]}
                  onPress={async () => {
                    const key = activePicker.key;
                    setActivePicker(null);
                    await updateSettings({ [key]: opt.value });
                  }}
                >
                  <Text
                    style={[
                      styles.pickerLabel,
                      isSelected && styles.pickerLabelSelected,
                    ]}
                  >
                    {opt.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={18} color="#38BDF8" />
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 16,
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
  nameText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  subtitleText: {
    fontSize: 13,
    color: '#8A93A8',
    marginBottom: 16,
  },
  editProfileBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  editProfileBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginTop: 20,
    marginBottom: 8,
    marginLeft: 4,
  },
  cardContainer: {
    backgroundColor: '#111827',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    overflow: 'hidden',
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  itemRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemTextContainer: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  itemSubtitle: {
    fontSize: 12,
    color: '#8A93A8',
  },
  editModalContainer: {
    flex: 1,
    backgroundColor: '#0B0F1A',
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
    color: '#FFFFFF',
  },
  inputLabel: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 16,
    marginBottom: 6,
  },
  modalTextInput: {
    backgroundColor: '#111827',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  modalInputLabel: {
    fontSize: 12,
    color: '#38BDF8',
    fontWeight: '600',
    marginTop: 10,
    marginBottom: 6,
  },
  modalInput: {
    backgroundColor: '#0B0F1A',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalCancelBtnText: {
    color: '#8A93A8',
    fontSize: 14,
    fontWeight: '600',
  },
  modalSaveBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  modalSaveBtnText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  pickerCard: {
    width: '100%',
    backgroundColor: '#111827',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 14,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.04)',
  },
  pickerRowSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.06)',
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  pickerLabel: {
    fontSize: 15,
    color: '#8A93A8',
  },
  pickerLabelSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
