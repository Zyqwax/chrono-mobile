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
import { Message } from "../../types";

interface MessageActionsModalProps {
  visible: boolean;
  message: Message | null;
  isMe: boolean;
  onClose: () => void;
  onReply: (message: Message) => void;
  onEdit: (message: Message) => void;
  onDelete: (messageId: string) => void;
}

export const MessageActionsModal: React.FC<MessageActionsModalProps> = ({
  visible,
  message,
  isMe,
  onClose,
  onReply,
  onEdit,
  onDelete,
}) => {
  if (!message) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <Text style={styles.title}>Mesaj Seçenekleri</Text>

              {/* Mesaj Önizlemesi */}
              <View style={styles.previewBox}>
                <Text
                  style={[styles.previewText, message.deletedAt ? { fontStyle: "italic", opacity: 0.7 } : null]}
                  numberOfLines={2}
                >
                  {message.deletedAt ? "Bu mesaj silindi" : message.content || "Medya mesajı"}
                </Text>
              </View>

              <View style={styles.optionsList}>
                {/* Yanıtla (Silinmiş mesajlar yanıtlanamaz) */}
                {!message.deletedAt && (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      onClose();
                      onReply(message);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="arrow-undo-outline" size={20} color="#38BDF8" style={{ marginRight: 12 }} />
                    <Text style={styles.optionText}>Yanıtla</Text>
                  </TouchableOpacity>
                )}

                {/* Düzenle (Yalnızca kendi metin mesajı ise) */}
                {isMe && message.type === "TEXT" && !message.deletedAt && (
                  <TouchableOpacity
                    style={styles.optionRow}
                    onPress={() => {
                      onClose();
                      onEdit(message);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="pencil-outline" size={20} color="#38BDF8" style={{ marginRight: 12 }} />
                    <Text style={styles.optionText}>Düzenle</Text>
                  </TouchableOpacity>
                )}

                {/* Sil (Yalnızca kendi mesajı ise) */}
                {isMe && !message.deletedAt && (
                  <TouchableOpacity
                    style={[styles.optionRow, styles.optionRowDanger]}
                    onPress={() => {
                      onClose();
                      onDelete(message.id);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" style={{ marginRight: 12 }} />
                    <Text style={[styles.optionText, { color: "#EF4444" }]}>Sil</Text>
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  card: {
    width: "100%",
    maxWidth: 330,
    backgroundColor: "#101726",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 12,
  },
  previewBox: {
    backgroundColor: "#0B0F1A",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  previewText: {
    color: "#94A3B8",
    fontSize: 13,
    lineHeight: 18,
  },
  optionsList: {
    gap: 6,
    marginBottom: 10,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.03)",
  },
  optionRowDanger: {
    backgroundColor: "rgba(239, 68, 68, 0.08)",
  },
  optionText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
});
