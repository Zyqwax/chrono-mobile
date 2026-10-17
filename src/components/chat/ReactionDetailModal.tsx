import React, { memo } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { MessageReaction } from "../../types";
import { ChronoAvatar } from "../ChronoAvatar";

interface ReactionDetailModalProps {
  visible: boolean;
  reactions: MessageReaction[] | null;
  currentUserId?: string;
  onClose: () => void;
  onRemoveMyReaction?: (emoji: string) => void;
}

export const ReactionDetailModal = memo(function ReactionDetailModal({
  visible,
  reactions,
  currentUserId,
  onClose,
  onRemoveMyReaction,
}: ReactionDetailModalProps) {
  if (!visible || !reactions) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop}>
          <TouchableWithoutFeedback>
            <View style={styles.sheet}>
              <View style={styles.header}>
                <Text style={styles.title}>
                  Tepkiler ({reactions.length})
                </Text>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <FlatList
                data={reactions}
                keyExtractor={(item, idx) => item.id || `${item.userId}_${idx}`}
                style={{ maxHeight: 320 }}
                renderItem={({ item }) => {
                  const isMe = !!currentUserId && item.userId === currentUserId;
                  const displayName = isMe
                    ? "Sen"
                    : item.user?.displayName || item.user?.username || "Kullanıcı";

                  return (
                    <TouchableOpacity
                      activeOpacity={isMe ? 0.7 : 1}
                      onPress={() => {
                        if (isMe && onRemoveMyReaction) {
                          onRemoveMyReaction(item.emoji);
                          onClose();
                        }
                      }}
                      style={styles.row}
                    >
                      <ChronoAvatar
                        size={38}
                        uri={item.user?.avatarUrl}
                        name={displayName}
                        style={{ marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{displayName}</Text>
                        {isMe && (
                          <Text style={styles.tapToRemove}>
                            Kaldırmak için dokunun
                          </Text>
                        )}
                      </View>
                      <Text style={styles.emoji}>{item.emoji}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 17, 0.72)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#101726",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  userName: {
    color: "#F1F5F9",
    fontSize: 15,
    fontWeight: "600",
  },
  tapToRemove: {
    color: "#38BDF8",
    fontSize: 12,
    marginTop: 2,
  },
  emoji: {
    fontSize: 24,
    marginLeft: 10,
  },
});
