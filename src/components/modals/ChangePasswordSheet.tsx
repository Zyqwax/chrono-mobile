import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface ChangePasswordSheetProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (currentPass: string, newPass: string) => Promise<void>;
}

export const ChangePasswordSheet: React.FC<ChangePasswordSheetProps> = ({
  visible,
  onClose,
  onSubmit,
}) => {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleUpdate = async () => {
    setError(null);
    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Lütfen tüm alanları doldurun.");
      return;
    }
    if (newPassword.length < 6) {
      setError("Yeni şifre en az 6 karakter olmalıdır.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Yeni şifreler birbiriyle eşleşmiyor.");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(currentPassword, newPassword);
      handleClose();
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Şifre güncellenemedi.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Tutamaç */}
              <View style={styles.handleBar} />

              {/* Üst Başlık */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Şifre değiştir</Text>
                  <Text style={styles.subtitle}>Hesabını korumak için yeni bir şifre belirle.</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={handleClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Hata Mesajı */}
              {error && (
                <View style={styles.errorBox}>
                  <Ionicons name="alert-circle" size={16} color="#EF4444" style={{ marginRight: 6 }} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              {/* Form Alanları */}
              <View style={styles.formContainer}>
                {/* 1. Mevcut Şifre */}
                <View style={styles.inputCard}>
                  <View style={styles.iconBox}>
                    <Ionicons name="lock-closed-outline" size={18} color="#38BDF8" />
                  </View>
                  <View style={styles.inputBody}>
                    <Text style={styles.inputLabel}>Mevcut şifre</Text>
                    <TextInput
                      style={styles.textInput}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor="#475569"
                    />
                  </View>
                </View>

                {/* 2. Yeni Şifre (Aktif Mavi Kenarlık) */}
                <View style={[styles.inputCard, styles.inputCardActive]}>
                  <View style={styles.iconBox}>
                    <Ionicons name="key-outline" size={18} color="#38BDF8" />
                  </View>
                  <View style={styles.inputBody}>
                    <Text style={styles.inputLabel}>Yeni şifre</Text>
                    <TextInput
                      style={styles.textInput}
                      value={newPassword}
                      onChangeText={setNewPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor="#475569"
                    />
                  </View>
                </View>

                {/* Bilgilendirme Notu */}
                <Text style={styles.helperText}>
                  En az 6 karakter. Güçlü bir şifre için harf, rakam ve sembol karıştır.
                </Text>

                {/* 3. Yeni Şifre (Tekrar) */}
                <View style={styles.inputCard}>
                  <View style={styles.iconBox}>
                    <Ionicons name="key-outline" size={18} color="#38BDF8" />
                  </View>
                  <View style={styles.inputBody}>
                    <Text style={styles.inputLabel}>Yeni şifre (tekrar)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry
                      placeholder="••••••••"
                      placeholderTextColor="#475569"
                    />
                  </View>
                </View>
              </View>

              {/* Şifreyi Güncelle Butonu */}
              <TouchableOpacity
                style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
                onPress={handleUpdate}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Text style={styles.submitBtnText}>Şifreyi Güncelle</Text>
                    <View style={styles.checkIconBadge}>
                      <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                    </View>
                  </>
                )}
              </TouchableOpacity>
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
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
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
    marginBottom: 24,
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
  helperText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
    paddingHorizontal: 4,
    marginTop: -4,
    marginBottom: 2,
  },
  submitBtn: {
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
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
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
