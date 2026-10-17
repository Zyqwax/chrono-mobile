import React, { memo, useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { MessageReaction } from "../../types";

interface ReactionPillsProps {
  reactions?: MessageReaction[];
  currentUserId?: string;
  isMe: boolean;
  onToggleReaction: (emoji: string) => void;
  onOpenDetail?: (reactions: MessageReaction[]) => void;
}

interface GroupedReaction {
  emoji: string;
  count: number;
  hasMe: boolean;
}

export const ReactionPills = memo(function ReactionPills({
  reactions,
  currentUserId,
  isMe,
  onToggleReaction,
  onOpenDetail,
}: ReactionPillsProps) {
  const grouped = useMemo(() => {
    if (!reactions || reactions.length === 0) return [];
    const map = new Map<string, GroupedReaction>();
    for (const r of reactions) {
      if (!r?.emoji) continue;
      const existing = map.get(r.emoji);
      const isMine = !!currentUserId && r.userId === currentUserId;
      if (existing) {
        existing.count += 1;
        if (isMine) existing.hasMe = true;
      } else {
        map.set(r.emoji, {
          emoji: r.emoji,
          count: 1,
          hasMe: isMine,
        });
      }
    }
    return Array.from(map.values());
  }, [reactions, currentUserId]);

  if (grouped.length === 0) return null;

  return (
    <View style={[styles.container, isMe ? styles.myContainer : styles.otherContainer]}>
      {grouped.map((g) => (
        <TouchableOpacity
          key={g.emoji}
          activeOpacity={0.75}
          onPress={() => onToggleReaction(g.emoji)}
          onLongPress={() => {
            if (onOpenDetail && reactions) {
              onOpenDetail(reactions);
            }
          }}
          delayLongPress={300}
          style={[styles.pill, g.hasMe && styles.activePill]}
        >
          <Text style={styles.emojiText}>{g.emoji}</Text>
          {g.count > 1 && (
            <Text style={[styles.countText, g.hasMe && styles.activeCountText]}>
              {g.count}
            </Text>
          )}
        </TouchableOpacity>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 4,
    marginTop: -6,
    marginBottom: 2,
    zIndex: 5,
  },
  myContainer: {
    justifyContent: "flex-end",
    alignSelf: "flex-end",
    marginRight: 6,
  },
  otherContainer: {
    justifyContent: "flex-start",
    alignSelf: "flex-start",
    marginLeft: 6,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#141D2E",
    borderWidth: 1.2,
    borderColor: "rgba(255, 255, 255, 0.14)",
    borderRadius: 14,
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    gap: 3,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
    elevation: 2,
  },
  activePill: {
    backgroundColor: "#1E3A8A",
    borderColor: "#38BDF8",
  },
  emojiText: {
    fontSize: 13,
  },
  countText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#CBD5E1",
  },
  activeCountText: {
    color: "#38BDF8",
  },
});
