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

interface AvatarOptionsModalProps {
  visible: boolean;
  onClose: () => void;
  hasAvatar: boolean;
  onPickImage: () => void;
  onRemoveAvatar: () => void;
}

export const AvatarOptionsModal: React.FC<AvatarOptionsModalProps> = ({
  visible,
  onClose,
  hasAvatar,
  onPickImage,
  onRemoveAvatar,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.iconCircle}>
                <Ionicons name="camera-outline" size={26} color="#38BDF8" />
              </View>
              <Text style={styles.title}>Profil Fotoğrafı</Text>
              <Text style={styles.subtitle}>Yeni bir fotoğraf yükle veya mevcut olanı kaldır.</Text>

              <View style={styles.btnGroup}>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => {
                    onClose();
                    onPickImage();
                  }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="image-outline" size={20} color="#38BDF8" style={{ marginRight: 10 }} />
                  <Text style={styles.actionBtnText}>Galeriden Fotoğraf Seç</Text>
                </TouchableOpacity>

                {hasAvatar && (
                  <TouchableOpacity
                    style={[styles.actionBtn, styles.actionBtnDanger]}
                    onPress={() => {
                      onClose();
                      onRemoveAvatar();
                    }}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="trash-outline" size={19} color="#EF4444" style={{ marginRight: 10 }} />
                    <Text style={[styles.actionBtnText, { color: "#EF4444" }]}>Fotoğrafı Kaldır</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.cancelBtnText}>Vazgeç</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#101726",
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  iconCircle: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
  },
  title: {
    fontSize: 19,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    textAlign: "center",
    marginBottom: 18,
    lineHeight: 18,
  },
  btnGroup: {
    width: "100%",
    gap: 10,
    marginBottom: 10,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0F1A",
    borderRadius: 16,
    height: 48,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  actionBtnDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
    borderColor: "rgba(239, 68, 68, 0.22)",
  },
  actionBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
  cancelBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "600",
  },
});
