import React, { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message, MessageReaction } from "../../types";
import { ChronoProgressRing, ChronoRingStatus } from "../ChronoProgressRing";
import { mediaCacheService } from "../../services/mediaCacheService";
import { localDb } from "../../services/localDb";
import { useChatStore } from "../../store/useChatStore";
import { ReactionPills } from "./ReactionPills";

interface StickerBubbleProps {
  item: Message;
  isMe: boolean;
  currentUserId?: string;
  showSenderName?: boolean;
  status: ChronoRingStatus;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onPressSticker?: (stickerUrl: string) => void;
  onLongPress: (item: Message) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onOpenReactionDetail?: (messageId: string, reactions: MessageReaction[]) => void;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export const StickerBubble = memo(function StickerBubble({
  item,
  isMe,
  currentUserId,
  showSenderName,
  status,
  isSelected = false,
  isSelectionMode = false,
  onPressSticker,
  onLongPress,
  onToggleReaction,
  onOpenReactionDetail,
}: StickerBubbleProps) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(item.localUri || null);

  const isDeleted = !!item.deletedAt;
  const activeStickerUri = cachedUri || item.localUri || item.content;

  // Çıkartmayı yerel depoda (Android/media/com.zyqwax.chrono/Chrono/Chrono Stickers) ara ve yoksa arka planda indir
  useEffect(() => {
    if (item.localUri) {
      setCachedUri(item.localUri);
      return;
    }
    if (!item.content) return;

    let isMounted = true;
    mediaCacheService
      .ensureLocalMedia(item.content, "STICKER", (downloadedUri) => {
        if (isMounted) {
          setCachedUri(downloadedUri);
          void localDb.updateMessageLocalUri(item.id, downloadedUri);
          useChatStore.getState().updateMessageLocalUri(item.roomId, item.id, downloadedUri);
        }
      })
      .then((uri) => {
        if (isMounted && uri && uri.startsWith("file://")) {
          setCachedUri(uri);
          void localDb.updateMessageLocalUri(item.id, uri);
          useChatStore.getState().updateMessageLocalUri(item.roomId, item.id, uri);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [item.id, item.content, item.localUri, item.roomId]);

  const handlePress = useCallback(() => {
    if (isDeleted || isSelectionMode) return;
    if (activeStickerUri && onPressSticker) {
      onPressSticker(activeStickerUri);
    }
  }, [isDeleted, isSelectionMode, activeStickerUri, onPressSticker]);

  const handleLongPress = useCallback(() => {
    if (isDeleted) return;
    onLongPress(item);
  }, [isDeleted, onLongPress, item]);

  if (isDeleted) {
    return (
      <View style={[styles.container, isMe ? styles.myContainer : styles.otherContainer]}>
        <View style={[styles.deletedBubble, isMe ? styles.myDeletedBubble : styles.otherDeletedBubble]}>
          <Text style={styles.deletedText}>Bu mesaj silindi</Text>
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.container,
        isMe ? styles.myContainer : styles.otherContainer,
        isSelected && styles.selectedContainer,
      ]}
    >
      {showSenderName && (
        <View style={styles.senderPill}>
          <Text style={styles.senderName}>
            {item.sender?.displayName || item.sender?.username || "Kullanıcı"}
          </Text>
        </View>
      )}

      {item.replyTo && (
        <View style={[styles.replyBadge, isMe ? styles.myReplyBadge : styles.otherReplyBadge]}>
          <Text style={styles.replySender}>
            {item.replyTo.sender?.displayName || "Kullanıcı"}
          </Text>
          <Text style={styles.replyText} numberOfLines={1}>
            {item.replyTo.deletedAt
              ? "Bu mesaj silindi"
              : item.replyTo.type === "STICKER"
                ? "💟 Çıkartma"
                : item.replyTo.type === "IMAGE"
                  ? "📷 Fotoğraf"
                  : item.replyTo.type === "AUDIO"
                    ? "🎤 Sesli mesaj"
                    : item.replyTo.content || "Mesaj"}
          </Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.88}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        disabled={isSelectionMode}
        style={[styles.stickerTouch, isSelected && styles.selectedStickerTouch]}
      >
        <View style={styles.stickerWrapper}>
          {activeStickerUri ? (
            <Image
              source={{ uri: activeStickerUri }}
              style={styles.stickerImage}
              resizeMode="contain"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
          ) : (
            <View style={styles.errorBox}>
              <Ionicons name="sparkles-outline" size={30} color="#64748B" />
              <Text style={styles.errorText}>Çıkartma yüklenemedi</Text>
            </View>
          )}

          {loading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator color="#38BDF8" size="small" />
            </View>
          )}

          {hasError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={28} color="#EF4444" />
              <Text style={styles.errorText}>Çıkartma açılamadı</Text>
            </View>
          )}

          {/* Sağ Alt Köşe Yüzen Zaman Damgası & Chrono Halkası */}
          <View style={styles.timeBadge}>
            <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
            {isMe && (
              <View style={styles.ringWrapper}>
                <ChronoProgressRing status={status} size={11} />
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>

      <ReactionPills
        reactions={item.reactions}
        currentUserId={currentUserId}
        isMe={isMe}
        onToggleReaction={(emoji) => onToggleReaction?.(item.id, emoji)}
        onOpenDetail={(reactions) => onOpenReactionDetail?.(item.id, reactions)}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 4,
    paddingHorizontal: 8,
    maxWidth: "75%",
  },
  myContainer: {
    alignSelf: "flex-end",
    alignItems: "flex-end",
  },
  otherContainer: {
    alignSelf: "flex-start",
    alignItems: "flex-start",
  },
  selectedContainer: {
    backgroundColor: "rgba(37, 99, 235, 0.14)",
    borderRadius: 18,
    padding: 4,
  },
  senderPill: {
    backgroundColor: "rgba(19, 27, 46, 0.85)",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginBottom: 4,
  },
  senderName: {
    color: "#38BDF8",
    fontSize: 11,
    fontWeight: "700",
  },
  replyBadge: {
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
    backgroundColor: "rgba(19, 27, 46, 0.88)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 4,
    maxWidth: 160,
  },
  myReplyBadge: {
    alignSelf: "flex-end",
  },
  otherReplyBadge: {
    alignSelf: "flex-start",
  },
  replySender: {
    fontSize: 10,
    fontWeight: "700",
    color: "#38BDF8",
  },
  replyText: {
    fontSize: 11,
    color: "#CBD5E1",
  },
  stickerTouch: {
    borderRadius: 16,
  },
  selectedStickerTouch: {
    borderWidth: 1.5,
    borderColor: "#38BDF8",
  },
  stickerWrapper: {
    width: 152,
    height: 152,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  stickerImage: {
    width: 146,
    height: 146,
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  errorBox: {
    width: 140,
    height: 140,
    borderRadius: 16,
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  errorText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
    textAlign: "center",
  },
  timeBadge: {
    position: "absolute",
    bottom: 4,
    right: 4,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 26, 0.72)",
    paddingHorizontal: 7,
    paddingVertical: 2.5,
    borderRadius: 10,
    gap: 4,
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  ringWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  deletedBubble: {
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  myDeletedBubble: {
    backgroundColor: "#2563EB",
  },
  otherDeletedBubble: {
    backgroundColor: "#131B2E",
  },
  deletedText: {
    color: "#94A3B8",
    fontSize: 14,
    fontStyle: "italic",
  },
});
