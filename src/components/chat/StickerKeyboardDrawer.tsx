import React, { memo, useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { mediaCacheService } from "../../services/mediaCacheService";

interface StickerKeyboardDrawerProps {
  visible: boolean;
  isUploadingSticker?: boolean;
  onSelectEmoji: (emoji: string) => void;
  onBackspaceEmoji: () => void;
  onSendSticker: (uri: string) => void;
  onOpenCreator: () => void;
  refreshTrigger?: number;
}

type DrawerTab = "STICKERS" | "EMOJI";

// Yerleşik yüksek çözünürlüklü şeffaf PNG çıkartma paketi (ilk kullanımda otomatik Chrono Stickers'a önbelleklenir)
const BUILTIN_STICKERS = [
  { id: "fire", label: "Ateş", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.png" },
  { id: "heart", label: "Kalp", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.png" },
  { id: "joy", label: "Kahkaha", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.png" },
  { id: "star_eyes", label: "Harika", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f929/512.png" },
  { id: "party", label: "Kutlama", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f973/512.png" },
  { id: "cool", label: "Havalı", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.png" },
  { id: "rocket", label: "Roket", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f680/512.png" },
  { id: "hundred", label: "Yüzde Yüz", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f4af/512.png" },
  { id: "thumbsup", label: "Tamam", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.png" },
  { id: "clap", label: "Alkış", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44f/512.png" },
  { id: "mindblown", label: "Şok", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f92f/512.png" },
  { id: "cry", label: "Üzgün", url: "https://fonts.gstatic.com/s/e/notoemoji/latest/1f62d/512.png" },
];

const EMOJI_LIST = [
  "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
  "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
  "😘", "😗", "😙", "😚", "😋", "😛", "😝", "😜",
  "🤪", "🤨", "🧐", "🤓", "😎", "🥸", "🤩", "🥳",
  "😏", "😒", "😞", "😔", "😟", "😕", "🙁", "☹️",
  "😣", "😖", "😫", "😩", "🥺", "😢", "😭", "😤",
  "😠", "😡", "🤬", "🤯", "😳", "🥵", "🥶", "😱",
  "😨", "😰", "😥", "😓", "🤗", "🤔", "🤭", "🤫",
  "👍", "👎", "👊", "✊", "🤛", "🤜", "🤞", "✌️",
  "🤟", "🤘", "👌", "🤌", "🤏", "👈", "👉", "👆",
  "👇", "☝️", "✋", "🤚", "🖐️", "🖖", "👋", "🤙",
  "💪", "🙏", "🤝", "👏", "🙌", "👐", "🤲", "🫶",
  "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
  "💔", "❣️", "💕", "💞", "💓", "💗", "💖", "💘",
  "🔥", "✨", "🌟", "💫", "💥", "💢", "💦", "💨",
  "🎉", "🎊", "🎈", "🎂", "🎁", "🏆", "🥇", "🚀",
];

export const StickerKeyboardDrawer = memo(function StickerKeyboardDrawer({
  visible,
  isUploadingSticker = false,
  onSelectEmoji,
  onBackspaceEmoji,
  onSendSticker,
  onOpenCreator,
  refreshTrigger = 0,
}: StickerKeyboardDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("STICKERS");
  const [savedStickers, setSavedStickers] = useState<string[]>([]);
  const [loadingStickers, setLoadingStickers] = useState(false);

  const loadMyStickers = useCallback(async () => {
    setLoadingStickers(true);
    try {
      const list = await mediaCacheService.getSavedStickers();
      setSavedStickers(list);
    } finally {
      setLoadingStickers(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      void loadMyStickers();
    }
  }, [visible, refreshTrigger, loadMyStickers]);

  const handleLongPressCustomSticker = useCallback(
    (uri: string) => {
      Alert.alert(
        "Çıkartmayı Sil",
        "Bu çıkartmayı kişisel paketinizden silmek istiyor musunuz?",
        [
          { text: "İptal", style: "cancel" },
          {
            text: "Sil",
            style: "destructive",
            onPress: async () => {
              await mediaCacheService.deleteSavedSticker(uri);
              void loadMyStickers();
            },
          },
        ],
      );
    },
    [loadMyStickers],
  );

  if (!visible) return null;

  return (
    <View style={styles.drawerContainer}>
      {/* Üst Sekme Çubuğu (Çıkartmalar / Emojiler / + Yeni Çıkartma) */}
      <View style={styles.topBar}>
        <View style={styles.tabsRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "STICKERS" && styles.tabBtnActive]}
            onPress={() => setActiveTab("STICKERS")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="sparkles-outline"
              size={16}
              color={activeTab === "STICKERS" ? "#38BDF8" : "#94A3B8"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "STICKERS" && styles.tabBtnTextActive,
              ]}
            >
              Çıkartmalar
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "EMOJI" && styles.tabBtnActive]}
            onPress={() => setActiveTab("EMOJI")}
            activeOpacity={0.8}
          >
            <Ionicons
              name="happy-outline"
              size={17}
              color={activeTab === "EMOJI" ? "#38BDF8" : "#94A3B8"}
            />
            <Text
              style={[
                styles.tabBtnText,
                activeTab === "EMOJI" && styles.tabBtnTextActive,
              ]}
            >
              Emojiler
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "STICKERS" ? (
          <TouchableOpacity
            style={styles.createStickerBtn}
            onPress={onOpenCreator}
            activeOpacity={0.8}
          >
            <Ionicons name="add-circle" size={17} color="#FFFFFF" />
            <Text style={styles.createStickerBtnText}>Çıkartma Yap</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.backspaceBtn}
            onPress={onBackspaceEmoji}
            activeOpacity={0.7}
          >
            <Ionicons name="backspace-outline" size={20} color="#CBD5E1" />
          </TouchableOpacity>
        )}
      </View>

      {isUploadingSticker && (
        <View style={styles.uploadingBanner}>
          <ActivityIndicator size="small" color="#38BDF8" />
          <Text style={styles.uploadingBannerText}>Çıkartma gönderiliyor...</Text>
        </View>
      )}

      {/* İçerik Alanı */}
      {activeTab === "STICKERS" ? (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Kullanıcının Kendi Ürettiği Çıkartmalar */}
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>KENDİ ÇIKARTMALARIM</Text>
            {savedStickers.length > 0 && (
              <Text style={styles.sectionHint}>Silmek için basılı tutun</Text>
            )}
          </View>

          <View style={styles.stickerGrid}>
            {/* Hızlı Yeni Çıkartma Oluştur Kartı */}
            <TouchableOpacity
              style={styles.addStickerCard}
              onPress={onOpenCreator}
              activeOpacity={0.75}
            >
              <View style={styles.addStickerIconCircle}>
                <Ionicons name="add" size={26} color="#38BDF8" />
              </View>
              <Text style={styles.addStickerLabel}>Yeni Üret</Text>
            </TouchableOpacity>

            {loadingStickers ? (
              <View style={styles.loadingBox}>
                <ActivityIndicator size="small" color="#38BDF8" />
              </View>
            ) : (
              savedStickers.map((uri) => (
                <TouchableOpacity
                  key={uri}
                  style={styles.stickerCell}
                  onPress={() => onSendSticker(uri)}
                  onLongPress={() => handleLongPressCustomSticker(uri)}
                  delayLongPress={350}
                  disabled={isUploadingSticker}
                  activeOpacity={0.75}
                >
                  <Image
                    source={{ uri }}
                    style={styles.stickerThumb}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              ))
            )}
          </View>

          {/* Chrono Hazır Çıkartma Paketi */}
          <View style={[styles.sectionHeaderRow, { marginTop: 14 }]}>
            <Text style={styles.sectionTitle}>CHRONO PAKETİ</Text>
          </View>

          <View style={styles.stickerGrid}>
            {BUILTIN_STICKERS.map((st) => (
              <TouchableOpacity
                key={st.id}
                style={styles.stickerCell}
                onPress={() => onSendSticker(st.url)}
                disabled={isUploadingSticker}
                activeOpacity={0.75}
              >
                <Image
                  source={{ uri: st.url }}
                  style={styles.stickerThumb}
                  resizeMode="contain"
                />
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={styles.emojiGrid}
          showsVerticalScrollIndicator={false}
        >
          {EMOJI_LIST.map((emoji) => (
            <TouchableOpacity
              key={emoji}
              style={styles.emojiCell}
              onPress={() => onSelectEmoji(emoji)}
              activeOpacity={0.7}
            >
              <Text style={styles.emojiChar}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  drawerContainer: {
    height: 290,
    backgroundColor: "#0B0F1A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.07)",
  },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#101726",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  tabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "transparent",
  },
  tabBtnActive: {
    backgroundColor: "rgba(56, 189, 248, 0.14)",
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.28)",
  },
  tabBtnText: {
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
  },
  tabBtnTextActive: {
    color: "#38BDF8",
    fontWeight: "700",
  },
  createStickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  createStickerBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  backspaceBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.06)",
  },
  uploadingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 5,
    backgroundColor: "rgba(37, 99, 235, 0.18)",
  },
  uploadingBannerText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
  },
  scrollContent: {
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 24,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    color: "#64748B",
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  sectionHint: {
    color: "#475569",
    fontSize: 11,
  },
  stickerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  addStickerCard: {
    width: "22.5%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "#131B2E",
    borderWidth: 1.2,
    borderColor: "rgba(56, 189, 248, 0.3)",
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addStickerIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  addStickerLabel: {
    color: "#38BDF8",
    fontSize: 10,
    fontWeight: "700",
  },
  stickerCell: {
    width: "22.5%",
    aspectRatio: 1,
    borderRadius: 16,
    backgroundColor: "rgba(19, 27, 46, 0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 6,
  },
  stickerThumb: {
    width: "100%",
    height: "100%",
  },
  loadingBox: {
    width: 72,
    height: 72,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  emojiCell: {
    width: "12.5%",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  emojiChar: {
    fontSize: 26,
  },
});
