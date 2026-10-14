import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ChronoAvatar } from "../ChronoAvatar";
import { User } from "../../types";

interface EditProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  currentUser: User | null;
  onSave: (data: { displayName: string; username: string; bio: string }) => Promise<void>;
  onAvatarPress: () => void;
  uploadingAvatar?: boolean;
}

export const EditProfileSheet: React.FC<EditProfileSheetProps> = ({
  visible,
  onClose,
  currentUser,
  onSave,
  onAvatarPress,
  uploadingAvatar = false,
}) => {
  const [displayName, setDisplayName] = useState(currentUser?.displayName || "");
  const [username, setUsername] = useState(currentUser?.username || "");
  const [bio, setBio] = useState(currentUser?.bio || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (visible && currentUser) {
      setDisplayName(currentUser.displayName || "");
      setUsername(currentUser.username || "");
      setBio(currentUser.bio || "");
      setError(null);
    }
  }, [visible, currentUser]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      setError("Görünen isim boş bırakılamaz.");
      return;
    }
    if (!username.trim()) {
      setError("Kullanıcı adı boş bırakılamaz.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await onSave({
        displayName: displayName.trim(),
        username: username.trim(),
        bio: bio.trim(),
      });
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Profil güncellenemedi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              <View style={styles.handleBar} />

              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Profili Düzenle</Text>
                  <Text style={styles.subtitle}>Hesap bilgilerini ve biyografini güncelle.</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {error && (
                  <View style={styles.errorBox}>
                    <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                    <Text style={styles.errorText}>{error}</Text>
                  </View>
                )}

                {/* Avatar Seçim Alanı */}
                <View style={styles.avatarSection}>
                  <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.8} style={styles.avatarWrapper}>
                    <ChronoAvatar
                      size={88}
                      name={displayName || currentUser?.displayName || "User"}
                      uri={currentUser?.avatarUrl}
                      badge="camera"
                    />
                    {uploadingAvatar && (
                      <View style={styles.avatarUploadingOverlay}>
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      </View>
                    )}
                  </TouchableOpacity>
                  <TouchableOpacity onPress={onAvatarPress} activeOpacity={0.7} style={{ marginTop: 10 }}>
                    <Text style={styles.changePhotoText}>Fotoğrafı değiştir</Text>
                  </TouchableOpacity>
                </View>

                {/* Form Alanları */}
                <View style={styles.formContainer}>
                  {/* Görünen Ad */}
                  <View style={styles.inputCard}>
                    <View style={styles.iconBox}>
                      <Ionicons name="person-outline" size={18} color="#38BDF8" />
                    </View>
                    <View style={styles.inputBody}>
                      <Text style={styles.inputLabel}>Görünen ad</Text>
                      <TextInput
                        style={styles.textInput}
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Adınız Soyadınız"
                        placeholderTextColor="#475569"
                      />
                    </View>
                  </View>

                  {/* Kullanıcı Adı */}
                  <View style={[styles.inputCard, styles.inputCardActive]}>
                    <View style={styles.iconBox}>
                      <Text style={styles.atText}>@</Text>
                    </View>
                    <View style={styles.inputBody}>
                      <Text style={styles.inputLabel}>Kullanıcı adı</Text>
                      <TextInput
                        style={styles.textInput}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="kullanici_adi"
                        placeholderTextColor="#475569"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>

                  {/* Biyografi */}
                  <View style={[styles.inputCard, styles.bioCard]}>
                    <Text style={styles.inputLabel}>Hakkında (Bio)</Text>
                    <TextInput
                      style={styles.bioTextInput}
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Kendinden kısaca bahset..."
                      placeholderTextColor="#475569"
                      multiline
                      maxLength={140}
                    />
                    <Text style={styles.bioCounter}>{bio.length}/140</Text>
                  </View>
                </View>

                {/* Kaydet Butonu */}
                <TouchableOpacity
                  style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving}
                  activeOpacity={0.85}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <>
                      <Text style={styles.saveBtnText}>Kaydet</Text>
                      <View style={styles.checkIconBadge}>
                        <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#101726",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    maxHeight: "90%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#334155",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A2338",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  avatarSection: {
    alignItems: "center",
    marginVertical: 12,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatarUploadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 44,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  changePhotoText: {
    color: "#38BDF8",
    fontSize: 14,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.25)",
  },
  errorText: {
    color: "#EF4444",
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  formContainer: {
    gap: 12,
    marginBottom: 20,
  },
  inputCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  inputCardActive: {
    borderColor: "#2563EB",
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "rgba(37, 99, 235, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  atText: {
    color: "#38BDF8",
    fontSize: 18,
    fontWeight: "700",
  },
  inputBody: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#94A3B8",
    marginBottom: 2,
  },
  textInput: {
    fontSize: 16,
    color: "#FFFFFF",
    fontWeight: "600",
    padding: 0,
    height: 24,
  },
  bioCard: {
    flexDirection: "column",
    alignItems: "stretch",
    paddingVertical: 12,
  },
  bioTextInput: {
    color: "#FFFFFF",
    fontSize: 15,
    marginTop: 6,
    minHeight: 54,
    textAlignVertical: "top",
  },
  bioCounter: {
    alignSelf: "flex-end",
    color: "#64748B",
    fontSize: 11,
    marginTop: 4,
  },
  saveBtn: {
    backgroundColor: "#2563EB",
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
    marginTop: 6,
    marginBottom: 10,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  checkIconBadge: {
    position: "absolute",
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
});
