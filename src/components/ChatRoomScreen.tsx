import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Image,
  ImageBackground,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GiftedChat, IMessage, Message as GiftedChatMessage } from 'react-native-gifted-chat';
import { Message, Room } from '../types';
import { useChatStore } from '../store/useChatStore';
import { notificationService } from '../services/notifications';
import { RoomInfoModal } from './RoomInfoModal';
import { VoiceRoomSheet } from './VoiceRoomSheet';
import { ChronoAvatar } from './ChronoAvatar';
import { chronoTheme } from '../theme/colors';
import { useShallow } from 'zustand/react/shallow';

const CHAT_BACKGROUND = require('../../assets/chrono-chat-background.png');
const EMPTY_MESSAGES: Message[] = [];
import { formatTime } from '../utils/format';

const { colors } = chronoTheme;

interface ChatRoomScreenProps {
  room: Room;
  onBack: () => void;
}

export const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({ room, onBack }) => {
  const insets = useSafeAreaInsets();
  const [inputText, setInputText] = useState('');
  const [infoModalVisible, setInfoModalVisible] = useState(false);
  const [voiceSheetVisible, setVoiceSheetVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  // Yanıtlama & Düzenleme state'leri
  const [replyMessage, setReplyMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true),
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false),
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Sığ (shallow) seçici: yalnızca bu ekranın kullandığı aksiyonlar ve profil değişince render olur
  const {
    currentUserId,
    currentUserName,
    currentUserAvatar,
    fetchMessages,
    sendMessage,
    editMessage,
    deleteMessage,
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

  const messages = useMemo(() => {
    if (roomMsgs && roomMsgs.length > 0) return roomMsgs;
    if (activeRoomId === room.id && activeMsgs && activeMsgs.length > 0) return activeMsgs;
    return roomMsgs || activeMsgs || EMPTY_MESSAGES;
  }, [roomMsgs, activeMsgs, activeRoomId, room.id]);

  const isDirect = room.type === 'DIRECT';
  const chatTitle = isDirect
    ? room.peer?.displayName || room.peer?.username || 'Kullanıcı'
    : room.name || 'Sohbet Odası';

  const isPeerOnline = isDirect && room.peer?.status === 'ONLINE';

  const loadChat = useCallback(
    async (isRetry = false) => {
      // Eğer önbellekte zaten bu odaya ait mesajlar varsa tam ekran spinner açma (arka plan sessiz yenilemesi)
      const cachedCount = (useChatStore.getState().roomMessages[room.id]?.length ?? 0);
      if (cachedCount === 0) {
        setLoading(true);
      }
      if (isRetry) setLoadError(false);

      try {
        const success = await fetchMessages(room.id);
        const latestCount = (useChatStore.getState().roomMessages[room.id]?.length ?? 0);
        if (!success && latestCount === 0) {
          setLoadError(true);
        }
      } catch {
        const latestCount = (useChatStore.getState().roomMessages[room.id]?.length ?? 0);
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
    setInputText('');
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

  const handleStartCall = useCallback(
    (video = false) => {
      Alert.alert(
        video ? 'Görüntülü Arama' : 'Sesli Arama',
        `${chatTitle} kullanıcısını aramak istiyor musunuz?`,
        [
          { text: 'İptal', style: 'cancel' },
          {
            text: 'Ara',
            onPress: () => {
              startCall(room.id, video);
            },
          },
        ],
      );
    },
    [chatTitle, room.id, startCall],
  );

  const handleVoiceJoin = () => {
    joinRoomVoice(room.id);
    setVoiceSheetVisible(true);
  };

  const handleMessageLongPress = useCallback(
    (item: Message) => {
      const isMe = item.senderId === currentUserId;
      const options: {
        text: string;
        style?: 'cancel' | 'destructive' | 'default';
        onPress: () => void;
      }[] = [
        {
          text: 'Yanıtla',
          onPress: () => setReplyMessage(item),
        },
      ];

      if (isMe && item.type === 'TEXT') {
        options.push({
          text: 'Düzenle',
          onPress: () => {
            setEditingMessage(item);
            setInputText(item.content);
          },
        });
      }

      if (isMe) {
        options.push({
          text: 'Sil',
          style: 'destructive',
          onPress: () => deleteMessage(item.id),
        });
      }

      options.push({ text: 'İptal', style: 'cancel', onPress: () => {} });

      Alert.alert('Mesaj Seçenekleri', undefined, options);
    },
    [currentUserId, deleteMessage],
  );

  const isVoiceActiveInThisRoom = !isDirect && (activeVoiceCount > 0 || activeVoiceRoomId === room.id);
  const isMeInVoice = activeVoiceRoomId === room.id;

  const giftedMessages = useMemo<IMessage[]>(() => {
    return messages.map((item) => {
      const isSystem = item.type === 'SYSTEM';
      return {
        _id: item.id,
        text: item.deletedAt ? '🚫 Bu mesaj silindi' : item.content,
        createdAt: new Date(item.createdAt),
        user: {
          _id: item.senderId,
          name: item.sender?.displayName || item.sender?.username || 'Kullanıcı',
          avatar: item.sender?.avatarUrl || undefined,
        },
        system: isSystem,
        sent: true,
        received: !!room.othersReadAt,
        raw: item,
      } as IMessage & { raw: Message };
    });
  }, [messages, room.othersReadAt]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoidingRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        {/* ------------------------------------------------------------- */}
        {/* Telegram Style Chat Header                                    */}
        {/* ------------------------------------------------------------- */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
            <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>

          {/* Room / Peer Info */}
          <TouchableOpacity
            style={styles.roomHeaderInfo}
            onPress={() => setInfoModalVisible(true)}
            activeOpacity={0.8}
          >
            <ChronoAvatar
              size={38}
              uri={isDirect ? room.peer?.avatarUrl : room.iconUrl}
              name={chatTitle}
              emoji={!isDirect && (chatTitle.startsWith('🔥') || true) ? (chatTitle.match(/^(\p{Emoji})/u)?.[0] || '🔥') : undefined}
              online={isDirect && isPeerOnline}
              style={{ marginRight: 10 }}
            />

            <View style={styles.headerTitles}>
              <Text style={styles.roomName} numberOfLines={1}>
                {!isDirect && chatTitle.match(/^(\p{Emoji})/u)
                  ? chatTitle.replace(/^(\p{Emoji})/u, '').trim()
                  : chatTitle}
              </Text>
              <Text style={styles.roomStatus} numberOfLines={1}>
                {typingUsers.length > 0 ? (
                  <Text style={{ color: colors.primaryLight }}>
                    {typingUsers.map((u) => u.displayName).join(', ')} yazıyor...
                  </Text>
                ) : isDirect ? (
                  isPeerOnline ? (
                    <Text style={{ color: '#10B981' }}>çevrimiçi</Text>
                  ) : (
                    <Text style={{ color: '#38BDF8' }}>son görülme yakınlarda</Text>
                  )
                ) : (
                  `${room.membersCount || room.members?.length || 2} üye · ${activeVoiceCount > 0 ? `${activeVoiceCount} çevrimiçi` : '1 çevrimiçi'}`
                )}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Header Actions: DM -> Sesli & Görüntülü Arama; Oda -> 3 Nokta */}
          <View style={styles.headerActions}>
            {isDirect ? (
              <>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => handleStartCall(false)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="call-outline" size={21} color={colors.textPrimary} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionIconBtn}
                  onPress={() => handleStartCall(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="videocam-outline" size={22} color={colors.textPrimary} />
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                style={styles.actionIconBtn}
                onPress={() => setInfoModalVisible(true)}
                activeOpacity={0.7}
              >
                <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

      {/* ------------------------------------------------------------- */}
      {/* Live Voice Chat Header Banner (Sohbet Odaları için)           */}
      {/* ------------------------------------------------------------- */}
      {!isDirect && isVoiceActiveInThisRoom && (
        <TouchableOpacity
          style={[styles.liveVoiceBanner, isMeInVoice && { backgroundColor: '#0B291B', borderColor: '#10B98155' }]}
          onPress={() => {
            if (!isMeInVoice) {
              handleVoiceJoin();
            } else {
              setVoiceSheetVisible(true);
            }
          }}
          activeOpacity={0.85}
        >
          <View style={styles.voiceBannerContent}>
            <View style={[styles.voiceWaveIconBg, isMeInVoice && { backgroundColor: '#10B981' }]}>
              <Ionicons name={isMeInVoice ? 'volume-high' : 'mic'} size={16} color="#ffffff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.voiceBannerTitle, isMeInVoice && { color: '#10B981' }]}>
                {isMeInVoice ? 'Sesli Sohbet Sürdürülüyor' : 'Canlı Sesli Sohbet'}
              </Text>
              <Text style={styles.voiceBannerSubtitle}>
                {activeVoiceCount > 0
                  ? `${activeVoiceCount} kişi odada konuşuyor`
                  : 'Dokunarak konuşmaya katılın'}
              </Text>
            </View>
          </View>
          <View style={[styles.joinBtnPill, isMeInVoice && { backgroundColor: '#10B981' }]}>
            <Text style={styles.joinBtnText}>{isMeInVoice ? 'YÖNET' : 'KATIL'}</Text>
          </View>
        </TouchableOpacity>
      )}

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
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => loadChat(true)}
              activeOpacity={0.8}
            >
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
            currentUserId={currentUserId || ''}
            currentUserName={currentUserName || 'Kullanıcı'}
            currentUserAvatar={currentUserAvatar || undefined}
            isDirect={isDirect}
            othersRead={!!room.othersReadAt}
            loading={loading}
            onLongPressMessage={handleMessageLongPress}
            onCallPress={handleStartCall}
          />
        )}
      </ImageBackground>

        {/* Yanıtlama veya Düzenleme Banner'ı */}
        {(replyMessage || editingMessage) && (
          <View style={styles.actionBanner}>
            <View style={{ flex: 1 }}>
              <Text style={styles.actionBannerTitle}>
                {editingMessage ? 'Mesajı Düzenle' : `Yanıtla: ${replyMessage?.sender?.displayName || 'Kullanıcı'}`}
              </Text>
              <Text style={styles.actionBannerText} numberOfLines={1}>
                {editingMessage ? editingMessage.content : replyMessage?.content}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setReplyMessage(null);
                setEditingMessage(null);
                setInputText('');
              }}
              style={{ padding: 4 }}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Oda İçin Alt Sesli Sohbet Kartı (Page 5 Tasarımı)              */}
        {/* ------------------------------------------------------------- */}
        {!isDirect && (
          <View style={styles.dockedVoiceCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.dockedVoiceTitle}>Sesli sohbet</Text>
              <Text style={styles.dockedVoiceSubtitle}>
                {activeVoiceCount > 0
                  ? `${activeVoiceCount} kişi odada konuşuyor`
                  : 'Şu an kimse yok'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.dockedVoiceBtn}
              onPress={handleVoiceJoin}
              activeOpacity={0.85}
            >
              <Ionicons name="mic" size={15} color="#FFFFFF" style={{ marginRight: 5 }} />
              <Text style={styles.dockedVoiceBtnText}>
                {isMeInVoice ? 'Yönet' : activeVoiceCount > 0 ? 'Katıl' : 'Başlat'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ------------------------------------------------------------- */}
        {/* Bottom Input Bar                                              */}
        {/* ------------------------------------------------------------- */}
        <View
          style={[
            styles.inputContainer,
            { paddingBottom: isKeyboardVisible ? 8 : Math.max(insets.bottom, 8) },
          ]}
        >
          <TouchableOpacity style={styles.mediaIconBtn} activeOpacity={0.7}>
            <Ionicons name="camera-outline" size={22} color="#8A93A8" />
          </TouchableOpacity>

          <View style={styles.inputBox}>
            <TextInput
              style={styles.textInput}
              placeholder="Mesaj yaz"
              placeholderTextColor="#64748B"
              value={inputText}
              onChangeText={handleInputChange}
              multiline
            />

            <TouchableOpacity style={styles.attachBtn} activeOpacity={0.7}>
              <Ionicons name="attach" size={22} color="#8A93A8" />
            </TouchableOpacity>
          </View>

          {/* Dinamik Gönder / Mikrofon Butonu */}
          <TouchableOpacity
            style={styles.actionSendBtn}
            onPress={inputText.trim() ? handleSend : (!isDirect ? handleVoiceJoin : undefined)}
            activeOpacity={0.85}
          >
            <Ionicons
              name={inputText.trim() ? 'send' : 'mic'}
              size={18}
              color="#FFFFFF"
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
        <VoiceRoomSheet
          visible={voiceSheetVisible}
          roomName={chatTitle}
          onClose={() => setVoiceSheetVisible(false)}
        />
      )}
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Mesaj beslemesi (memo): input'a yazarken veya klavye açılırken yeniden render olmaz
// ---------------------------------------------------------------------------
const formatCallDuration = (secs: number) => {
  if (secs <= 0) return '';
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  if (mins > 0) {
    return `${mins} dk ${remainingSecs > 0 ? `${remainingSecs} sn` : ''}`;
  }
  return `${remainingSecs} sn`;
};

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
  keyboardDismissMode: 'on-drag',
  keyboardShouldPersistTaps: 'handled',
  initialNumToRender: 15,
  maxToRenderPerBatch: 10,
  windowSize: 11,
  removeClippedSubviews: Platform.OS === 'android',
} as const;

interface CallBubbleProps {
  item: Message;
  isMe: boolean;
  isDirect: boolean;
  onCallPress: (video?: boolean) => void;
}

const CallBubble = memo(function CallBubble({ item, isMe, isDirect, onCallPress }: CallBubbleProps) {
  let callData = { video: false, status: 'ended', duration: 0 };
  try {
    if (typeof item.content === 'string' && item.content.startsWith('{')) {
      callData = JSON.parse(item.content);
    }
  } catch {
    // fallback
  }

  const { video, status, duration } = callData;
  const isIncoming = !isMe;
  const durStr = duration > 0 ? formatCallDuration(duration) : '';
  const timeStr = formatTime(item.createdAt);

  const label = isIncoming
    ? (video ? 'Gelen görüntülü arama' : 'Gelen sesli arama')
    : (video ? 'Giden görüntülü arama' : 'Giden sesli arama');

  const text = durStr ? `${label} · ${durStr} · ${timeStr}` : `${label} · ${timeStr}`;

  return (
    <View style={styles.callMessageCenterContainer}>
      <TouchableOpacity
        style={styles.callBubblePill}
        onPress={() => isDirect && onCallPress(video)}
        activeOpacity={0.8}
      >
        <Ionicons
          name={video ? 'videocam-outline' : 'call-outline'}
          size={16}
          color={video ? '#38BDF8' : '#10B981'}
          style={{ marginRight: 8 }}
        />
        <Text style={styles.callPillText}>{text}</Text>
      </TouchableOpacity>
    </View>
  );
});

interface TextBubbleProps {
  item: Message;
  isMe: boolean;
  isDirect: boolean;
  othersRead: boolean;
  onLongPress: (item: Message) => void;
}

const TextBubble = memo(function TextBubble({
  item,
  isMe,
  isDirect,
  othersRead,
  onLongPress,
}: TextBubbleProps) {
  const isDeleted = !!item.deletedAt;
  const handleLongPress = useCallback(() => onLongPress(item), [onLongPress, item]);

  return (
    <TouchableOpacity
      style={[
        styles.messageBubbleContainer,
        isMe ? styles.myMessageContainer : styles.otherMessageContainer,
      ]}
      onLongPress={handleLongPress}
      activeOpacity={0.85}
    >
      <View style={[styles.bubble, isMe ? styles.myBubble : styles.otherBubble]}>
        {!isDirect && !isMe && (
          <Text style={styles.senderName}>
            {item.sender?.displayName || item.sender?.username || 'Kullanıcı'}
          </Text>
        )}

        {item.replyTo && (
          <View style={styles.replyPreviewInBubble}>
            <Text style={styles.replySenderInBubble}>
              {item.replyTo.sender?.displayName || 'Kullanıcı'}
            </Text>
            <Text style={styles.replyTextInBubble} numberOfLines={1}>
              {item.replyTo.content || 'Silinmiş mesaj'}
            </Text>
          </View>
        )}

        <Text style={[styles.messageContent, isDeleted && styles.deletedMessageText]}>
          {isDeleted ? '🚫 Bu mesaj silindi' : item.content}
        </Text>

        <View style={styles.metaRow}>
          {item.editedAt && !isDeleted && <Text style={styles.editedTag}>düzenlendi </Text>}
          <Text style={[styles.timeText, isMe ? styles.myTimeText : styles.otherTimeText]}>
            {formatTime(item.createdAt)}
          </Text>
          {isMe && (
            <Ionicons
              name={othersRead ? 'checkmark-done' : 'checkmark'}
              size={15}
              color={othersRead ? colors.primaryLight : colors.bubbleSentTime}
              style={styles.readCheckIcon}
            />
          )}
        </View>
      </View>
    </TouchableOpacity>
  );
});

interface MessageFeedProps {
  messages: IMessage[];
  currentUserId: string;
  currentUserName: string;
  currentUserAvatar?: string;
  isDirect: boolean;
  othersRead: boolean;
  loading: boolean;
  onLongPressMessage: (item: Message) => void;
  onCallPress: (video?: boolean) => void;
}

const MessageFeed = memo(function MessageFeed({
  messages,
  currentUserId,
  currentUserName,
  currentUserAvatar,
  isDirect,
  othersRead,
  loading,
  onLongPressMessage,
  onCallPress,
}: MessageFeedProps) {
  const user = useMemo(
    () => ({ _id: currentUserId, name: currentUserName, avatar: currentUserAvatar }),
    [currentUserId, currentUserName, currentUserAvatar],
  );

  // React 19 Uyumlu Mesaj Renderlayıcı:
  // GiftedChat'in dahili <Message {...props} /> içinde key yaymasını önler ve key'i doğrudan JSX elemanına aktarır.
  const renderMessage = useCallback((props: any) => {
    const { key, ...restProps } = props;
    const messageKey = key || props.currentMessage?._id || `msg-${Math.random()}`;
    return <GiftedChatMessage key={messageKey} {...restProps} />;
  }, []);

  const renderBubble = useCallback(
    (bubbleProps: any) => {
      const currentMsg = bubbleProps.currentMessage as (IMessage & { raw?: Message }) | undefined;
      const item = currentMsg?.raw;
      if (!item) return null;

      const isMe = item.senderId === currentUserId;

      if (item.type === 'SYSTEM') {
        const isVoiceEnd = item.content.includes('Sesli sohbet sona erdi');
        return (
          <View style={[styles.systemMessageContainer, isVoiceEnd && styles.systemVoiceEndContainer]}>
            <Text style={[styles.systemMessageText, isVoiceEnd && styles.systemVoiceEndText]}>
              {item.content}
            </Text>
          </View>
        );
      }

      if (item.type === 'CALL') {
        return <CallBubble item={item} isMe={isMe} isDirect={isDirect} onCallPress={onCallPress} />;
      }

      return (
        <TextBubble
          item={item}
          isMe={isMe}
          isDirect={isDirect}
          othersRead={othersRead}
          onLongPress={onLongPressMessage}
        />
      );
    },
    [currentUserId, isDirect, othersRead, onLongPressMessage, onCallPress],
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
  readCheckIcon: {
    marginLeft: 4,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAvoidingRoot: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    padding: 8,
    borderRadius: 20,
  },
  roomHeaderInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceElevated,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
    position: 'relative',
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatarImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  avatarText: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
  headerVoiceDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.online,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  headerTitles: {
    flex: 1,
  },
  roomName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  roomStatus: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionIconBtnActive: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
  },
  liveVoiceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  voiceBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  voiceWaveIconBg: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  voiceBannerTitle: {
    color: colors.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  voiceBannerSubtitle: {
    color: colors.primaryLight,
    fontSize: 11,
  },
  joinBtnPill: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 14,
  },
  joinBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  chatArea: {
    flex: 1,
    backgroundColor: '#080B14',
  },
  chatBackgroundImage: {
    opacity: 0.95,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  messageBubbleContainer: {
    marginVertical: 4,
    maxWidth: '82%',
  },
  myMessageContainer: {
    alignSelf: 'flex-end',
  },
  otherMessageContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 1,
  },
  myBubble: {
    backgroundColor: colors.bubbleSent,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 4,
  },
  otherBubble: {
    backgroundColor: colors.bubbleReceived,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 4,
    borderBottomRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  senderName: {
    color: colors.primaryLight,
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 3,
  },
  replyPreviewInBubble: {
    borderLeftWidth: 3,
    borderLeftColor: colors.primaryLight,
    paddingLeft: 8,
    marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.15)',
    borderRadius: 4,
    paddingVertical: 2,
  },
  replySenderInBubble: {
    fontSize: 11,
    color: colors.primaryLight,
    fontWeight: '700',
  },
  replyTextInBubble: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  messageContent: {
    color: colors.textPrimary,
    fontSize: 15,
    lineHeight: 20,
  },
  deletedMessageText: {
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  editedTag: {
    fontSize: 10,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  timeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  myTimeText: {
    color: colors.bubbleSentTime,
  },
  otherTimeText: {
    color: colors.bubbleTime,
  },
  systemMessageContainer: {
    alignSelf: 'center',
    backgroundColor: 'rgba(21, 29, 48, 0.75)',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginVertical: 6,
  },
  systemMessageText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  systemVoiceEndContainer: {
    backgroundColor: '#0B291B',
    borderColor: '#10B98155',
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 16,
    marginVertical: 8,
  },
  systemVoiceEndText: {
    color: '#34D399',
    fontSize: 12.5,
    fontWeight: '600',
  },
  emptyFeed: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    transform: [{ scaleY: -1 }],
  },
  emptyFeedIconBg: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  emptyFeedTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 6,
  },
  emptyFeedText: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 240,
  },
  actionBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  actionBannerTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primaryLight,
  },
  actionBannerText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
    paddingTop: 8,
    backgroundColor: '#0B0F1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    gap: 8,
  },
  mediaIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    borderRadius: 22,
    paddingHorizontal: 12,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  attachBtn: {
    padding: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    paddingHorizontal: 4,
    paddingVertical: 8,
  },
  actionSendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dockedVoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  dockedVoiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  dockedVoiceSubtitle: {
    fontSize: 12,
    color: '#8A93A8',
  },
  dockedVoiceBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dockedVoiceBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  giftedLoaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  giftedLoaderText: {
    marginTop: 12,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  callMessageCenterContainer: {
    alignSelf: 'center',
    marginVertical: 6,
  },
  callBubblePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
    alignSelf: 'center',
  },
  callPillText: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '500',
  },
  retryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
