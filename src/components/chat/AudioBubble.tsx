import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { Message, MessageReaction } from "../../types";
import { ChronoProgressRing, ChronoRingStatus } from "../ChronoProgressRing";
import { mediaCacheService } from "../../services/mediaCacheService";
import { localDb } from "../../services/localDb";
import { useChatStore } from "../../store/useChatStore";
import { ReactionPills } from "./ReactionPills";

interface AudioBubbleProps {
  item: Message;
  isMe: boolean;
  currentUserId?: string;
  showSenderName?: boolean;
  status: ChronoRingStatus;
  isSelected?: boolean;
  isSelectionMode?: boolean;
  onLongPress: (item: Message) => void;
  onToggleReaction?: (messageId: string, emoji: string) => void;
  onOpenReactionDetail?: (messageId: string, reactions: MessageReaction[]) => void;
}

function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s < 10 ? "0" : ""}${s}`;
}

function formatTime(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// Mesaj ID'sinden deterministik dalga formu çubuk yükseklikleri üret
function generateWaveformHeights(seedStr: string, count = 26): number[] {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const heights: number[] = [];
  for (let i = 0; i < count; i++) {
    const pseudoRandom = Math.abs(Math.sin(hash + i * 997)) * 100;
    // 5px ile 26px arasında yükseklik
    heights.push(Math.max(5, Math.min(26, Math.round(5 + (pseudoRandom % 22)))));
  }
  return heights;
}

export const AudioBubble = memo(function AudioBubble({
  item,
  isMe,
  currentUserId,
  showSenderName,
  status,
  isSelected = false,
  isSelectionMode = false,
  onLongPress,
  onToggleReaction,
  onOpenReactionDetail,
}: AudioBubbleProps) {
  const isDeleted = !!item.deletedAt;
  const [cachedUri, setCachedUri] = useState<string | null>(item.localUri || null);
  const audioUri = cachedUri || item.localUri || item.content;

  // Ses dosyasını yerel depoda (Android/media/com.zyqwax.chrono/Chrono/Chrono Voice) ara ve yoksa arka planda indir
  useEffect(() => {
    if (item.localUri) {
      setCachedUri(item.localUri);
      return;
    }
    if (!item.content) return;

    let isMounted = true;
    mediaCacheService
      .ensureLocalMedia(item.content, "AUDIO", (downloadedUri) => {
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

  const player = useAudioPlayer(audioUri || null);
  const playerStatus = useAudioPlayerStatus(player);

  const isPlaying = playerStatus?.playing ?? false;
  const isBuffering = playerStatus?.isBuffering ?? false;
  const currentTime = playerStatus?.currentTime ?? 0;
  const duration = playerStatus?.duration ?? 0;

  const waveformHeights = useMemo(
    () => generateWaveformHeights(item.id || "audio"),
    [item.id]
  );

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  const activeBarsCount = Math.round(progress * waveformHeights.length);

  const handlePlayPause = useCallback(() => {
    if (isSelectionMode || isDeleted || !player) return;
    if (isPlaying) {
      player.pause();
    } else {
      // Eğer sona ulaşıldıysa baştan oynat
      if (duration > 0 && currentTime >= duration - 0.3) {
        player.seekTo(0);
      }
      player.play();
    }
  }, [isSelectionMode, isDeleted, player, isPlaying, duration, currentTime]);

  const handleBarPress = useCallback(
    (index: number) => {
      if (!player || duration <= 0) return;
      const targetSec = (index / waveformHeights.length) * duration;
      player.seekTo(targetSec);
      if (!isPlaying) {
        player.play();
      }
    },
    [player, duration, waveformHeights.length, isPlaying]
  );

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
        activeOpacity={0.95}
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

        <View style={styles.mainRow}>
          {/* Oynat / Duraklat Butonu */}
          <TouchableOpacity
            style={[styles.playBtn, isMe ? styles.myPlayBtn : styles.otherPlayBtn]}
            onPress={handlePlayPause}
            activeOpacity={0.8}
          >
            {isBuffering ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons
                name={isPlaying ? "pause" : "play"}
                size={18}
                color="#FFFFFF"
                style={!isPlaying ? { marginLeft: 2 } : undefined}
              />
            )}
          </TouchableOpacity>

          {/* Dalga Formu Çubukları & Süre */}
          <View style={styles.waveformContainer}>
            <View style={styles.waveformBarsRow}>
              {waveformHeights.map((h, index) => {
                const isActive = index <= activeBarsCount;
                return (
                  <TouchableOpacity
                    key={index}
                    activeOpacity={0.7}
                    onPress={() => handleBarPress(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 1, right: 1 }}
                    style={styles.barTouch}
                  >
                    <View
                      style={[
                        styles.waveBar,
                        { height: h },
                        isActive
                          ? isMe
                            ? styles.activeBarMy
                            : styles.activeBarOther
                          : styles.inactiveBar,
                      ]}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Süre & Alt Satır */}
            <View style={styles.footerRow}>
              <Text style={styles.durationText}>
                {isPlaying ? formatDuration(currentTime) : formatDuration(duration || 0)}
              </Text>

              <View style={styles.metaRow}>
                <Text style={styles.timeText}>{formatTime(item.createdAt)}</Text>
                {isMe && (
                  <View style={styles.ringWrapper}>
                    <ChronoProgressRing status={status} size={11} />
                  </View>
                )}
              </View>
            </View>
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
    marginVertical: 3,
    paddingHorizontal: 8,
    maxWidth: "82%",
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
    padding: 10,
    minWidth: 230,
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
    marginBottom: 6,
  },
  mainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  playBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  myPlayBtn: {
    backgroundColor: "#2563EB",
  },
  otherPlayBtn: {
    backgroundColor: "#334155",
  },
  waveformContainer: {
    flex: 1,
    justifyContent: "center",
  },
  waveformBarsRow: {
    flexDirection: "row",
    alignItems: "center",
    height: 28,
    gap: 2.2,
  },
  barTouch: {
    height: 28,
    justifyContent: "center",
  },
  waveBar: {
    width: 2.6,
    borderRadius: 1.5,
  },
  activeBarMy: {
    backgroundColor: "#FFFFFF",
  },
  activeBarOther: {
    backgroundColor: "#38BDF8",
  },
  inactiveBar: {
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  durationText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 11,
    fontWeight: "500",
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timeText: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 10.5,
  },
  ringWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  deletedText: {
    fontStyle: "italic",
    color: "#94A3B8",
    padding: 6,
    fontSize: 13,
  },
});
