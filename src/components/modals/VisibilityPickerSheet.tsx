import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Visibility } from "../../types";

export interface VisibilityOption {
  value: Visibility;
  title: string;
  subtitle: string;
}

const DEFAULT_OPTIONS: VisibilityOption[] = [
  {
    value: "EVERYONE",
    title: "Herkes",
    subtitle: "Tüm Chrono kullanıcıları",
  },
  {
    value: "CONTACTS",
    title: "Kişilerim",
    subtitle: "Sadece kişi listendekiler",
  },
  {
    value: "NOBODY",
    title: "Hiçkimse",
    subtitle: "Kimse göremez",
  },
];

interface VisibilityPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  selectedValue?: Visibility;
  onSelect: (val: Visibility) => void;
}

export const VisibilityPickerSheet: React.FC<VisibilityPickerSheetProps> = ({
  visible,
  onClose,
  title,
  subtitle = "Durumunu kimlerin görebileceğini seç.",
  selectedValue = "EVERYONE",
  onSelect,
}) => {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Tutamaç Çizgisi */}
              <View style={styles.handleBar} />

              {/* Üst Başlık & Kapat Butonu */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{title}</Text>
                  {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Seçenek Listesi */}
              <View style={styles.optionsList}>
                {DEFAULT_OPTIONS.map((opt) => {
                  const isSelected = selectedValue === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={[styles.optionCard, isSelected && styles.optionCardSelected]}
                      onPress={() => {
                        onSelect(opt.value);
                        onClose();
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={styles.optionTextContainer}>
                        <Text style={[styles.optionTitle, isSelected && styles.optionTitleSelected]}>
                          {opt.title}
                        </Text>
                        <Text style={styles.optionSubtitle}>{opt.subtitle}</Text>
                      </View>

                      {/* Radyo / Seçim Rozeti */}
                      {isSelected ? (
                        <View style={styles.radioSelected}>
                          <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                        </View>
                      ) : (
                        <View style={styles.radioUnselected} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Alt Bilgilendirme Notu */}
              <View style={styles.footerNoteRow}>
                <Ionicons name="lock-closed" size={13} color="#64748B" style={{ marginTop: 2, marginRight: 8 }} />
                <Text style={styles.footerNoteText}>
                  Aynı seçici arama ve oda daveti ayarlarında da kullanılır.
                </Text>
              </View>
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
    marginBottom: 20,
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
  optionsList: {
    gap: 10,
    marginBottom: 20,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#0B0F1A",
    borderRadius: 18,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  optionCardSelected: {
    borderColor: "#2563EB",
    backgroundColor: "rgba(37, 99, 235, 0.08)",
  },
  optionTextContainer: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#E2E8F0",
    marginBottom: 2,
  },
  optionTitleSelected: {
    color: "#FFFFFF",
  },
  optionSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
  },
  radioSelected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  radioUnselected: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#334155",
    marginLeft: 12,
  },
  footerNoteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 4,
  },
  footerNoteText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 18,
    flex: 1,
  },
});
