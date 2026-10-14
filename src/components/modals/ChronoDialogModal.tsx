import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export interface ChronoDialogModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  variant?: "danger" | "primary" | "success" | "warning";
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  loading?: boolean;
  confirmDisabled?: boolean;
  children?: React.ReactNode;
}

export const ChronoDialogModal: React.FC<ChronoDialogModalProps> = ({
  visible,
  onClose,
  title,
  description,
  icon,
  variant = "primary",
  confirmText,
  cancelText = "Vazgeç",
  onConfirm,
  loading = false,
  confirmDisabled = false,
  children,
}) => {
  const isDanger = variant === "danger";
  const isSuccess = variant === "success";

  const getIconContainerStyle = () => {
    if (isDanger) return styles.iconContainerDanger;
    if (isSuccess) return styles.iconContainerSuccess;
    return styles.iconContainerPrimary;
  };

  const getIconColor = () => {
    if (isDanger) return "#EF4444";
    if (isSuccess) return "#10B981";
    return "#38BDF8";
  };

  const getConfirmBtnStyle = () => {
    if (isDanger) return styles.confirmBtnDanger;
    if (isSuccess) return styles.confirmBtnSuccess;
    return styles.confirmBtnPrimary;
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              {/* Üst İkon Rozeti */}
              {icon && (
                <View style={[styles.iconContainer, getIconContainerStyle()]}>
                  <Ionicons name={icon} size={28} color={getIconColor()} />
                </View>
              )}

              {/* Başlık ve Açıklama */}
              <Text style={styles.title}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}

              {/* Ekstra İçerik (input vb.) */}
              {children && <View style={styles.childrenWrapper}>{children}</View>}

              {/* Aksiyon Butonları */}
              {confirmText && (
                <TouchableOpacity
                  style={[
                    styles.confirmBtn,
                    getConfirmBtnStyle(),
                    confirmDisabled && styles.confirmBtnDisabled,
                  ]}
                  onPress={onConfirm}
                  disabled={confirmDisabled || loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.confirmBtnText}>{confirmText}</Text>
                  )}
                </TouchableOpacity>
              )}

              {cancelText && (
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={onClose}
                  disabled={loading}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelBtnText}>{cancelText}</Text>
                </TouchableOpacity>
              )}
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
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 350,
    backgroundColor: "#101726",
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 18,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 12,
  },
  iconContainer: {
    width: 58,
    height: 58,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    borderWidth: 1,
  },
  iconContainerDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.12)",
    borderColor: "rgba(239, 68, 68, 0.28)",
  },
  iconContainerPrimary: {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    borderColor: "rgba(56, 189, 248, 0.3)",
  },
  iconContainerSuccess: {
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 14,
    color: "#94A3B8",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 18,
  },
  childrenWrapper: {
    width: "100%",
    marginBottom: 16,
  },
  confirmBtn: {
    width: "100%",
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 4,
  },
  confirmBtnDanger: {
    backgroundColor: "#EF4444",
  },
  confirmBtnPrimary: {
    backgroundColor: "#2563EB",
  },
  confirmBtnSuccess: {
    backgroundColor: "#10B981",
  },
  confirmBtnDisabled: {
    opacity: 0.45,
  },
  confirmBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 6,
  },
  cancelBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "600",
  },
});
