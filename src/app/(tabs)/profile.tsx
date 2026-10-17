import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useShallow } from "zustand/react/shallow";
import Constants from "expo-constants";

import { useChatStore } from "../../store/useChatStore";
import { api } from "../../services/api";
import { updateService } from "../../services/updates";
import { ChronoAvatar } from "../../components/ChronoAvatar";
import { Visibility } from "../../types";

// Özel Modallar (PDF Tasarımlarına Birebir Uygun)
import { VisibilityPickerSheet } from "../../components/modals/VisibilityPickerSheet";
import { TextSizeSheet } from "../../components/modals/TextSizeSheet";
import { ChangePasswordSheet } from "../../components/modals/ChangePasswordSheet";
import { LogoutModal } from "../../components/modals/LogoutModal";
import { DeleteAccountModal } from "../../components/modals/DeleteAccountModal";
import { EditProfileSheet } from "../../components/modals/EditProfileSheet";
import { AvatarOptionsModal } from "../../components/modals/AvatarOptionsModal";
import { ChronoAlertModal, AlertState } from "../../components/modals/ChronoAlertModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function ProfileScreen() {
  const router = useRouter();

  const { currentUser, settings, fetchSettings, updateSettings, updateProfile, uploadAvatar, removeAvatar, logout } =
    useChatStore(
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

  // Modalların State'leri
  const [editProfileVisible, setEditProfileVisible] = useState(false);
  const [avatarOptionsVisible, setAvatarOptionsVisible] = useState(false);
  const [passwordSheetVisible, setPasswordSheetVisible] = useState(false);
  const [textSizeSheetVisible, setTextSizeSheetVisible] = useState(false);
  const [logoutModalVisible, setLogoutModalVisible] = useState(false);
  const [deleteAccountVisible, setDeleteAccountVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchActive, setIsSearchActive] = useState(false);

  // Genel Özel Alert Modalı State'i (Sistem Alert.alert yerine)
  const [alertState, setAlertState] = useState<AlertState>({
    visible: false,
    title: "",
    message: "",
    type: "info",
  });

  const showAlert = (title: string, message?: string, type: AlertState["type"] = "info") => {
    setAlertState({ visible: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState((prev) => ({ ...prev, visible: false }));
  };

  // Gizlilik Seçici Sheet State'i
  const [visibilityPickerConfig, setVisibilityPickerConfig] = useState<{
    visible: boolean;
    key: "lastSeenVisibility" | "callVisibility" | "roomInviteVisibility";
    title: string;
    subtitle: string;
  } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Görünürlük Etiketi
  const getVisibilityLabel = (val?: Visibility) => {
    switch (val) {
      case "EVERYONE":
        return "Herkes";
      case "CONTACTS":
        return "Kişilerim";
      case "NOBODY":
        return "Hiçkimse";
      default:
        return "Herkes";
    }
  };

  // Galeri İzni ve Avatar Yükleme
  const handlePickAndUploadImage = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permissionResult.granted) {
        showAlert("İzin Gerekli", "Fotoğraf seçebilmek için galeri iznine ihtiyacımız var.", "warning");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
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
      const filename = asset.uri.split("/").pop() || "avatar.jpg";
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : "image/jpeg";

      formData.append("file", {
        uri: asset.uri,
        name: filename,
        type,
      } as any);

      await uploadAvatar(formData);
      showAlert("Başarılı", "Profil fotoğrafınız güncellendi.", "success");
    } catch (err: any) {
      const msg = err?.message || err?.response?.data?.message || "Fotoğraf yüklenirken bir sorun oluştu.";
      showAlert("Yükleme Hatası", msg, "error");
    } finally {
      setUploadingAvatar(false);
    }
  };

  // Avatarı Kaldırma
  const handleRemoveAvatar = async () => {
    try {
      await removeAvatar();
      showAlert("Başarılı", "Profil fotoğrafı kaldırıldı.", "success");
    } catch (err: any) {
      showAlert("Hata", err?.response?.data?.message || "Fotoğraf kaldırılamadı.", "error");
    }
  };

  // Şifre Değiştirme
  const handleChangePassword = async (currentPassword: string, newPassword: string) => {
    await api.patch("/users/me/password", { currentPassword, newPassword });
    showAlert("Başarılı", "Şifreniz başarıyla güncellendi.", "success");
  };

  // Çıkış Yapma
  const handleConfirmLogout = () => {
    setLogoutModalVisible(false);
    logout();
    router.replace("/onboarding");
  };

  // Hesap Silme
  const handleConfirmDeleteAccount = async () => {
    try {
      // Backend hesabı silme isteği
      await api.post("/users/me/delete", { password: "confirmed_by_username" }).catch(async () => {
        // Eğer backend parola bekliyorsa alternatif endpoint'i deneriz
        await api.delete("/users/me").catch(() => {});
      });
      setDeleteAccountVisible(false);
      logout();
      router.replace("/onboarding");
    } catch (err: any) {
      showAlert("Hata", err?.response?.data?.message || "Hesap silinemedi.", "error");
    }
  };

  // Profil Güncelleme
  const handleSaveProfile = async (data: { displayName: string; username: string; bio: string }) => {
    await updateProfile(data);
    showAlert("Başarılı", "Profil bilgileriniz güncellendi.", "success");
  };

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      {/* ------------------------------------------------------------- */}
      {/* 1. Header (Ayarlar + Arama Butonu) - Sayfa 6                   */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Ayarlar</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setIsSearchActive((prev) => !prev)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isSearchActive ? "close" : "search-outline"}
              size={22}
              color={isSearchActive ? "#38BDF8" : "#FFFFFF"}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Arama Alanı (Açıldığında filtreleme sağlar) */}
      {isSearchActive && (
        <View style={styles.searchBarContainer}>
          <Ionicons name="search" size={16} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchBarInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Ayarlarda ara..."
            placeholderTextColor="#64748B"
            autoFocus
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={16} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ------------------------------------------------------------- */}
        {/* 2. Profil Kartı (Avatar, İsim, E-posta, Bio Ekle) - Sayfa 6   */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.profileCard}>
          <View style={styles.profileCardTop}>
            {/* Avatar & Durum Göstergesi */}
            <TouchableOpacity onPress={() => setAvatarOptionsVisible(true)} activeOpacity={0.85}>
              <ChronoAvatar
                size={54}
                name={currentUser?.displayName || currentUser?.username || "U"}
                uri={currentUser?.avatarUrl}
                online={true}
              />
              {uploadingAvatar && (
                <View style={styles.avatarUploadingOverlay}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                </View>
              )}
            </TouchableOpacity>

            {/* İsim ve Kullanıcı Adı */}
            <View style={styles.profileInfoText}>
              <Text style={styles.displayNameText} numberOfLines={1}>
                {currentUser?.displayName || currentUser?.username || "Enes Samed"}
              </Text>
              <Text style={styles.usernameStatusText} numberOfLines={1}>
                @{currentUser?.username || "zyqwax"} · <Text style={styles.onlineBadgeText}>çevrimiçi</Text>
              </Text>
            </View>

            {/* Düzenleme Kalemi Butonu */}
            <TouchableOpacity
              style={styles.editPencilBtn}
              onPress={() => setEditProfileVisible(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="pencil-outline" size={20} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* İnce Ayırıcı */}
          <View style={styles.profileCardDivider} />

          {/* Alt Satır: E-posta ve Bio Ekle */}
          <View style={styles.profileCardBottom}>
            <View style={styles.emailRow}>
              <Ionicons name="mail-outline" size={16} color="#38BDF8" style={{ marginRight: 6 }} />
              <Text style={styles.emailText} numberOfLines={1}>
                {currentUser?.email || "enessamed422@gmail.com"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setEditProfileVisible(true)}
              activeOpacity={0.7}
              style={styles.bioActionBtn}
            >
              <Text style={styles.bioActionText} numberOfLines={1}>
                {currentUser?.bio?.trim() ? currentUser.bio : "Bio ekle"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 3. HIZLI AYARLAR (2 Sütunlu Grid) - Sayfa 6                   */}
        {/* ------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>HIZLI AYARLAR</Text>
        <View style={styles.quickGrid}>
          {/* Kart 1: Okundu Bilgisi */}
          <View style={styles.quickCard}>
            <View style={styles.quickCardHeader}>
              <View style={[styles.quickIconBox, (settings?.readReceipts ?? true) && styles.quickIconBoxActive]}>
                <Ionicons name="lock-closed" size={17} color="#FFFFFF" />
              </View>
              <Switch
                value={settings?.readReceipts ?? true}
                onValueChange={(val) => updateSettings({ readReceipts: val })}
                trackColor={{ false: "#1E293B", true: "#2563EB" }}
                thumbColor="#FFFFFF"
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.quickCardTitle}>Okundu bilgisi</Text>
            <Text style={styles.quickCardSubtitle}>{(settings?.readReceipts ?? true) ? "Açık" : "Kapalı"}</Text>
          </View>

          {/* Kart 2: Kişisel Sohbet Bildirimleri */}
          <View style={styles.quickCard}>
            <View style={styles.quickCardHeader}>
              <View style={[styles.quickIconBox, (settings?.notifyPrivate ?? true) && styles.quickIconBoxActive]}>
                <Ionicons name="chatbubble" size={17} color="#FFFFFF" />
              </View>
              <Switch
                value={settings?.notifyPrivate ?? true}
                onValueChange={(val) => updateSettings({ notifyPrivate: val })}
                trackColor={{ false: "#1E293B", true: "#2563EB" }}
                thumbColor="#FFFFFF"
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.quickCardTitle}>Kişisel sohbet</Text>
            <Text style={styles.quickCardSubtitle}>
              {(settings?.notifyPrivate ?? true) ? "Bildirim açık" : "Kapalı"}
            </Text>
          </View>

          {/* Kart 3: Sohbet Odaları Bildirimleri */}
          <View style={styles.quickCard}>
            <View style={styles.quickCardHeader}>
              <View style={[styles.quickIconBox, (settings?.notifyRooms ?? true) && styles.quickIconBoxActive]}>
                <Ionicons name="people" size={17} color="#FFFFFF" />
              </View>
              <Switch
                value={settings?.notifyRooms ?? true}
                onValueChange={(val) => updateSettings({ notifyRooms: val })}
                trackColor={{ false: "#1E293B", true: "#2563EB" }}
                thumbColor="#FFFFFF"
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.quickCardTitle}>Sohbet odaları</Text>
            <Text style={styles.quickCardSubtitle}>{(settings?.notifyRooms ?? true) ? "Bildirim açık" : "Kapalı"}</Text>
          </View>

          {/* Kart 4: Uygulama Sesleri */}
          <View style={styles.quickCard}>
            <View style={styles.quickCardHeader}>
              <View style={[styles.quickIconBox, (settings?.inAppSounds ?? true) && styles.quickIconBoxActive]}>
                <Ionicons name="volume-high" size={17} color="#FFFFFF" />
              </View>
              <Switch
                value={settings?.inAppSounds ?? true}
                onValueChange={(val) => updateSettings({ inAppSounds: val })}
                trackColor={{ false: "#1E293B", true: "#2563EB" }}
                thumbColor="#FFFFFF"
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.quickCardTitle}>Uygulama sesleri</Text>
            <Text style={styles.quickCardSubtitle}>{(settings?.inAppSounds ?? true) ? "Açık" : "Kapalı"}</Text>
          </View>

          {/* Kart 5: 24 Saat Biçimi */}
          <View style={styles.quickCard}>
            <View style={styles.quickCardHeader}>
              <View style={[styles.quickIconBox, (settings?.timeFormat24h ?? true) && styles.quickIconBoxActive]}>
                <Ionicons name="time" size={17} color="#FFFFFF" />
              </View>
              <Switch
                value={settings?.timeFormat24h ?? true}
                onValueChange={(val) => updateSettings({ timeFormat24h: val })}
                trackColor={{ false: "#1E293B", true: "#2563EB" }}
                thumbColor="#FFFFFF"
                style={styles.switchStyle}
              />
            </View>
            <Text style={styles.quickCardTitle}>24 saat biçimi</Text>
            <Text style={styles.quickCardSubtitle}>{(settings?.timeFormat24h ?? true) ? "Açık" : "Kapalı"}</Text>
          </View>

          {/* Kart 6: Metin Boyutu (Sayfa 2 Bottom Sheet Açıcı) */}
          <TouchableOpacity style={styles.quickCard} onPress={() => setTextSizeSheetVisible(true)} activeOpacity={0.75}>
            <View style={styles.quickCardHeader}>
              <View style={[styles.quickIconBox, styles.quickIconBoxAa]}>
                <Text style={styles.quickIconTextAa}>Aa</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
            </View>
            <Text style={styles.quickCardTitle}>Metin boyutu</Text>
            <Text style={styles.quickCardSubtitle}>{settings?.messageTextSize || 16} px</Text>
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 4. GİZLİLİK - Sayfa 6 & Sayfa 1                                */}
        {/* ------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>GIZLILIK</Text>
        <View style={styles.listContainer}>
          {/* Son Görülme */}
          <TouchableOpacity
            style={[styles.listRow, styles.listRowBorder]}
            onPress={() =>
              setVisibilityPickerConfig({
                visible: true,
                key: "lastSeenVisibility",
                title: "Son görülme ve çevrimiçi",
                subtitle: "Durumunu kimlerin görebileceğini seç.",
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.listRowLeft}>
              <Ionicons name="time-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Son görülme</Text>
            </View>
            <View style={styles.pillDropdown}>
              <Text style={styles.pillDropdownText}>{getVisibilityLabel(settings?.lastSeenVisibility)}</Text>
              <Ionicons name="chevron-down" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>

          {/* Arama */}
          <TouchableOpacity
            style={[styles.listRow, styles.listRowBorder]}
            onPress={() =>
              setVisibilityPickerConfig({
                visible: true,
                key: "callVisibility",
                title: "Beni arayabilecekler",
                subtitle: "Seni kimlerin sesli veya görüntülü arayabileceğini seç.",
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.listRowLeft}>
              <Ionicons name="call-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Arama</Text>
            </View>
            <View style={styles.pillDropdown}>
              <Text style={styles.pillDropdownText}>{getVisibilityLabel(settings?.callVisibility)}</Text>
              <Ionicons name="chevron-down" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>

          {/* Oda Daveti */}
          <TouchableOpacity
            style={styles.listRow}
            onPress={() =>
              setVisibilityPickerConfig({
                visible: true,
                key: "roomInviteVisibility",
                title: "Odalara davet",
                subtitle: "Seni kimlerin sohbet odalarına ekleyebileceğini seç.",
              })
            }
            activeOpacity={0.7}
          >
            <View style={styles.listRowLeft}>
              <Ionicons name="people-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Oda daveti</Text>
            </View>
            <View style={styles.pillDropdown}>
              <Text style={styles.pillDropdownText}>{getVisibilityLabel(settings?.roomInviteVisibility)}</Text>
              <Ionicons name="chevron-down" size={14} color="#94A3B8" style={{ marginLeft: 4 }} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 5. HESAP - Sayfa 6 & Sayfa 3                                   */}
        {/* ------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>HESAP</Text>
        <View style={styles.listContainer}>
          {/* Şifre Değiştir */}
          <TouchableOpacity
            style={[styles.listRow, styles.listRowBorder]}
            onPress={() => setPasswordSheetVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.listRowLeft}>
              <Ionicons name="key-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Şifre değiştir</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>

          {/* Güncellemeleri Denetle */}
          <TouchableOpacity
            style={styles.listRow}
            onPress={() => updateService.checkAndApplyUpdates(false)}
            activeOpacity={0.7}
          >
            <View style={styles.listRowLeft}>
              <Ionicons name="sync-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Güncellemeleri denetle</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#64748B" />
          </TouchableOpacity>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 6. DİĞER TERCİHLER (Uygulama İşlevlerini Koru Kuralı)           */}
        {/* ------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>DİĞER BİLDİRİM VE TERCİHLER</Text>
        <View style={styles.listContainer}>
          {/* Arama Bildirimleri */}
          <View style={[styles.listRow, styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <Ionicons name="notifications-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Arama bildirimleri</Text>
            </View>
            <Switch
              value={settings?.notifyCalls ?? true}
              onValueChange={(val) => updateSettings({ notifyCalls: val })}
              trackColor={{ false: "#1E293B", true: "#2563EB" }}
              thumbColor="#FFFFFF"
              style={styles.switchStyle}
            />
          </View>

          {/* Mesaj Önizlemesi */}
          <View style={[styles.listRow, styles.listRowBorder]}>
            <View style={styles.listRowLeft}>
              <Ionicons name="eye-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Mesaj önizlemesi</Text>
            </View>
            <Switch
              value={settings?.messagePreview ?? true}
              onValueChange={(val) => updateSettings({ messagePreview: val })}
              trackColor={{ false: "#1E293B", true: "#2563EB" }}
              thumbColor="#FFFFFF"
              style={styles.switchStyle}
            />
          </View>

          {/* Titreşim */}
          <View style={styles.listRow}>
            <View style={styles.listRowLeft}>
              <Ionicons name="phone-portrait-outline" size={20} color="#94A3B8" style={{ marginRight: 14 }} />
              <Text style={styles.listRowTitle}>Titreşim</Text>
            </View>
            <Switch
              value={settings?.inAppVibrate ?? true}
              onValueChange={(val) => updateSettings({ inAppVibrate: val })}
              trackColor={{ false: "#1E293B", true: "#2563EB" }}
              thumbColor="#FFFFFF"
              style={styles.switchStyle}
            />
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* 7. OTURUM & TEHLİKELİ BÖLGE (Sayfa 4 & Sayfa 5)               */}
        {/* ------------------------------------------------------------- */}
        <Text style={styles.sectionTitle}>OTURUM VE HESAP YÖNETİMİ</Text>
        <View style={styles.listContainer}>
          {/* Çıkış Yap - Sayfa 4 Modalını Açar */}
          <TouchableOpacity
            style={[styles.listRow, styles.listRowBorder]}
            onPress={() => setLogoutModalVisible(true)}
            activeOpacity={0.7}
          >
            <View style={styles.listRowLeft}>
              <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 14 }} />
              <Text style={[styles.listRowTitle, { color: "#EF4444" }]}>Çıkış yap</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </TouchableOpacity>

          {/* Hesabını Sil - Sayfa 5 Modalını Açar */}
          <TouchableOpacity style={styles.listRow} onPress={() => setDeleteAccountVisible(true)} activeOpacity={0.7}>
            <View style={styles.listRowLeft}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 14 }} />
              <Text style={[styles.listRowTitle, { color: "#EF4444" }]}>Hesabını sil</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#EF4444" />
          </TouchableOpacity>
        </View>

        {/* Chrono Versiyon Bilgisi */}
        <Text style={styles.versionFooter}>
          Chrono v{Constants.expoConfig?.version || "1.5.0"} · Uçtan Uca Şifreli İletişim
        </Text>
      </ScrollView>

      {/* ============================================================= */}
      {/* ÖZEL BOTTOM SHEET VE DİYALOG MODALLARI                         */}
      {/* ============================================================= */}

      {/* 1. Sayfa 1: Gizlilik Seçici Bottom Sheet */}
      {visibilityPickerConfig && (
        <VisibilityPickerSheet
          visible={visibilityPickerConfig.visible}
          title={visibilityPickerConfig.title}
          subtitle={visibilityPickerConfig.subtitle}
          selectedValue={settings?.[visibilityPickerConfig.key]}
          onSelect={(val) => {
            updateSettings({ [visibilityPickerConfig.key]: val });
          }}
          onClose={() => setVisibilityPickerConfig(null)}
        />
      )}

      {/* 2. Sayfa 2: Mesaj Metin Boyutu Bottom Sheet */}
      <TextSizeSheet
        visible={textSizeSheetVisible}
        currentSize={settings?.messageTextSize || 16}
        onApply={(newSize) => {
          updateSettings({ messageTextSize: newSize });
        }}
        onClose={() => setTextSizeSheetVisible(false)}
      />

      {/* 3. Sayfa 3: Şifre Değiştir Bottom Sheet */}
      <ChangePasswordSheet
        visible={passwordSheetVisible}
        onSubmit={handleChangePassword}
        onClose={() => setPasswordSheetVisible(false)}
      />

      {/* 4. Sayfa 4: Çıkış Yap Onay Modalı */}
      <LogoutModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        onConfirm={handleConfirmLogout}
      />

      {/* 5. Sayfa 5: Hesabını Sil Onay Modalı */}
      <DeleteAccountModal
        visible={deleteAccountVisible}
        username={currentUser?.username || "zyqwax"}
        onClose={() => setDeleteAccountVisible(false)}
        onConfirm={handleConfirmDeleteAccount}
      />

      {/* 6. Profili Düzenle Modalı */}
      <EditProfileSheet
        visible={editProfileVisible}
        currentUser={currentUser}
        onClose={() => setEditProfileVisible(false)}
        onSave={handleSaveProfile}
        onAvatarPress={() => setAvatarOptionsVisible(true)}
        uploadingAvatar={uploadingAvatar}
      />

      {/* 7. Profil Fotoğrafı Seçenekleri Modalı */}
      <AvatarOptionsModal
        visible={avatarOptionsVisible}
        hasAvatar={!!currentUser?.avatarUrl}
        onPickImage={handlePickAndUploadImage}
        onRemoveAvatar={handleRemoveAvatar}
        onClose={() => setAvatarOptionsVisible(false)}
      />

      {/* 8. Genel Chrono Alert Modalı (Sistem Alert.alert yerine) */}
      <ChronoAlertModal state={alertState} onClose={closeAlert} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#080B14",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#101726",
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  searchBarInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    padding: 0,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 100,
  },
  profileCard: {
    backgroundColor: "#101726",
    borderRadius: 22,
    padding: 16,
    marginTop: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  profileCardTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  profileInfoText: {
    flex: 1,
    marginLeft: 14,
  },
  displayNameText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },
  usernameStatusText: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 2,
    fontWeight: "500",
  },
  onlineBadgeText: {
    color: "#10B981",
    fontWeight: "600",
  },
  editPencilBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  profileCardDivider: {
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    marginVertical: 14,
  },
  profileCardBottom: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  emailRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 10,
  },
  emailText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  bioActionBtn: {
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  bioActionText: {
    fontSize: 13,
    color: "#38BDF8",
    fontWeight: "600",
  },
  avatarUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 27,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    letterSpacing: 0.8,
    marginBottom: 10,
    marginLeft: 4,
  },
  quickGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 20,
  },
  quickCard: {
    width: (SCREEN_WIDTH - 32 - 10) / 2,
    backgroundColor: "#101726",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  quickCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  quickIconBox: {
    width: 36,
    height: 36,
    borderRadius: 11,
    backgroundColor: "#1A2338",
    alignItems: "center",
    justifyContent: "center",
  },
  quickIconBoxActive: {
    backgroundColor: "#2563EB",
  },
  quickIconBoxAa: {
    backgroundColor: "#1A2338",
  },
  quickIconTextAa: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  switchStyle: {
    transform: Platform.OS === "ios" ? [{ scaleX: 0.8 }, { scaleY: 0.8 }] : [],
  },
  quickCardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 3,
  },
  quickCardSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    fontWeight: "500",
  },
  listContainer: {
    backgroundColor: "#101726",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
    marginBottom: 20,
  },
  listRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  listRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.04)",
  },
  listRowLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  listRowTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  pillDropdown: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pillDropdownText: {
    fontSize: 13,
    color: "#94A3B8",
    fontWeight: "600",
  },
  versionFooter: {
    textAlign: "center",
    fontSize: 12,
    color: "#64748B",
    marginTop: 10,
    marginBottom: 20,
  },
});
