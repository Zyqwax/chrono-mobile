import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  LayoutAnimation,
  PanResponder,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { GiftedChat, IMessage, Message as GiftedChatMessage } from "react-native-gifted-chat";
import { Message, Room } from "../types";
import { useChatStore } from "../store/useChatStore";
import { notificationService } from "../services/notifications";
import { RoomInfoModal } from "./RoomInfoModal";
import { VoiceRoomSheet } from "./VoiceRoomSheet";
import { ChronoAvatar } from "./ChronoAvatar";
import { ChronoProgressRing, ChronoRingStatus } from "./ChronoProgressRing";
import { chronoTheme } from "../theme/colors";
import { useShallow } from "zustand/react/shallow";
import { requestCallPermissions } from "../services/permissions";
import { CallConfirmModal } from "./modals/CallConfirmModal";
import { MessageActionsModal } from "./modals/MessageActionsModal";

const CHAT_BACKGROUND = require("../../assets/chrono-chat-background.png");
const EMPTY_MESSAGES: Message[] = [];
import { formatTime, formatChatDay, formatCallDuration, formatLastSeen, getTranslation } from "../utils/format";

const isSameCalendarDay = (d1?: Date | string | number | null, d2?: Date | string | number | null) => {
  if (!d1 || !d2) return false;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { colors } = chronoTheme;

interface ChatRoomScreenProps {
  room: Room;
  onBack: () => void;
}

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ room, onBack }) => {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState("");
  const textInputRef = useRef<TextInput>(null);
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [voiceSheetVisible, setVoiceSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Yanıtlama & Düzenleme state'leri
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [callModalConfig, setCallModalConfig] = useState<{ visible: boolean; isVideo: boolean } | null>(null);
  const [selectedMessageForAction, setSelectedMessageForAction] = useState<Message | null>(null);

  const handleSwipeReply = useCallback((item: Message) => {
    setReplyMessage(item);
    setTimeout(() => {
      textInputRef.current?.focus();
    }, 60);
  }, []);

  // Donanım geri tuşuna basıldığında mesaj yanıtlama veya düzenleme modundan çık
  useEffect(() => {
    if (!replyMessage && !editingMessage) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (replyMessage) setReplyMessage(null);
      if (editingMessage) {
        setEditingMessage(null);
        setInputText("");
      }
      return true;
    });
    return () => sub.remove();
  }, [replyMessage, editingMessage]);

  // Sığ (shallow) seçici: yalnızca bu ekranın kullandığı aksiyonlar ve profil değişince render olur
  const {
    currentUserId,
    currentUserName,
    currentUserAvatar,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
    markAsRead,
    typingUsers,
    sendTyping,
    activeVoiceRoomId,
    joinRoomVoice,
    startCall,
    activeVoiceCount,
  } = useChatStore(
    useShallow((s) => ({
      currentUserId: s.currentUser?.id,
      currentUserName: s.currentUser?.displayName,
      currentUserAvatar: s.currentUser?.avatarUrl,
      fetchMessages: s.fetchMessages,
      sendMessage: s.sendMessage,
      editMessage: s.editMessage,
      deleteMessage: s.deleteMessage,
      markAsRead: s.markAsRead,
      typingUsers: s.typingUsers,
      sendTyping: s.sendTyping,
      activeVoiceRoomId: s.activeVoiceRoomId,
      joinRoomVoice: s.joinRoomVoice,
      startCall: s.startCall,
      activeVoiceCount: s.roomVoiceStates?.[room.id]?.count ?? 0,
    })),
  );

  // Bu odaya ait mesaj havuzu:
  // Doğrudan oda anahtarına abone olur; yarış durumlarından (race condition) etkilenmez
  const roomMsgs = useChatStore((s) => s.roomMessages[room.id]);
  const activeMsgs = useChatStore((s) => s.messages);
  const activeRoomId = useChatStore((s) => s.activeRoom?.id);

  // Karşı tarafın odayı son okuduğu tarih (anlık soket 'messages_read' ile güncellenir)
  const settings = useChatStore((s) => s.settings);
  const currentRoom =
    useChatStore(
      (s) => s.rooms.find((r) => r.id === room.id) || (s.activeRoom?.id === room.id ? s.activeRoom : null),
    ) || room;
  const currentPeer = currentRoom.peer || room.peer;

  const isDirect = currentRoom.type === "DIRECT";
  const chatTitle = isDirect
    ? currentPeer?.displayName || currentPeer?.username || "Kullanıcı"
    : currentRoom.name || "Sohbet Odası";

  const myOnlineVisible = (settings?.lastSeenVisibility ?? "EVERYONE") !== "NOBODY";
  const isPeerOnline = isDirect && myOnlineVisible && currentPeer?.status === "ONLINE";

  // Karşılıklı (reciprocal) kural: Ben son görülmemi kapattıysam veya karşı taraf kapattıysa
  // son görülme zamanı gizlenir ("son görülme yakınlarda" / "last seen recently" gösterilir)
  const peerStatus = myOnlineVisible ? currentPeer?.status : "HIDDEN";
  const peerLastSeen = myOnlineVisible ? currentPeer?.lastSeenAt : null;
  const peerStatusInfo = formatLastSeen(peerStatus, peerLastSeen);

  const myReadReceipts = settings?.readReceipts ?? true;
  // Oda sohbetlerinde okundu bilgisi kapatma geçerli olmaz; direkt (DM) sohbetlerde kapatan ne gönderir ne alır
  const canShowReadReceipt = !isDirect || myReadReceipts;

  const currentOthersReadAt = useChatStore((s) => {
    const storeRoom = s.rooms.find((r) => r.id === room.id) || (s.activeRoom?.id === room.id ? s.activeRoom : null);
    if (storeRoom && storeRoom.othersReadAt !== undefined) {
      return storeRoom.othersReadAt;
    }
    return room.othersReadAt ?? null;
  });

  const effectiveOthersReadAt = canShowReadReceipt ? currentOthersReadAt : null;

  // Odaya girildiğinde okundu bilgisini sunucuya bildir
  useEffect(() => {
    markAsRead(room.id);
  }, [room.id, markAsRead]);

  const messages = useMemo(() => {
    if (roomMsgs && roomMsgs.length > 0) return roomMsgs;
    if (activeRoomId === room.id && activeMsgs && activeMsgs.length > 0) return activeMsgs;
    return roomMsgs || activeMsgs || EMPTY_MESSAGES;
  }, [roomMsgs, activeMsgs, activeRoomId, room.id]);

  // Yeni mesaj geldiğinde (başkasına aitse) okundu bilgisini gönder
  useEffect(() => {
    if (messages.length > 0) {
      const latest = messages[0];
      if (latest && latest.senderId !== currentUserId) {
        markAsRead(room.id);
      }
    }
  }, [messages.length, room.id, currentUserId, markAsRead]);

  const loadChat = useCallback(
    async (isRetry = false) => {
      // Eğer önbellekte zaten bu odaya ait mesajlar varsa tam ekran spinner açma (arka plan sessiz yenilemesi)
      const cachedCount = useChatStore.getState().roomMessages[room.id]?.length ?? 0;
      if (cachedCount === 0) {
        setLoading(true);
      }
      if (isRetry) setLoadError(false);

      try {
        const success = await fetchMessages(room.id);
        const latestCount = useChatStore.getState().roomMessages[room.id]?.length ?? 0;
        if (!success && latestCount === 0) {
          setLoadError(true);
        }
      } catch {
        const latestCount = useChatStore.getState().roomMessages[room.id]?.length ?? 0;
        if (latestCount === 0) {
          setLoadError(true);
        }
      } finally {
        setLoading(false);
      }
    },
    [fetchMessages, room.id],
  );

  useEffect(() => {
    notificationService.clearRoomNotifications(room.id);
    loadChat();
  }, [loadChat, room.id]);

  // "Yazıyor" bildirimi: her tuş vuruşunda socket'e emit etmek yerine
  // bir kez 'true' gönder, 3sn hareketsizlikte 'false' gönder
  const typingActiveRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopTyping = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (typingActiveRef.current) {
      typingActiveRef.current = false;
      sendTyping(room.id, false);
    }
  }, [room.id, sendTyping]);

  useEffect(() => stopTyping, [stopTyping]);

  const handleInputChange = useCallback(
    (text: string) => {
      setInputText(text);
      if (text.length === 0) {
        stopTyping();
        return;
      }
      if (!typingActiveRef.current) {
        typingActiveRef.current = true;
        sendTyping(room.id, true);
      }
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(stopTyping, 3000);
    },
    [room.id, sendTyping, stopTyping],
  );

  const handleSend = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();

    // Girişi hemen temizle: arayüz ağ yanıtını beklemeden tepki verir
    setInputText("");
    stopTyping();

    if (editingMessage) {
      setEditingMessage(null);
      await editMessage(editingMessage.id, text);
    } else {
      const replyId = replyMessage?.id;
      setReplyMessage(null);
      await sendMessage(room.id, text, replyId);
    }
  };

  const handleStartCall = useCallback(async (video = false) => {
    // 1. Önce mikrofon ve kamera izinlerini sor ve doğrula
    const hasPerms = await requestCallPermissions(video);
    if (!hasPerms) return;

    // Özel Chrono Arama Modalı Aç
    setCallModalConfig({ visible: true, isVideo: video });
  }, []);

  const handleVoiceJoin = () => {
    joinRoomVoice(room.id);
    setVoiceSheetVisible(true);
  };

  const handleMessageLongPress = useCallback((item: Message) => {
    setSelectedMessageForAction(item);
  }, []);

  const isVoiceActiveInThisRoom = !isDirect && (activeVoiceCount > 0 || activeVoiceRoomId === room.id);
  const isMeInVoice = activeVoiceRoomId === room.id;

  const giftedMessages = useMemo<IMessage[]>(() => {
    return messages.map((item) => {
      const isSystem = item.type === "SYSTEM";
      const isPending = !!item.isPending;
      const isRead = Boolean(
        canShowReadReceipt &&
        effectiveOthersReadAt &&
        new Date(effectiveOthersReadAt).getTime() >= new Date(item.createdAt).getTime(),
      );
      return {
        _id: item.id,
        text: item.deletedAt ? "🚫 Bu mesaj silindi" : item.content,
        createdAt: new Date(item.createdAt),
        user: {
          _id: item.senderId,
          name: item.sender?.displayName || item.sender?.username || "Kullanıcı",
          avatar: item.sender?.avatarUrl || undefined,
        },
        system: isSystem,
        sent: !isPending,
        received: isRead,
        raw: item,
      } as IMessage & { raw: Message };
    });
  }, [messages, effectiveOthersReadAt, canShowReadReceipt]);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingRoot}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? insets.top : 0}
      >
        {/* ------------------------------------------------------------- */}
        {/* Telegram Style Chat Header                                    */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Room / Peer Info */}
          <TouchableOpacity style={styles.roomHeaderInfo} onPress={() => setInfoModalVisible(true)} activeOpacity={0.8}>
            <ChronoAvatar
              size={38}
              uri={isDirect ? currentPeer?.avatarUrl : currentRoom.iconUrl}
              name={chatTitle}
              emoji={
                !isDirect && (chatTitle.startsWith("🔥") || true)
                  ? chatTitle.match(/^(\p{Emoji})/u)?.[0] || "🔥"
                  : undefined
              }
              online={isDirect && isPeerOnline}
              style={{ marginRight: 10 }}
            />

            <View style={styles.headerTitles}>
              <Text style={styles.roomName} numberOfLines={1}>
                {!isDirect && chatTitle.match(/^(\p{Emoji})/u)
                  ? chatTitle.replace(/^(\p{Emoji})/u, "").trim()
                  : chatTitle}
              </Text>
              <Text style={styles.roomStatus} numberOfLines={1}>
                {typingUsers.length > 0 ? (
                  <Text style={{ color: "#38BDF8" }}>
                    {typingUsers.map((u) => u.displayName).join(", ")} {getTranslation("typing", "yazıyor...")}
                  </Text>
                ) : isDirect ? (
                  isPeerOnline ? (
                    <Text style={{ color: "#10B981" }}>{getTranslation("online", "çevrimiçi")}</Text>
                  ) : (
                    <Text style={{ color: "#94A3B8" }}>{peerStatusInfo.text}</Text>
                  )
                ) : (
                  `${currentRoom.membersCount || currentRoom.members?.length || 2} ${getTranslation("member", "üye")} · ${activeVoiceCount > 0 ? `${activeVoiceCount} ${getTranslation("online", "çevrimiçi")}` : `1 ${getTranslation("online", "çevrimiçi")}`}`
                )}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Header Actions: DM -> Sesli & Görüntülü Arama; Oda -> [Sesli] Butonu + 3 Nokta */}
          <View style={styles.headerActions}>
            {isDirect ? (
              <>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => handleStartCall(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={21} color="#FFFFFF" />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => handleStartCall(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="videocam-outline" size={22} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity
                  style={[styles.headerVoicePillBtn, isVoiceActiveInThisRoom && styles.headerVoicePillActive]}
                  onPress={handleVoiceJoin}
                  activeOpacity={0.8}
                >
                  <Ionicons name="mic" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
                  <Text style={styles.headerVoicePillText}>Sesli</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => setInfoModalVisible(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="ellipsis-vertical" size={20} color="#FFFFFF" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>

        {/* ------------------------------------------------------------- */}
        {/* Mesaj Beslemesi & Gifted Chat Loader                          */}
        {/* ------------------------------------------------------------- */}
        <ImageBackground
          source={CHAT_BACKGROUND}
          style={styles.chatArea}
          imageStyle={styles.chatBackgroundImage}
          resizeMode="cover"
        >
          {loadError && messages.length === 0 ? (
            <View style={styles.giftedLoaderContainer}>
              <View style={styles.emptyFeedIconBg}>
                <Ionicons name="cloud-offline-outline" size={40} color={colors.textSecondary} />
              </View>
              <Text style={styles.emptyFeedTitle}>Sohbet geçmişi yüklenemedi</Text>
              <Text style={styles.emptyFeedText}>Sunucu bağlantısı zaman aşımına uğramış olabilir.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => loadChat(true)} activeOpacity={0.8}>
                <Ionicons name="refresh" size={16} color="#FFFFFF" />
                <Text style={styles.retryBtnText}>Tekrar Dene</Text>
              </TouchableOpacity>
            </View>
          ) : loading && messages.length === 0 ? (
            <View style={styles.giftedLoaderContainer}>
              <ActivityIndicator size="large" color={colors.primaryLight} />
              <Text style={styles.giftedLoaderText}>Mesajlar yükleniyor...</Text>
            </View>
          ) : (
            <MessageFeed
              messages={giftedMessages}
              currentUserId={currentUserId || ""}
              currentUserName={currentUserName || "Kullanıcı"}
              currentUserAvatar={currentUserAvatar || undefined}
              isDirect={isDirect}
              canShowReadReceipt={canShowReadReceipt}
              othersReadAt={effectiveOthersReadAt}
              loading={loading}
              onLongPressMessage={handleMessageLongPress}
              onSwipeReply={handleSwipeReply}
              onCallPress={handleStartCall}
            />
          )}
        </ImageBackground>

        {/* Yanıtlama veya Düzenleme Banner'ı */}
        {(replyMessage || editingMessage) && (
          <View style={styles.actionBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBannerTitle}>
                {editingMessage ? "Mesajı Düzenle" : `Yanıtla: ${replyMessage?.sender?.displayName || "Kullanıcı"}`}
              </Text>
              <Text style={styles.actionBannerText} numberOfLines={1}>
                {editingMessage ? editingMessage.content : replyMessage?.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setReplyMessage(null);
                setEditingMessage(null);
                setInputText("");
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Bottom Input Bar                                              */}
        {/* ------------------------------------------------------------- */}
        <View style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 8) }]}>
          <View style={styles.inputBox}>
            <TouchableOpacity style={styles.inputInnerBtn} activeOpacity={0.7}>
              <Ionicons name="happy-outline" size={24} color="#8A93A8" />
            </TouchableOpacity>

            <TextInput
              ref={textInputRef}
              style={styles.textInput}
              placeholder="Mesaj yaz"
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
            />

            <TouchableOpacity style={styles.inputInnerBtn} activeOpacity={0.7}>
              <Ionicons name="attach" size={24} color="#8A93A8" />
            </TouchableOpacity>
          </View>

          {/* Dinamik Gönder / Mikrofon Butonu */}
          <TouchableOpacity
            style={styles.actionSendBtn}
            onPress={inputText.trim() ? handleSend : !isDirect ? handleVoiceJoin : undefined}
            activeOpacity={0.85}
          >
            <Ionicons
              name={inputText.trim() ? "send" : "mic"}
              size={19}
              color="#FFFFFF"
              style={inputText.trim() ? { marginLeft: 2 } : undefined}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Modals */}
      <RoomInfoModal
        visible={infoModalVisible}
        roomId={room.id}
        onClose={() => setInfoModalVisible(false)}
        onRoomDeletedOrLeft={onBack}
      />

      {!isDirect && (
        <VoiceRoomSheet visible={voiceSheetVisible} roomName={chatTitle} onClose={() => setVoiceSheetVisible(false)} />
      )}

      {/* Özel Sesli / Görüntülü Arama Onay Modalı (Sistem Alert Yerine) */}
      {callModalConfig && (
        <CallConfirmModal
          visible={callModalConfig.visible}
          onClose={() => setCallModalConfig(null)}
          chatTitle={chatTitle}
          isVideo={callModalConfig.isVideo}
          onConfirm={() => {
            const isVideo = callModalConfig.isVideo;
            setCallModalConfig(null);
            startCall(room.id, isVideo);
          }}
        />
      )}

      {/* Özel Mesaj Seçenekleri Modalı (Sistem Alert Yerine) */}
      <MessageActionsModal
        visible={!!selectedMessageForAction}
        message={selectedMessageForAction}
        isMe={selectedMessageForAction?.senderId === currentUserId}
        onClose={() => setSelectedMessageForAction(null)}
        onReply={(msg) => setReplyMessage(msg)}
        onEdit={(msg) => {
          setEditingMessage(msg);
          setInputText(msg.content);
        }}
        onDelete={(msgId) => deleteMessage(msgId)}
      />
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Mesaj beslemesi (memo): input'a yazarken veya klavye açılırken yeniden render olmaz
// ---------------------------------------------------------------------------
const renderFeedLoading = () => null;

const renderChatEmpty = () => (
  <View style={styles.emptyFeed}>
    <View style={styles.emptyFeedIconBg}>
      <Ionicons name="chatbubbles-outline" size={36} color={colors.primaryLight} />
    </View>
    <Text style={styles.emptyFeedTitle}>Henüz mesaj yok</Text>
    <Text style={styles.emptyFeedText}>İlk mesajı göndererek sohbeti başlatın.</Text>
  </View>
);

const renderNoInputToolbar = () => null;
const noop = () => {};

const FEED_LIST_PROPS = {
  keyboardDismissMode: "on-drag",
  keyboardShouldPersistTaps: "handled",
  initialNumToRender: 30,
  maxToRenderPerBatch: 25,
  windowSize: 21,
  removeClippedSubviews: false,
  overScrollMode: "never",
  showsVerticalScrollIndicator: false,
} as const;

interface CallBubbleProps {
  item: Message;
  isMe: boolean;
  isDirect: boolean;
  onCallPress: (video?: boolean) => void;
}

const CallBubble = memo(function CallBubble({ item, isMe, isDirect, onCallPress }: CallBubbleProps) {
  let callData = { video: false, status: "ended", duration: 0 };
  try {
    if (typeof item.content === "string" && item.content.startsWith("{")) {
      callData = JSON.parse(item.content);
    }
  } catch {
    // fallback
  }

  const { video, status, duration } = callData;
  const isIncoming = !isMe;
  const durStr = duration > 0 ? formatCallDuration(duration) : "";
  const timeStr = formatTime(item.createdAt);

  const label = isIncoming
    ? video
      ? getTranslation("incomingVideo", "Gelen görüntülü arama")
      : getTranslation("incomingAudio", "Gelen sesli arama")
    : video
      ? getTranslation("outgoingVideo", "Giden görüntülü arama")
      : getTranslation("outgoingAudio", "Giden sesli arama");

  const text = durStr ? `${label} · ${durStr} · ${timeStr}` : `${label} · ${timeStr}`;

  return (
    <View style={styles.callMessageCenterContainer}>
      <TouchableOpacity
        style={styles.callBubblePill}
        onPress={() => isDirect && onCallPress(video)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={video ? "videocam-outline" : "call-outline"}
          size={15}
          color={video ? "#38BDF8" : "#10B981"}
          style={{ marginRight: 6 }}
        />
        <Text style={styles.callPillText}>{text}</Text>
      </TouchableOpacity>
    </View>
  );
});

interface SystemBubbleProps {
  content: string;
}

const SystemBubble = memo(function SystemBubble({ content }: SystemBubbleProps) {
  let iconName: keyof typeof Ionicons.glyphMap = "information-circle-outline";
  let iconColor = "#94A3B8";

  const lower = content.toLowerCase();
  if (lower.includes("oluşturdu")) {
    iconName = "people-outline";
    iconColor = "#60A5FA";
  } else if (lower.includes("ekledi")) {
    iconName = "person-add-outline";
    iconColor = "#60A5FA";
  } else if (lower.includes("ayrıldı") || lower.includes("çıkarıldı")) {
    iconName = "person-remove-outline";
    iconColor = "#F87171";
  } else if (lower.includes("sesli") || lower.includes("oturum")) {
    iconName = "mic-outline";
    iconColor = "#38BDF8";
  }

  return (
    <View style={styles.systemMessageCenterContainer}>
      <View style={styles.systemBubblePill}>
        <Ionicons name={iconName} size={15} color={iconColor} style={{ marginRight: 6 }} />
        <Text style={styles.systemPillText}>{content}</Text>
      </View>
    </View>
  );
});

interface SwipeableMessageProps {
  children: React.ReactNode;
  onSwipeReply: () => void;
  isMe: boolean;
}

const SwipeableMessage = memo(function SwipeableMessage({
  children,
  onSwipeReply,
}: SwipeableMessageProps) {
  const translateX = useRef(new Animated.Value(0)).current;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          // Yalnızca sola belirgin yatay kaydırma yapıldığında yakala
          return gestureState.dx < -10 && Math.abs(gestureState.dx) > Math.abs(gestureState.dy) * 1.3;
        },
        onPanResponderMove: (_, gestureState) => {
          if (gestureState.dx < 0) {
            // Sola doğru dirençli (rubberband) hareket: en fazla -65px
            const val = Math.max(gestureState.dx, -65);
            translateX.setValue(val);
          }
        },
        onPanResponderRelease: (_, gestureState) => {
          if (gestureState.dx <= -36) {
            onSwipeReply();
          }
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }).start();
        },
        onPanResponderTerminate: () => {
          Animated.spring(translateX, {
            toValue: 0,
            friction: 7,
            tension: 50,
            useNativeDriver: true,
          }).start();
        },
      }),
    [onSwipeReply, translateX],
  );

  const iconOpacity = translateX.interpolate({
    inputRange: [-45, -15, 0],
    outputRange: [1, 0.4, 0],
    extrapolate: "clamp",
  });

  const iconScale = translateX.interpolate({
    inputRange: [-45, -15, 0],
    outputRange: [1, 0.7, 0.3],
    extrapolate: "clamp",
  });

  return (
    <View style={styles.swipeableRowContainer} {...panResponder.panHandlers}>
      {/* Sağ tarafta beliren Telegram tarzı Yanıtla Rozeti */}
      <Animated.View
        style={[
          styles.replyIconWrapper,
          {
            opacity: iconOpacity,
            transform: [{ scale: iconScale }],
          },
        ]}
      >
        <View style={styles.replyIconCircle}>
          <Ionicons name="arrow-undo" size={15} color="#FFFFFF" />
        </View>
      </Animated.View>

      {/* Kaydırılan Baloncuk */}
      <Animated.View style={{ transform: [{ translateX }] }}>
        {children}
      </Animated.View>
    </View>
  );
});

