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

interface AttachmentSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelectCamera: () => void;
  onSelectGallery: () => void;
}

export const AttachmentSheet: React.FC<AttachmentSheetProps> = ({
  visible,
  onClose,
  onSelectCamera,
  onSelectGallery,
}) => {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.handleBar} />
              <Text style={styles.title}>Medya Ekle</Text>

              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    onClose();
                    onSelectCamera();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconCircle, { backgroundColor: "rgba(56, 189, 248, 0.15)" }]}>
                    <Ionicons name="camera" size={26} color="#38BDF8" />
                  </View>
                  <Text style={styles.optionLabel}>Kamera</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => {
                    onClose();
                    onSelectGallery();
                  }}
                  activeOpacity={0.75}
                >
                  <View style={[styles.iconCircle, { backgroundColor: "rgba(37, 99, 235, 0.15)" }]}>
                    <Ionicons name="images" size={26} color="#3B82F6" />
                  </View>
                  <Text style={styles.optionLabel}>Galeri</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
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
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
  },
  card: {
    backgroundColor: "#101726",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    alignItems: "center",
  },
  handleBar: {
    width: 36,
    height: 4,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 2,
    marginBottom: 16,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "700",
    marginBottom: 20,
  },
  optionsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 36,
    marginBottom: 24,
  },
  optionItem: {
    alignItems: "center",
    gap: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  optionLabel: {
    color: "#E2E8F0",
    fontSize: 13,
    fontWeight: "600",
  },
  cancelBtn: {
    width: "100%",
    paddingVertical: 14,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    borderRadius: 14,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#94A3B8",
    fontSize: 15,
    fontWeight: "600",
  },
});
