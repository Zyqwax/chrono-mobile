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
import { formatChatDay, formatTime } from "../../utils/format";

interface MessageInfoModalProps {
  visible: boolean;
  message: Message | null;
  isMe: boolean;
  isRead: boolean;
  readAt?: string | null;
  onClose: () => void;
}

export const MessageInfoModal: React.FC<MessageInfoModalProps> = ({
  visible,
  message,
  isMe,
  isRead,
  readAt,
  onClose,
}) => {
  if (!message) return null;

  const dateStr = formatChatDay(message.createdAt);
  const timeStr = formatTime(message.createdAt);
  const isPending = !!message.isPending;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.card}>
              <View style={styles.header}>
                <Ionicons name="information-circle-outline" size={24} color="#38BDF8" />
                <Text style={styles.title}>Mesaj Detayları</Text>
              </View>

              {/* Mesaj Önizlemesi */}
              <View style={styles.previewBox}>
                <Text style={styles.previewText} numberOfLines={3}>
                  {message.deletedAt
                    ? "🚫 Bu mesaj silindi"
                    : message.content || (message.ciphertext ? "🔒 Şifreli Mesaj" : "Medya")}
                </Text>
              </View>

              <View style={styles.infoList}>
                {/* Gönderen */}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons name="person-outline" size={16} color="#94A3B8" />
                  </View>
                  <View style={styles.infoTextCol}>
                    <Text style={styles.infoLabel}>Gönderen</Text>
                    <Text style={styles.infoValue}>
                      {isMe
                        ? "Siz"
                        : message.sender?.displayName || message.sender?.username || "Kullanıcı"}
                    </Text>
                  </View>
                </View>

                {/* Gönderilme Zamanı */}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons name="time-outline" size={16} color="#94A3B8" />
                  </View>
                  <View style={styles.infoTextCol}>
                    <Text style={styles.infoLabel}>Gönderildi</Text>
                    <Text style={styles.infoValue}>
                      {dateStr} • {timeStr}
                    </Text>
                  </View>
                </View>

                {/* Okunma Durumu */}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons
                      name={isRead ? "checkmark-done" : isPending ? "hourglass-outline" : "checkmark"}
                      size={16}
                      color={isRead ? "#38BDF8" : isPending ? "#F59E0B" : "#94A3B8"}
                    />
                  </View>
                  <View style={styles.infoTextCol}>
                    <Text style={styles.infoLabel}>Durum</Text>
                    <Text style={[styles.infoValue, isRead && { color: "#38BDF8" }]}>
                      {isPending
                        ? "Gönderiliyor..."
                        : isRead
                          ? `Okundu ${readAt ? `(${formatTime(readAt)})` : ""}`
                          : "İletildi"}
                    </Text>
                  </View>
                </View>

                {/* Güvenlik & Şifreleme */}
                <View style={styles.infoRow}>
                  <View style={styles.infoIconBox}>
                    <Ionicons name="shield-checkmark-outline" size={16} color="#10B981" />
                  </View>
                  <View style={styles.infoTextCol}>
                    <Text style={styles.infoLabel}>Güvenlik</Text>
                    <Text style={[styles.infoValue, { color: "#10B981" }]}>
                      Uçtan Uca Şifreli (X25519)
                    </Text>
                  </View>
                </View>
              </View>

              <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.closeBtnText}>Kapat</Text>
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
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  previewBox: {
    backgroundColor: "#0B0F1A",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  previewText: {
    color: "#CBD5E1",
    fontSize: 13,
    lineHeight: 18,
  },
  infoList: {
    gap: 12,
    marginBottom: 20,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  infoIconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: "rgba(255, 255, 255, 0.04)",
    alignItems: "center",
    justifyContent: "center",
  },
  infoTextCol: {
    flex: 1,
  },
  infoLabel: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFFFFF",
    marginTop: 1,
  },
  closeBtn: {
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingVertical: 12,
    borderRadius: 14,
    alignItems: "center",
  },
  closeBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
