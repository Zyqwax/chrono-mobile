import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { ChronoAvatar } from './ChronoAvatar';

interface CreateRoomModalProps {
  visible: boolean;
  onClose: () => void;
  onRoomCreated?: (room: any) => void;
}

const PRESET_ICONS = ['💬', '🚀', '🎮', '💡', '🔥', '🎧', '⚡', '☕'];

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  visible,
  onClose,
  onRoomCreated,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('💬');
  const [customIconUri, setCustomIconUri] = useState<string | null>(null);
  const [uploadedIconUrl, setUploadedIconUrl] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameFocused, setNameFocused] = useState(false);
  const [descFocused, setDescFocused] = useState(false);
  const { fetchRooms, setActiveRoom, uploadTempRoomIcon } = useChatStore();

  const handlePickImage = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'İzin Gerekli',
          'Oda simgesi seçebilmek için galeri erişim iznine ihtiyacımız var.',
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const asset = result.assets[0];
      setCustomIconUri(asset.uri);
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

      const uploaded = await uploadTempRoomIcon(formData);
      setUploadedIconUrl(uploaded.iconUrl);
    } catch (err: any) {
      console.warn('Oda simgesi yükleme hatası:', err);
      Alert.alert('Yükleme Hatası', err?.message || 'Görsel yüklenemedi');
      setCustomIconUri(null);
      setUploadedIconUrl(null);
    } finally {
      setUploadingIcon(false);
    }
  };

  const handleRemoveImage = () => {
    setCustomIconUri(null);
    setUploadedIconUrl(null);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Uyarı', 'Lütfen bir oda adı girin');
      return;
    }

    if (uploadingIcon) {
      Alert.alert('Lütfen Bekleyin', 'Oda simgesi yükleniyor, lütfen tamamlanmasını bekleyin.');
      return;
    }

    try {
      setLoading(true);
      // Eğer özel resim yüklendiyse ismi doğrudan kullan, yoksa emoji prefiksini ekle
      const roomName = customIconUri ? name.trim() : `${selectedIcon} ${name.trim()}`;

      const res = await api.post('/rooms', {
        name: roomName,
        description: description.trim(),
        iconUrl: uploadedIconUrl || undefined,
      });

      await fetchRooms();
      setActiveRoom(res.data);
      if (onRoomCreated) onRoomCreated(res.data);
      handleClose();
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err.response?.data?.message || err?.message || 'Oda oluşturulamadı',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setName('');
    setDescription('');
    setSelectedIcon('💬');
    setCustomIconUri(null);
    setUploadedIconUrl(null);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardAvoid}
          >
            <SafeAreaView style={styles.card} edges={['bottom']}>
              <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
                <View>
                  {/* Sürükleme Çubuğu */}
                  <View style={styles.dragHandleContainer}>
                    <View style={styles.dragHandle} />
                  </View>

                  {/* Başlık ve Kapat Butonu */}
                  <View style={styles.header}>
                    <Text style={styles.title}>Yeni oda</Text>
                    <TouchableOpacity
                      onPress={handleClose}
                      style={styles.closeBtn}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="close" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  </View>

                  {/* Açıklama */}
                  <Text style={styles.subtitle}>
                    Mesajlaşmak ve canlı sesli sohbet için bir oda aç.
                  </Text>

                  <ScrollView showsVerticalScrollIndicator={false}>
                    {/* ODA SİMGESİ VE FOTOĞRAF YÜKLEME ALANI */}
                    <View style={styles.avatarPickerSection}>
                      <TouchableOpacity
                        style={styles.avatarButtonWrapper}
                        onPress={handlePickImage}
                        activeOpacity={0.8}
                        disabled={uploadingIcon}
                      >
                        <ChronoAvatar
                          size={76}
                          name={name.trim() || 'Oda'}
                          emoji={customIconUri ? undefined : selectedIcon}
                          uri={customIconUri}
                          badge="camera"
                        />
                        {uploadingIcon && (
                          <View style={styles.avatarLoadingOverlay}>
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          </View>
                        )}
                      </TouchableOpacity>

                      <View style={styles.avatarActionButtons}>
                        <TouchableOpacity
                          style={styles.pickPhotoBtn}
                          onPress={handlePickImage}
                          activeOpacity={0.7}
                          disabled={uploadingIcon}
                        >
                          <Ionicons
                            name={customIconUri ? 'sync-outline' : 'image-outline'}
                            size={16}
                            color="#38BDF8"
                          />
                          <Text style={styles.pickPhotoBtnText}>
                            {customIconUri ? 'Görseli Değiştir' : 'Fotoğraf Seç'}
                          </Text>
                        </TouchableOpacity>

                        {customIconUri && (
                          <TouchableOpacity
                            style={styles.removePhotoBtn}
                            onPress={handleRemoveImage}
                            activeOpacity={0.7}
                            disabled={uploadingIcon}
                          >
                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            <Text style={styles.removePhotoBtnText}>Kaldır</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>

                    {/* Simge / Emoji Seçimi (Yalnızca özel resim seçilmemişse) */}
                    {!customIconUri && (
                      <>
                        <Text style={styles.sectionLabel}>VEYA EMOJİ SEÇİN</Text>
                        <View style={styles.iconRow}>
                          {PRESET_ICONS.map((icon) => {
                            const isSelected = selectedIcon === icon;
                            return (
                              <TouchableOpacity
                                key={icon}
                                style={[
                                  styles.iconItem,
                                  isSelected && styles.iconItemSelected,
                                ]}
                                onPress={() => setSelectedIcon(icon)}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.iconEmoji}>{icon}</Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      </>
                    )}

                    {/* Oda Adı Giriş Kartı */}
                    <View
                      style={[
                        styles.inputCard,
                        nameFocused && styles.inputCardFocused,
                      ]}
                    >
                      <View style={styles.inputCardIcon}>
                        <Ionicons name="people-outline" size={22} color="#38BDF8" />
                      </View>
                      <View style={styles.inputCardContent}>
                        <Text style={styles.inputCardLabel}>Oda adı</Text>
                        <TextInput
                          style={styles.inputCardText}
                          placeholder="Örn: Yazılım ve Tasarım"
                          placeholderTextColor="#475569"
                          value={name}
                          onChangeText={setName}
                          onFocus={() => setNameFocused(true)}
                          onBlur={() => setNameFocused(false)}
                          maxLength={40}
                        />
                      </View>
                    </View>

                    {/* Açıklama Giriş Kartı */}
                    <View
                      style={[
                        styles.inputCard,
                        descFocused && styles.inputCardFocused,
                      ]}
                    >
                      <View style={styles.inputCardIcon}>
                        <Ionicons name="pencil-outline" size={20} color="#38BDF8" />
                      </View>
                      <View style={styles.inputCardContent}>
                        <Text style={styles.inputCardLabel}>Açıklama (isteğe bağlı)</Text>
                        <TextInput
                          style={styles.inputCardText}
                          placeholder="Odanın amacını yaz"
                          placeholderTextColor="#475569"
                          value={description}
                          onChangeText={setDescription}
                          onFocus={() => setDescFocused(true)}
                          onBlur={() => setDescFocused(false)}
                          maxLength={120}
                        />
                      </View>
                    </View>

                    {/* Odayı Aç Butonu */}
                    <TouchableOpacity
                      style={[
                        styles.openRoomBtn,
                        (loading || uploadingIcon) && styles.btnDisabled,
                      ]}
                      onPress={handleCreate}
                      disabled={loading || uploadingIcon}
                      activeOpacity={0.85}
                    >
                      {loading || uploadingIcon ? (
                        <ActivityIndicator color="#FFFFFF" />
                      ) : (
                        <View style={styles.openRoomBtnContent}>
                          <Text style={styles.openRoomBtnText}>Odayı Aç</Text>
                          <View style={styles.plusIconCircle}>
                            <Ionicons name="add" size={18} color="#FFFFFF" />
                          </View>
                        </View>
                      )}
                    </TouchableOpacity>
                  </ScrollView>
                </View>
              </TouchableWithoutFeedback>
            </SafeAreaView>
          </KeyboardAvoidingView>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  keyboardAvoid: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0E1424',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandleContainer: {
    alignItems: 'center',
    paddingVertical: 6,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#162032',
    alignItems: 'center',
    justifyContent: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#94A3B8',
    marginBottom: 20,
    lineHeight: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
    letterSpacing: 0.8,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  iconItem: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#131B2E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  iconItemSelected: {
    borderColor: '#2563EB',
    backgroundColor: 'rgba(37, 99, 235, 0.2)',
    transform: [{ scale: 1.1 }],
  },
  iconEmoji: {
    fontSize: 18,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#131B2E',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    marginBottom: 14,
  },
  inputCardFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#162238',
  },
  inputCardIcon: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inputCardContent: {
    flex: 1,
  },
  inputCardLabel: {
    fontSize: 11,
    color: '#8A93A8',
    fontWeight: '600',
    marginBottom: 2,
  },
  inputCardText: {
    fontSize: 15,
    color: '#FFFFFF',
    padding: 0,
  },
  openRoomBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 26,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 12,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  openRoomBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingHorizontal: 20,
  },
  openRoomBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    flex: 1,
    textAlign: 'center',
    marginLeft: 26,
  },
  plusIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarPickerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    marginTop: 4,
  },
  avatarButtonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(11, 15, 26, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  avatarActionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  },
  pickPhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  pickPhotoBtnText: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
  },
  removePhotoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  removePhotoBtnText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
});
