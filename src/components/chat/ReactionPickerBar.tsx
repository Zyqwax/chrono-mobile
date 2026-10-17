import React, { memo, useState } from "react";
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🔥"];

const EXTENDED_REACTIONS = [
  "👍", "❤️", "😂", "😮", "😢", "🙏", "🔥", "🎉",
  "👏", "💯", "🥰", "😍", "🤔", "🤯", "🥳", "😎",
  "🤩", "😭", "😡", "🫡", "🤝", "⚡", "🚀", "💎",
  "✨", "💔", "🙌", "👀", "💀", "🫶", "✅", "❌",
];

interface ReactionPickerBarProps {
  selectedEmoji?: string | null;
  onSelectEmoji: (emoji: string) => void;
}

export const ReactionPickerBar = memo(function ReactionPickerBar({
  selectedEmoji,
  onSelectEmoji,
}: ReactionPickerBarProps) {
  const [moreVisible, setMoreVisible] = useState(false);

  return (
    <>
      <View style={styles.barWrapper}>
        <View style={styles.barContainer}>
          {QUICK_REACTIONS.map((emoji) => {
            const isSelected = selectedEmoji === emoji;
            return (
              <TouchableOpacity
                key={emoji}
                activeOpacity={0.7}
                onPress={() => onSelectEmoji(emoji)}
                style={[styles.emojiButton, isSelected && styles.emojiButtonSelected]}
              >
                <Text style={styles.emojiText}>{emoji}</Text>
              </TouchableOpacity>
            );
          })}

          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setMoreVisible(true)}
            style={styles.moreButton}
          >
            <Ionicons name="add" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={moreVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreVisible(false)}>
          <View style={styles.modalBackdrop}>
            <TouchableWithoutFeedback>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Tepki Seçin</Text>
                  <TouchableOpacity
                    onPress={() => setMoreVisible(false)}
                    style={styles.closeBtn}
                  >
                    <Ionicons name="close" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>

                <ScrollView
                  contentContainerStyle={styles.emojiGrid}
                  showsVerticalScrollIndicator={false}
                >
                  {EXTENDED_REACTIONS.map((emoji) => {
                    const isSelected = selectedEmoji === emoji;
                    return (
                      <TouchableOpacity
                        key={emoji}
                        activeOpacity={0.7}
                        onPress={() => {
                          setMoreVisible(false);
                          onSelectEmoji(emoji);
                        }}
                        style={[
                          styles.gridEmojiBtn,
                          isSelected && styles.emojiButtonSelected,
                        ]}
                      >
                        <Text style={styles.gridEmojiText}>{emoji}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  barWrapper: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "transparent",
  },
  barContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141D2E",
    borderRadius: 28,
    paddingHorizontal: 10,
    paddingVertical: 6,
    gap: 4,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.22)",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 8,
    elevation: 8,
  },
  emojiButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiButtonSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.35)",
    borderWidth: 1,
    borderColor: "#38BDF8",
  },
  emojiText: {
    fontSize: 22,
  },
  moreButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 2,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(5, 8, 17, 0.68)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalSheet: {
    width: "100%",
    maxWidth: 360,
    backgroundColor: "#101726",
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  modalTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 8,
  },
  gridEmojiBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.04)",
  },
  gridEmojiText: {
    fontSize: 24,
  },
});
