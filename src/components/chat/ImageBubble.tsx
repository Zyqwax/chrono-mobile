import React, { memo, useState, useCallback, useEffect } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Message } from "../../types";
import { ChronoProgressRing, ChronoRingStatus } from "../ChronoProgressRing";
import { mediaCacheService } from "../../services/mediaCacheService";
import { localDb } from "../../services/localDb";
import { useChatStore } from "../../store/useChatStore";

interface ImageBubbleProps {
  item: Message;
  isMe: boolean;
  showSenderName?: boolean;
  status: ChronoRingStatus;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onPressImage: (imageUrl: string) => void;
  onLongPress: (item: Message) => void;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export const ImageBubble = memo(function ImageBubble({
  item,
  isMe,
  showSenderName,
  status,
  isSelected = false,
  isSelectionMode = false,
  onPressImage,
  onLongPress,
}: ImageBubbleProps) {
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [cachedUri, setCachedUri] = useState<string | null>(item.localUri || null);

  const isDeleted = !!item.deletedAt;
  const activeImageUri = cachedUri || item.localUri || item.content;

  // Medyayı yerel depoda (Android/media/com.zyqwax.chrono/Chrono/Chrono Images) ara ve yoksa arka planda indir
  useEffect(() => {
    if (item.localUri) {
      setCachedUri(item.localUri);
      return;
    }
    if (!item.content) return;

    let isMounted = true;
    mediaCacheService
      .ensureLocalMedia(item.content, "IMAGE", (downloadedUri) => {
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
    if (activeImageUri) {
      onPressImage(activeImageUri);
    }
  }, [isDeleted, isSelectionMode, activeImageUri, onPressImage]);

  const handleLongPress = useCallback(() => {
    if (isDeleted) return;
    onLongPress(item);
  }, [isDeleted, onLongPress, item]);

  if (isDeleted) {
    return (
      <View style={[styles.container, isMe ? styles.myContainer : styles.otherContainer]}>
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
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
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        disabled={isSelectionMode}
        style={[
          styles.bubble,
          isMe ? styles.myBubble : styles.otherBubble,
          isSelected && styles.selectedBubble,
        ]}
      >
        {showSenderName && (
          <Text style={styles.senderName}>
            {item.sender?.displayName || item.sender?.username || "Kullanıcı"}
          </Text>
        )}

        <View style={styles.imageWrapper}>
          {activeImageUri ? (
            <Image
              source={{ uri: activeImageUri }}
              style={styles.image}
              resizeMode="cover"
              onLoadStart={() => setLoading(true)}
              onLoadEnd={() => setLoading(false)}
              onError={() => {
                setLoading(false);
                setHasError(true);
              }}
            />
          ) : (
            <View style={styles.errorBox}>
              <Ionicons name="image-outline" size={32} color="#64748B" />
              <Text style={styles.errorText}>Görsel yüklenemedi</Text>
            </View>
          )}

          {loading && (
            <View style={styles.loaderOverlay}>
              <ActivityIndicator color="#38BDF8" size="small" />
            </View>
          )}

          {hasError && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={30} color="#EF4444" />
              <Text style={styles.errorText}>Görsel açılamadı</Text>
            </View>
          )}

          {/* Sağ Alt Köşe Zaman Damgası & Okundu Rozeti */}
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
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginVertical: 3,
    paddingHorizontal: 8,
    maxWidth: "80%",
  },
  myContainer: {
    alignSelf: "flex-end",
  },
  otherContainer: {
    alignSelf: "flex-start",
  },
  selectedContainer: {
    backgroundColor: "rgba(37, 99, 235, 0.15)",
    borderRadius: 18,
  },
  bubble: {
    borderRadius: 16,
    padding: 3,
    overflow: "hidden",
  },
  myBubble: {
    backgroundColor: "#1D4ED8",
  },
  otherBubble: {
    backgroundColor: "#1E293B",
  },
  selectedBubble: {
    borderWidth: 1.5,
    borderColor: "#38BDF8",
  },
  senderName: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingTop: 4,
    paddingBottom: 4,
  },
  imageWrapper: {
    width: 240,
    height: 240,
    borderRadius: 13,
    overflow: "hidden",
    backgroundColor: "#0B0F1A",
    position: "relative",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loaderOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(11, 15, 26, 0.6)",
  },
  errorBox: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0F172A",
    gap: 6,
  },
  errorText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
  },
  timeBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 6,
    paddingVertical: 2.5,
    borderRadius: 10,
    gap: 4,
  },
  timeText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
  },
  ringWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  deletedText: {
    fontStyle: "italic",
    color: "#94A3B8",
    padding: 8,
    fontSize: 13,
  },
});
