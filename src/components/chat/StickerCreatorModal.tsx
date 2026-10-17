import React, { memo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { mediaCacheService } from "../../services/mediaCacheService";

interface StickerCreatorModalProps {
  visible: boolean;
  onClose: () => void;
  onStickerCreated: (savedLocalUri: string, sendImmediately: boolean) => void;
}

export const StickerCreatorModal = memo(function StickerCreatorModal({
  visible,
  onClose,
  onStickerCreated,
}: StickerCreatorModalProps) {
  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handlePickFromGallery = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "İzin Gerekli",
          "Çıkartma oluşturmak için galeri erişim izni vermeniz gerekiyor.",
        );
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelectedUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Sticker gallery pick error:", err);
      Alert.alert("Hata", "Görsel seçilirken bir sorun oluştu.");
    }
  };

  const handlePickFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          "İzin Gerekli",
          "Çıkartma çekmek için kamera erişim izni vermeniz gerekiyor.",
        );
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.9,
      });

      if (!result.canceled && result.assets?.[0]?.uri) {
        setSelectedUri(result.assets[0].uri);
      }
    } catch (err) {
      console.warn("Sticker camera pick error:", err);
      Alert.alert("Hata", "Fotoğraf çekilirken bir sorun oluştu.");
    }
  };

  const handleSave = async (sendImmediately: boolean) => {
    if (!selectedUri || isSaving) return;
    setIsSaving(true);
    try {
      const savedUri = await mediaCacheService.saveCustomSticker(selectedUri);
      setSelectedUri(null);
      onStickerCreated(savedUri, sendImmediately);
    } catch (err) {
      Alert.alert("Hata", "Çıkartma kaydedilemedi.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    setSelectedUri(null);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={["bottom"]}>
          {/* Üst Başlık */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIconBadge}>
                <Ionicons name="sparkles" size={18} color="#38BDF8" />
              </View>
              <View>
                <Text style={styles.title}>Çıkartma Stüdyosu</Text>
                <Text style={styles.subtitle}>
                  Kendi WhatsApp tarzı çıkartmanızı oluşturun
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          {/* Önizleme Alanı */}
          <View style={styles.previewArea}>
            <View style={styles.checkerboardCard}>
              {selectedUri ? (
                <Image
                  source={{ uri: selectedUri }}
                  style={styles.previewSticker}
                  resizeMode="contain"
                />
              ) : (
                <View style={styles.emptyPreview}>
                  <Ionicons name="images-outline" size={48} color="#475569" />
                  <Text style={styles.emptyPreviewTitle}>
                    Görsel Seçin veya Fotoğraf Çekin
                  </Text>
                  <Text style={styles.emptyPreviewHint}>
                    Seçtiğiniz görsel 1:1 kare çıkartma formatında kırpılıp
                    Chrono Stickers önbelleğinize kaydedilir.
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Kaynak Seçim Butonları */}
          <View style={styles.sourceButtonsRow}>
            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={handlePickFromGallery}
              activeOpacity={0.8}
            >
              <Ionicons name="images" size={20} color="#38BDF8" />
              <Text style={styles.sourceBtnText}>Galeriden Seç</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.sourceBtn}
              onPress={handlePickFromCamera}
              activeOpacity={0.8}
            >
              <Ionicons name="camera" size={20} color="#10B981" />
              <Text style={styles.sourceBtnText}>Kamera ile Çek</Text>
            </TouchableOpacity>
          </View>

          {/* Kaydet & Gönder Aksiyonları */}
          {selectedUri && (
            <View style={styles.actionButtonsRow}>
              <TouchableOpacity
                style={styles.saveOnlyBtn}
                onPress={() => handleSave(false)}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                <Ionicons name="bookmark-outline" size={19} color="#F8FAFC" />
                <Text style={styles.saveOnlyBtnText}>Paketime Kaydet</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveAndSendBtn}
                onPress={() => handleSave(true)}
                disabled={isSaving}
                activeOpacity={0.85}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <Ionicons name="send" size={18} color="#FFFFFF" />
                    <Text style={styles.saveAndSendBtnText}>
                      Kaydet ve Gönder
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 17, 0.78)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#0B0F1A",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.18)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  headerIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
  },
  subtitle: {
    color: "#94A3B8",
    fontSize: 12,
    marginTop: 1,
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  previewArea: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  checkerboardCard: {
    width: 220,
    height: 220,
    borderRadius: 24,
    backgroundColor: "#131B2E",
    borderWidth: 1.5,
    borderColor: "rgba(56, 189, 248, 0.25)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
  },
  previewSticker: {
    width: "100%",
    height: "100%",
    borderRadius: 16,
  },
  emptyPreview: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  emptyPreviewTitle: {
    color: "#E2E8F0",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 10,
  },
  emptyPreviewHint: {
    color: "#64748B",
    fontSize: 11,
    textAlign: "center",
    marginTop: 6,
    lineHeight: 15,
  },
  sourceButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  sourceBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#131B2E",
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sourceBtnText: {
    color: "#F1F5F9",
    fontSize: 14,
    fontWeight: "600",
  },
  actionButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 14,
  },
  saveOnlyBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#1E293B",
    paddingVertical: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
  },
  saveOnlyBtnText: {
    color: "#F8FAFC",
    fontSize: 14,
    fontWeight: "700",
  },
  saveAndSendBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#2563EB",
    paddingVertical: 14,
    borderRadius: 16,
  },
  saveAndSendBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