interface TextBubbleProps {
  item: Message;
  isMe: boolean;
  isDirect: boolean;
  showSenderName: boolean;
  status: ChronoRingStatus;
  onLongPress: (item: Message) => void;
  onSwipeReply: (item: Message) => void;
}

const TextBubble = memo(function TextBubble({
  item,
  isMe,
  isDirect,
  showSenderName,
  status,
  onLongPress,
  onSwipeReply,
}: TextBubbleProps) {
  const isDeleted = !!item.deletedAt;
  const contentText = isDeleted ? "🚫 Bu mesaj silindi" : item.content;
  const handleLongPress = useCallback(() => onLongPress(item), [onLongPress, item]);
  const handleSwipeReply = useCallback(() => onSwipeReply(item), [onSwipeReply, item]);

  // Tek satırda zaman + chrono ring ile yan yana sığabilir mi?
  const canBeInline = !item.replyTo && !isDeleted && !item.content.includes("\n") && item.content.trim().length <= 14;

  return (
    <SwipeableMessage onSwipeReply={handleSwipeReply} isMe={isMe}>
      <TouchableOpacity
        style={[styles.messageBubbleContainer, isMe ? styles.myMessageContainer : styles.otherMessageContainer]}
        onLongPress={handleLongPress}
        activeOpacity={0.88}
      >
        <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
          {showSenderName && (
            <Text style={styles.senderName}>{item.sender?.displayName || item.sender?.username || "Kullanıcı"}</Text>
          )}

          {item.replyTo && (
            <View style={styles.replyPreviewInBubble}>
              <Text style={styles.replySenderInBubble}>{item.replyTo.sender?.displayName || "Kullanıcı"}</Text>
              <Text style={styles.replyTextInBubble} numberOfLines={1}>
                {item.replyTo.content || "Silinmiş mesaj"}
              </Text>
            </View>
          )}

          {canBeInline ? (
            <View style={styles.inlineBubbleRow}>
              <Text style={[styles.messageContent, isMe ? styles.myMessageContent : styles.otherMessageContent]}>
                {contentText}
              </Text>
              <View style={styles.inlineMetaRow}>
                {item.editedAt && <Text style={styles.editedTag}>düzenlendi </Text>}
                <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && (
                  <View style={styles.ringWrapper}>
                    <ChronoProgressRing status={status} size={11} />
                  </View>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.stackedBubbleCol}>
              <Text
                style={[
                  styles.messageContent,
                  isMe ? styles.myMessageContent : styles.otherMessageContent,
                  isDeleted && styles.deletedMessageText,
                ]}
              >
                {contentText}
              </Text>
              <View style={styles.stackedMetaRow}>
                {item.editedAt && !isDeleted && <Text style={styles.editedTag}>düzenlendi </Text>}
                <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
                  {formatTime(item.createdAt)}
                </Text>
                {isMe && !isDeleted && (
                  <View style={styles.ringWrapper}>
                    <ChronoProgressRing status={status} size={11} />
                  </View>
                )}
              </View>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </SwipeableMessage>
  );
});

interface MessageFeedProps {
  messages: IMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  isDirect: boolean;
  canShowReadReceipt: boolean;
  othersReadAt?: string | null;
  loading: boolean;
  onLongPressMessage: (item: Message) => void;
  onSwipeReply: (item: Message) => void;
  onCallPress: (video?: boolean) => void;
}

const MessageFeed = memo(function MessageFeed({
  messages,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isDirect,
  canShowReadReceipt,
  othersReadAt,
  loading,
  onLongPressMessage,
  onSwipeReply,
  onCallPress,
}: MessageFeedProps) {
  const user = useMemo(
    () => ({ _id: currentUserId, name: currentUserName, avatar: currentUserAvatar }),
    [currentUserId, currentUserName, currentUserAvatar],
  );

  const renderMessage = useCallback((props: any) => {
    const { key, ...restProps } = props;
    const messageKey = key || props.currentMessage?._id || `msg-${Math.random()}`;
    return <GiftedChatMessage key={messageKey} {...restProps} />;
  }, []);

  const renderDay = useCallback((dayProps: any) => {
    const currentMsg = dayProps.currentMessage;
    const previousMsg = dayProps.previousMessage;
    if (!currentMsg || !currentMsg.createdAt) return null;

    if (previousMsg && previousMsg.createdAt && isSameCalendarDay(currentMsg.createdAt, previousMsg.createdAt)) {
      return null;
    }

    return (
      <View style={styles.daySeparatorContainer}>
        <View style={styles.daySeparatorPill}>
          <Text style={styles.daySeparatorText}>{formatChatDay(currentMsg.createdAt)}</Text>
        </View>
      </View>
    );
  }, []);

  const renderBubble = useCallback(
    (bubbleProps: any) => {
      const currentMsg = bubbleProps.currentMessage as (IMessage & { raw?: Message }) | undefined;
      const item = currentMsg?.raw;
      if (!item) return null;

      const isMe = item.senderId === currentUserId;

      if (item.type === "SYSTEM") {
        return <SystemBubble content={item.content} />;
      }

      if (item.type === "CALL") {
        return <CallBubble item={item} isMe={isMe} isDirect={isDirect} onCallPress={onCallPress} />;
      }

      const previousMsg = bubbleProps.previousMessage as (IMessage & { raw?: Message }) | undefined;
      const isSameSenderAsPrev =
        previousMsg &&
        !previousMsg.system &&
        previousMsg.raw?.type !== "SYSTEM" &&
        previousMsg.raw?.type !== "CALL" &&
        previousMsg.user?._id === item.senderId;

      const showSenderName = !isDirect && !isMe && !isSameSenderAsPrev;

      const isPending = !!item.isPending;
      const isRead = Boolean(
        canShowReadReceipt && othersReadAt && new Date(othersReadAt).getTime() >= new Date(item.createdAt).getTime(),
      );
      const ringStatus: ChronoRingStatus = isPending ? "pending" : isRead ? "read" : "sent";

      return (
        <TextBubble
          item={item}
          isMe={isMe}
          isDirect={isDirect}
          showSenderName={showSenderName}
          status={ringStatus}
          onLongPress={onLongPressMessage}
          onSwipeReply={onSwipeReply}
        />
      );
    },
    [currentUserId, isDirect, canShowReadReceipt, othersReadAt, onLongPressMessage, onSwipeReply, onCallPress],
  );

  return (
    <View style={styles.feedFade}>
      <GiftedChat
        messages={messages}
        user={user}
        loadEarlier={false}
        isLoadingEarlier={loading}
        onLoadEarlier={noop}
        renderLoading={renderFeedLoading}
        renderMessage={renderMessage}
        renderBubble={renderBubble}
        renderDay={renderDay}
        renderAvatar={() => null}
        renderChatEmpty={renderChatEmpty}
        renderInputToolbar={renderNoInputToolbar}
        minInputToolbarHeight={0}
        messagesContainerStyle={styles.messagesList}
        listViewProps={FEED_LIST_PROPS}
      />
    </View>
  );
});

const styles = StyleSheet.create({
  feedFade: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: "#080B14",
  },
  keyboardAvoidingRoot: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: "#0B0F1A",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.05)",
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
  },
  roomHeaderInfo: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    marginLeft: 2,
  },
  headerTitles: {
    flex: 1,
  },
  roomName: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  roomStatus: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "500",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  headerVoicePillBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#2563EB",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 18,
    marginRight: 2,
  },
  headerVoicePillActive: {
    backgroundColor: "#10B981",
  },
  headerVoicePillText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
  chatArea: {
    flex: 1,
    backgroundColor: "#080B14",
  },
  chatBackgroundImage: {
    opacity: 0.55,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  swipeableRowContainer: {
    position: "relative",
    justifyContent: "center",
    width: "100%",
  },
  replyIconWrapper: {
    position: "absolute",
    right: 14,
    zIndex: 0,
    justifyContent: "center",
    alignItems: "center",
  },
  replyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 3,
  },
  messageBubbleContainer: {
    marginVertical: 2,
    maxWidth: "82%",
  },
  myMessageContainer: {
    alignSelf: "flex-end",
  },
  otherMessageContainer: {
    alignSelf: "flex-start",
  },
  bubble: {
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 7,
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 1.5,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: "#2563EB",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: "#131B2E",
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  senderName: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 3,
  },
  inlineBubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "flex-start",
    gap: 8,
  },
  stackedBubbleCol: {
    flexDirection: "column",
  },
  inlineMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto",
    marginBottom: 1,
    paddingLeft: 4,
  },
  stackedMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    marginTop: 4,
    alignSelf: "flex-end",
    gap: 4,
  },
  ringWrapper: {
    justifyContent: "center",
    alignItems: "center",
  },
  messageContent: {
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  myMessageContent: {
    color: "#FFFFFF",
  },
  otherMessageContent: {
    color: "#F1F5F9",
  },
  deletedMessageText: {
    fontStyle: "italic",
    color: "#94A3B8",
  },
  editedTag: {
    fontSize: 10,
    color: "#94A3B8",
    fontStyle: "italic",
  },
  timeText: {
    fontSize: 11,
    fontWeight: "500",
  },
  myTimeText: {
    color: "rgba(255, 255, 255, 0.72)",
  },
  otherTimeText: {
    color: "#94A3B8",
  },
  replyPreviewInBubble: {
    borderLeftWidth: 3,
    borderLeftColor: "#38BDF8",
    paddingLeft: 8,
    marginBottom: 6,
    backgroundColor: "rgba(0, 0, 0, 0.18)",
    borderRadius: 4,
    paddingVertical: 3,
  },
  replySenderInBubble: {
    fontSize: 11,
    color: "#38BDF8",
    fontWeight: "700",
  },
  replyTextInBubble: {
    fontSize: 12,
    color: "#CBD5E1",
  },
  daySeparatorContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 10,
  },
  daySeparatorPill: {
    backgroundColor: "rgba(16, 24, 39, 0.78)",
    paddingHorizontal: 13,
    paddingVertical: 4.5,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  daySeparatorText: {
    color: "#94A3B8",
    fontSize: 12,
    fontWeight: "600",
  },
  systemMessageCenterContainer: {
    alignSelf: "center",
    marginVertical: 4,
  },
  systemBubblePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 24, 39, 0.78)",
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  systemPillText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "500",
  },
  callMessageCenterContainer: {
    alignSelf: "center",
    marginVertical: 4,
  },
  callBubblePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 24, 39, 0.78)",
    paddingHorizontal: 12,
    paddingVertical: 5.5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  callPillText: {
    color: "#CBD5E1",
    fontSize: 12,
    fontWeight: "500",
  },
  emptyFeed: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyFeedIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "rgba(56, 189, 248, 0.25)",
  },
  emptyFeedTitle: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  emptyFeedText: {
    color: "#94A3B8",
    fontSize: 14,
    textAlign: "center",
    maxWidth: 240,
  },
  actionBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131B2E",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  actionBannerTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#38BDF8",
  },
  actionBannerText: {
    fontSize: 13,
    color: "#94A3B8",
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 10,
    paddingTop: 8,
    backgroundColor: "#0B0F1A",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
    gap: 8,
  },
  inputBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#131B2E",
    borderRadius: 24,
    paddingHorizontal: 8,
    minHeight: 46,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  inputInnerBtn: {
    padding: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  textInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 15,
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  actionSendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  giftedLoaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 40,
  },
  giftedLoaderText: {
    marginTop: 12,
    color: "#94A3B8",
    fontSize: 14,
    fontWeight: "500",
  },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "#2563EB",
    borderRadius: 20,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 14,
  },
});
