import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  FlatList,
  Platform,
  Image,
  Modal,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Room } from '../types';
import { useChatStore } from '../store/useChatStore';
import { CreateRoomModal } from './CreateRoomModal';
import { ChronoAvatar } from './ChronoAvatar';
import { ChronoProgressRing } from './ChronoProgressRing';
import { chronoTheme } from '../theme/colors';
import { api } from '../services/api';
import { useShallow } from 'zustand/react/shallow';
import { formatCallPreview, formatListTimestamp, getTranslation } from '../utils/format';

const { colors } = chronoTheme;
const CHRONO_APP_ICON = require('../../assets/android-icon-foreground.png');

interface RoomsListScreenProps {
  onSelectRoom: (room: Room) => void;
  onOpenAuth: () => void;
}

type TabFilter = 'ALL' | 'DIRECT' | 'ROOMS';

export const RoomsListScreen: React.FC<RoomsListScreenProps> = ({
  onSelectRoom,
}) => {
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [newDirectModalVisible, setNewDirectModalVisible] = useState(false);
  const [searchUsersQuery, setSearchUsersQuery] = useState('');
  const [userSearchResults, setUserSearchResults] = useState<any[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);

  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchVisible, setIsSearchVisible] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');

  const toggleSearch = useCallback(() => {
    setIsSearchVisible((prev) => {
      const next = !prev;
      if (!next) {
        setSearchQuery('');
      } else {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 100);
      }
      return next;
    });
  }, []);

  // Donanım geri tuşuna basıldığında açık olan arama çubuğunu kapat
  useEffect(() => {
    if (!isSearchVisible) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setIsSearchVisible(false);
      setSearchQuery('');
      return true;
    });
    return () => sub.remove();
  }, [isSearchVisible]);

  // Uzun basma menüsü
  const [selectedRoomForAction, setSelectedRoomForAction] = useState<Room | null>(null);

  // Sadece ihtiyaç duyulan alanlara sığ (shallow) abone ol:
  // yazıyor göstergesi, mesaj listesi vb. değişimler bu ekranı render etmez
  const {
    currentUserId,
    rooms,
    isRoomsLoading,
    hasLoadedRooms,
    fetchRooms,
    openDirect,
    togglePinRoom,
    toggleMuteRoom,
    deleteRoom,
    activeVoiceRoomId,
    roomVoiceStates,
    activeCall,
    acceptCall,
    declineCall,
    settings,
  } = useChatStore(
    useShallow((s) => ({
      currentUserId: s.currentUser?.id,
      settings: s.settings,
      rooms: s.rooms,
      isRoomsLoading: s.isRoomsLoading,
      hasLoadedRooms: s.hasLoadedRooms,
      fetchRooms: s.fetchRooms,
      openDirect: s.openDirect,
      togglePinRoom: s.togglePinRoom,
      toggleMuteRoom: s.toggleMuteRoom,
      deleteRoom: s.deleteRoom,
      activeVoiceRoomId: s.activeVoiceRoomId,
      roomVoiceStates: s.roomVoiceStates,
      activeCall: s.activeCall,
      acceptCall: s.acceptCall,
      declineCall: s.declineCall,
    })),
  );

  useEffect(() => {
    if (currentUserId) {
      fetchRooms();
    }
  }, [currentUserId]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  // Kullanıcı araması: her tuşta istek atmak yerine 300ms debounce + eski yanıtları yok say
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReqIdRef = useRef(0);

  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, []);

  const handleSearchUsers = useCallback((q: string) => {
    setSearchUsersQuery(q);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    if (!q.trim()) {
      searchReqIdRef.current++;
      setUserSearchResults([]);
      setSearchingUsers(false);
      return;
    }

    setSearchingUsers(true);
    searchTimerRef.current = setTimeout(async () => {
      const reqId = ++searchReqIdRef.current;
      try {
        const res = await api.get('/users/search', { params: { q } });
        if (reqId === searchReqIdRef.current) setUserSearchResults(res.data);
        console.log("usersearch", res.data);
      } catch {
        // Hata durumunda sessiz kal
      } finally {
        if (reqId === searchReqIdRef.current) setSearchingUsers(false);
      }
    }, 300);
  }, []);

  const handleStartDirectChat = async (targetUser: any) => {
    try {
      const direct = await openDirect(targetUser.id);
      setNewDirectModalVisible(false);
      setSearchUsersQuery('');
      setUserSearchResults([]);
      onSelectRoom(direct);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Sohbet açılamadı');
    }
  };

  const handleLongPressRoom = useCallback((room: Room) => {
    setSelectedRoomForAction(room);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: Room }) => (
      <RoomItem
        item={item}
        currentUserId={currentUserId}
        myLastSeenVisibility={settings?.lastSeenVisibility}
        myReadReceipts={settings?.readReceipts}
        voiceCount={item.type !== 'DIRECT' ? roomVoiceStates?.[item.id]?.count || 0 : 0}
        isMyVoiceRoom={activeVoiceRoomId === item.id}
        onPress={onSelectRoom}
        onLongPress={handleLongPressRoom}
      />
    ),
    [
      currentUserId,
      settings?.lastSeenVisibility,
      settings?.readReceipts,
      roomVoiceStates,
      activeVoiceRoomId,
      onSelectRoom,
      handleLongPressRoom,
    ],
  );

  // Sekme ve arama filtrelemesi
  const filteredRooms = useMemo(() => {
    let list = rooms;

    if (activeTab === 'DIRECT') {
      list = list.filter((r) => r.type === 'DIRECT');
    } else if (activeTab === 'ROOMS') {
      list = list.filter((r) => r.type === 'ROOM');
    }

    if (!searchQuery.trim()) return list;

    const q = searchQuery.toLowerCase();
    return list.filter((r) => {
      const name = r.type === 'DIRECT' ? (r.peer?.displayName || r.peer?.username || '') : (r.name || '');
      return (
        name.toLowerCase().includes(q) ||
        r.lastMessage?.content?.toLowerCase().includes(q)
      );
    });
  }, [rooms, activeTab, searchQuery]);

  const liveVoiceRoom = useMemo(() => {
    return rooms.find(
      (r) =>
        r.type !== 'DIRECT' &&
        ((roomVoiceStates?.[r.id]?.count || 0) > 0 || activeVoiceRoomId === r.id),
    );
  }, [rooms, roomVoiceStates, activeVoiceRoomId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* ------------------------------------------------------------- */}
      {/* Gelen Arama Bildirim Bannerı                                  */}
      {/* ------------------------------------------------------------- */}
      {activeCall && activeCall.state === 'ringing' && (
        <View style={styles.callBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.callBannerTitle}>Gelen Arama</Text>
            <Text style={styles.callBannerSubtitle}>
              {activeCall.caller?.displayName || 'Kullanıcı'} arıyor...
            </Text>
          </View>
          <View style={styles.callBannerButtons}>
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: '#EF4444' }]}
              onPress={() => declineCall(activeCall.callId)}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.callBtn, { backgroundColor: '#10B981' }]}
              onPress={() => acceptCall(activeCall.callId)}
            >
              <Ionicons name="call" size={18} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Chrono Brand Header & Actions                                 */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.topBar}>
        <View style={styles.brandRow}>
          <Image
            source={CHRONO_APP_ICON}
            style={styles.brandIcon}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>Chrono</Text>
        </View>

        <View style={styles.headerActions}>
          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={toggleSearch}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons
              name={isSearchVisible ? 'close' : 'search-outline'}
              size={22}
              color={isSearchVisible ? colors.primaryLight : colors.textPrimary}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.headerActionBtn}
            onPress={() => setMoreMenuVisible(true)}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* Search Bar Pill (Büyüteç simgesine basıldığında açılır)       */}
      {/* ------------------------------------------------------------- */}
      {isSearchVisible && (
        <View style={styles.searchSection}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 10 }} />
            <TextInput
              ref={searchInputRef}
              style={styles.searchInput}
              placeholder="Sohbet veya kişi ara"
              placeholderTextColor="#64748B"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={18} color="#64748B" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Filter Tabs: Tümü · Kişisel · Odalar                          */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ALL' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ALL')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ALL' && styles.tabTextActive]}>
            Tümü
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'DIRECT' && styles.tabButtonActive]}
          onPress={() => setActiveTab('DIRECT')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'DIRECT' && styles.tabTextActive]}>
            Kişisel
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'ROOMS' && styles.tabButtonActive]}
          onPress={() => setActiveTab('ROOMS')}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabText, activeTab === 'ROOMS' && styles.tabTextActive]}>
            Odalar
          </Text>
        </TouchableOpacity>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* Sohbet Listesi                                                */}
      {/* ------------------------------------------------------------- */}
      <FlatList
        data={filteredRooms}
        keyExtractor={roomKeyExtractor}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primaryLight}
          />
        }
        contentContainerStyle={[
          styles.listContent,
          filteredRooms.length === 0 && styles.emptyListContainer,
        ]}
        ListHeaderComponent={
          liveVoiceRoom ? (
            <View style={styles.liveVoiceCard}>
              <View style={styles.liveVoiceCardLeft}>
                <View style={styles.liveDotIndicator} />
                <ChronoAvatar
                  size={38}
                  name={liveVoiceRoom.name || 'Oda'}
                  emoji={liveVoiceRoom.name?.startsWith('🔥') ? '🔥' : undefined}
                  uri={liveVoiceRoom.iconUrl}
                />
                <View style={{ marginLeft: 10, flex: 1 }}>
                  <Text style={styles.liveVoiceTitle} numberOfLines={1}>
                    {liveVoiceRoom.name}
                  </Text>
                  <Text style={styles.liveVoiceSubtitle}>
                    Canlı sesli sohbet · {roomVoiceStates?.[liveVoiceRoom.id]?.count || 2} kişi
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                style={styles.liveJoinBtn}
                onPress={() => onSelectRoom(liveVoiceRoom)}
                activeOpacity={0.8}
              >
                <Text style={styles.liveJoinBtnText}>Katıl</Text>
              </TouchableOpacity>
            </View>
          ) : null
        }
        renderItem={renderItem}
        getItemLayout={getRoomItemLayout}
        initialNumToRender={12}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={40}
        windowSize={9}
        removeClippedSubviews={Platform.OS === 'android'}
        ListEmptyComponent={
          !hasLoadedRooms && isRoomsLoading ? (
            <View style={styles.skeletonContainer}>
              {[1, 2, 3, 4, 5, 6, 7].map((item) => (
                <View key={item} style={styles.skeletonRow}>
                  <View style={styles.skeletonAvatar} />
                  <View style={styles.skeletonContent}>
                    <View style={styles.skeletonHeader}>
                      <View style={styles.skeletonTitle} />
                      <View style={styles.skeletonTime} />
                    </View>
                    <View style={styles.skeletonSubtitle} />
                  </View>
                </View>
              ))}
            </View>
          ) : hasLoadedRooms && rooms.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons
                  name="chatbubbles-outline"
                  size={40}
                  color={colors.primaryLight}
                />
              </View>
              <Text style={styles.emptyTitle}>Henüz Sohbet Yok</Text>
              <Text style={styles.emptySubtitle}>
                Kalem butonuna dokunarak yeni bir sohbet odası oluşturun veya bir arkadaşınıza mesaj atın.
              </Text>
            </View>
          ) : null
        }
      />

      {/* ------------------------------------------------------------- */}
      {/* Floating Action Button (+ Yeni Pill)                          */}
      {/* ------------------------------------------------------------- */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setMoreMenuVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="add" size={20} color="#FFFFFF" style={{ marginRight: 4 }} />
        <Text style={styles.fabText}>Yeni</Text>
      </TouchableOpacity>

      {/* ------------------------------------------------------------- */}
      {/* Telegram More Menu Popup                                      */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMoreMenuVisible(false)}>
          <View style={styles.menuOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.menuCard}>
                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    setNewDirectModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="person-add-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Yeni Kişisel Sohbet</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    setCreateModalVisible(true);
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="people-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Yeni Sohbet Odası</Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItem}
                  onPress={() => {
                    setMoreMenuVisible(false);
                    handleRefresh();
                  }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={20} color={colors.textPrimary} />
                  <Text style={styles.menuItemText}>Sohbetleri Yenile</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* ------------------------------------------------------------- */}
      {/* Uzun Basma İşlem Menüsü (Ekran 6: Vurgulanan Kart + Menü)     */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={!!selectedRoomForAction}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedRoomForAction(null)}
      >
        <TouchableWithoutFeedback onPress={() => setSelectedRoomForAction(null)}>
          <View style={styles.actionModalOverlay}>
            <TouchableWithoutFeedback>
              <View style={styles.actionModalContainer}>
                {/* Vurgulanan Sohbet Kartı (Mavi Parlayan Çerçeve) */}
                {selectedRoomForAction && (
                  <View style={styles.actionHighlightedCard}>
                    <ChronoAvatar
                      size={48}
                      uri={
                        selectedRoomForAction.type === 'DIRECT'
                          ? selectedRoomForAction.peer?.avatarUrl
                          : selectedRoomForAction.iconUrl
                      }
                      name={
                        selectedRoomForAction.type === 'DIRECT'
                          ? selectedRoomForAction.peer?.displayName ||
                            selectedRoomForAction.peer?.username ||
                            'Kullanıcı'
                          : selectedRoomForAction.name || 'Sohbet Odası'
                      }
                      emoji={
                        selectedRoomForAction.type !== 'DIRECT' &&
                        selectedRoomForAction.name?.startsWith('🔥')
                          ? '🔥'
                          : undefined
                      }
                      ringColor="#2563EB"
                      showRing={true}
                    />

                    <View style={styles.actionHighlightedDetails}>
                      <View style={styles.actionHighlightedHeader}>
                        <Text style={styles.actionHighlightedTitle} numberOfLines={1}>
                          {selectedRoomForAction.type === 'DIRECT'
                            ? selectedRoomForAction.peer?.displayName ||
                              selectedRoomForAction.peer?.username ||
                              'Kişisel Sohbet'
                            : selectedRoomForAction.name || 'Sohbet Odası'}
                        </Text>
                        <Text style={styles.actionHighlightedTime}>
                          {formatListTimestamp(
                            selectedRoomForAction.lastMessageAt ||
                              selectedRoomForAction.updatedAt ||
                              selectedRoomForAction.createdAt,
                          )}
                        </Text>
                      </View>

                      <View style={styles.actionHighlightedFooter}>
                        <Text style={styles.actionHighlightedLastMsg} numberOfLines={1}>
                          {selectedRoomForAction.lastMessage?.content || 'Henüz mesaj yok'}
                        </Text>
                        {selectedRoomForAction.unreadCount && selectedRoomForAction.unreadCount > 0 ? (
                          <View style={styles.actionHighlightedBadge}>
                            <Text style={styles.actionHighlightedBadgeText}>
                              {selectedRoomForAction.unreadCount}
                            </Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </View>
                )}

                {/* Eylemler Menü Kartı */}
                <View style={styles.actionModalCard}>
                  {/* Başa Sabitle */}
                  <TouchableOpacity
                    style={styles.actionModalRow}
                    onPress={() => {
                      if (selectedRoomForAction) togglePinRoom(selectedRoomForAction.id);
                      setSelectedRoomForAction(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={selectedRoomForAction?.isPinned ? 'pin' : 'pin-outline'}
                      size={20}
                      color="#38BDF8"
                    />
                    <Text style={styles.actionModalRowText}>
                      {selectedRoomForAction?.isPinned ? 'Sabitlemeyi kaldır' : 'Başa sabitle'}
                    </Text>
                  </TouchableOpacity>

                  {/* Sessize Al */}
                  <TouchableOpacity
                    style={styles.actionModalRow}
                    onPress={() => {
                      if (selectedRoomForAction) toggleMuteRoom(selectedRoomForAction.id);
                      setSelectedRoomForAction(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name={selectedRoomForAction?.isMuted ? 'volume-high-outline' : 'volume-mute-outline'}
                      size={20}
                      color="#38BDF8"
                    />
                    <Text style={styles.actionModalRowText}>
                      {selectedRoomForAction?.isMuted ? 'Sessizden çıkar' : 'Sessize al'}
                    </Text>
                  </TouchableOpacity>

                  {/* Okunmadı İşaretle */}
                  <TouchableOpacity
                    style={styles.actionModalRow}
                    onPress={() => {
                      if (selectedRoomForAction) {
                        const targetId = selectedRoomForAction.id;
                        const isCurrentlyUnread = (selectedRoomForAction.unreadCount || 0) > 0;
                        if (isCurrentlyUnread) {
                          useChatStore.getState().markAsRead(targetId);
                        } else {
                          useChatStore.setState((state) => ({
                            rooms: state.rooms.map((r) =>
                              r.id === targetId ? { ...r, unreadCount: 1 } : r,
                            ),
                          }));
                        }
                      }
                      setSelectedRoomForAction(null);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="ellipse-outline"
                      size={18}
                      color="#38BDF8"
                    />
                    <Text style={styles.actionModalRowText}>
                      {(selectedRoomForAction?.unreadCount || 0) > 0
                        ? 'Okundu işaretle'
                        : 'Okunmadı işaretle'}
                    </Text>
                  </TouchableOpacity>

                  {/* Sohbeti Sil */}
                  <TouchableOpacity
                    style={[styles.actionModalRow, styles.actionModalRowLast]}
                    onPress={() => {
                      const target = selectedRoomForAction;
                      setSelectedRoomForAction(null);
                      if (!target) return;

                      Alert.alert(
                        'Sohbeti Sil',
                        target.type === 'DIRECT'
                          ? 'Bu sohbeti silmek istediğinize emin misiniz?'
                          : 'Bu sohbet odasından ayrılmak veya silmek istiyor musunuz?',
                        [
                          { text: 'İptal', style: 'cancel' },
                          {
                            text: 'Sil',
                            style: 'destructive',
                            onPress: () => deleteRoom(target.id, false),
                          },
                        ],
                      );
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={20} color="#EF4444" />
                    <Text style={[styles.actionModalRowText, { color: '#EF4444' }]}>
                      {selectedRoomForAction?.type === 'DIRECT' ? 'Sohbeti sil' : 'Odadan ayrıl / sil'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* ------------------------------------------------------------- */}
      {/* Yeni Kişisel Sohbet Başlat (Kullanıcı Arama Modalı)            */}
      {/* ------------------------------------------------------------- */}
      <Modal
        visible={newDirectModalVisible}
        animationType="slide"
        onRequestClose={() => setNewDirectModalVisible(false)}
      >
        <SafeAreaView style={styles.directSearchContainer}>
          <View style={styles.directSearchHeader}>
            <TouchableOpacity onPress={() => setNewDirectModalVisible(false)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.directSearchHeaderTitle}>Yeni Kişisel Sohbet</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={styles.searchSection}>
            <View style={styles.searchBar}>
              <Ionicons name="search" size={18} color="#6E7F91" style={{ marginRight: 8 }} />
              <TextInput
                style={styles.searchInput}
                placeholder="Kullanıcı adı veya isim ile ara..."
                placeholderTextColor="#6E7F91"
                value={searchUsersQuery}
                onChangeText={handleSearchUsers}
                autoFocus
              />
            </View>
          </View>

          {searchingUsers && (
            <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: 16 }} />
          )}

          <FlatList
            data={userSearchResults}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.userSearchItem}
                onPress={() => handleStartDirectChat(item)}
                activeOpacity={0.7}
              >
                <View style={styles.userSearchAvatar}>
                  {item.avatarUrl ? (
                    <Image source={{ uri: item.avatarUrl }} style={styles.avatarImage} />
                  ) : (
                    <Text style={styles.avatarText}>
                      {(item.displayName || item.username || 'U').charAt(0).toUpperCase()}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.userSearchName}>{item.displayName}</Text>
                  <Text style={styles.userSearchUsername}>@{item.username}</Text>
                </View>
                <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primaryLight} />
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !searchingUsers && searchUsersQuery.trim().length > 0 ? (
                <Text style={styles.emptySearchText}>Kullanıcı bulunamadı.</Text>
              ) : null
            }
          />
        </SafeAreaView>
      </Modal>

      {/* Create Room Modal */}
      <CreateRoomModal
        visible={createModalVisible}
        onClose={() => setCreateModalVisible(false)}
        onRoomCreated={(room) => onSelectRoom(room)}
      />
    </SafeAreaView>
  );
};

// ---------------------------------------------------------------------------
// Sohbet listesi satırı (memo): yalnızca kendi verisi değiştiğinde yeniden render olur
// ---------------------------------------------------------------------------
const ROOM_ITEM_HEIGHT = 72;

const roomKeyExtractor = (item: Room) => item.id;

const getRoomItemLayout = (_: ArrayLike<Room> | null | undefined, index: number) => ({
  length: ROOM_ITEM_HEIGHT,
  offset: ROOM_ITEM_HEIGHT * index,
  index,
});

interface RoomItemProps {
  item: Room;
  currentUserId?: string;
  myLastSeenVisibility?: string;
  myReadReceipts?: boolean;
  voiceCount: number;
  isMyVoiceRoom: boolean;
  onPress: (room: Room) => void;
  onLongPress: (room: Room) => void;
}

const RoomItem = memo(function RoomItem({
  item,
  currentUserId,
  myLastSeenVisibility,
  myReadReceipts,
  voiceCount,
  isMyVoiceRoom,
  onPress,
  onLongPress,
}: RoomItemProps) {
  const isDirect = item.type === 'DIRECT';
  const hasActiveVoice = !isDirect && voiceCount > 0;
  const roomMsgs = useChatStore((s) => s.roomMessages[item.id]);
  const lastMsg = (item.lastMessage?.content ? item.lastMessage : roomMsgs?.[0]) || item.lastMessage;
  const isMine = !!lastMsg && lastMsg.senderId === currentUserId;

  const chatName = isDirect
    ? item.peer?.displayName || item.peer?.username || 'Kullanıcı'
    : item.name || 'Sohbet Odası';

  // Çevrimiçi gizliliği: ben kapattıysam başkalarının çevrimiçi durumunu göremem (reciprocal)
  const canSeeOnline = myLastSeenVisibility !== 'NOBODY';
  const isPeerOnline = isDirect && canSeeOnline && item.peer?.status === 'ONLINE';

  // Okundu bilgisi: oda sohbetlerinde her zaman aktiftir.
  // Direkt (DM) sohbetlerde kullanıcı okundu bilgisini kapattıysa karşı tarafın okundu bilgisini de alamaz.
  const canShowReadReceipt = !isDirect || myReadReceipts !== false;
  const isRead =
    canShowReadReceipt &&
    !!item.othersReadAt &&
    !!lastMsg?.createdAt &&
    new Date(item.othersReadAt).getTime() >= new Date(lastMsg.createdAt).getTime();

  const handlePress = useCallback(() => onPress(item), [onPress, item]);
  const handleLongPress = useCallback(() => onLongPress(item), [onLongPress, item]);

  return (
    <TouchableOpacity
      style={[styles.roomItem, item.isPinned && styles.roomItemPinned]}
      onPress={handlePress}
      onLongPress={handleLongPress}
      activeOpacity={0.65}
    >
      {/* Chrono Avatar */}
      <ChronoAvatar
        size={48}
        uri={isDirect ? item.peer?.avatarUrl : item.iconUrl}
        name={chatName}
        emoji={!isDirect && item.name?.startsWith('🔥') ? '🔥' : undefined}
        online={isPeerOnline}
        badge={!isDirect && isLiveVoice ? 'mic' : 'none'}
        style={{ marginRight: 14 }}
      />

      {/* Sohbet Bilgileri */}
      <View style={styles.roomDetails}>
        <View style={styles.roomHeader}>
          <View style={styles.roomNameRow}>
            <Text style={styles.roomName} numberOfLines={1}>
              {chatName}
            </Text>

            {item.isPinned && (
              <Ionicons name="pin" size={13} color={colors.primaryLight} style={styles.pinIcon} />
            )}
            {item.isMuted && (
              <Ionicons
                name="volume-mute"
                size={13}
                color={colors.textSecondary}
                style={styles.muteIcon}
              />
            )}
          </View>

          <View style={styles.metaRight}>
            {isMine && (
              <ChronoProgressRing
                status={isRead ? 'read' : 'sent'}
                size={10}
              />
            )}
            <Text style={styles.timestamp}>
              {formatListTimestamp(item.lastMessageAt || item.updatedAt || item.createdAt)}
            </Text>
          </View>
        </View>

        <View style={styles.lastMessageRow}>
          {hasActiveVoice ? (
            <View style={styles.voicePreviewRow}>
              <Ionicons name="mic" size={13} color="#10B981" style={styles.readIcon} />
              <Text style={styles.voicePreviewText} numberOfLines={1}>
                <Text style={styles.voicePreviewHighlight}>
                  {voiceCount} {getTranslation('voiceChatPeople', 'kişi sesli sohbette')}
                </Text>
                {` • ${getTranslation('joinNow', 'Hemen katıl')}`}
              </Text>
            </View>
          ) : (
            <Text style={styles.lastMessageText} numberOfLines={1}>
              {!isDirect && lastMsg?.sender?.displayName ? (
                <Text style={styles.lastMessageSender}>{lastMsg.sender.displayName}: </Text>
              ) : null}
              {lastMsg?.type === 'CALL'
                ? formatCallPreview(lastMsg.content, isMine)
                : lastMsg?.content || (lastMsg?.ciphertext ? '🔒 Şifreli mesaj' : '')}
            </Text>
          )}

          {/* Okunmamış veya Canlı Ses Rozeti */}
          {hasActiveVoice ? (
            <View style={styles.liveTagBadge}>
              <Text style={styles.liveTagText}>CANLI</Text>
            </View>
          ) : item.unreadCount && item.unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount}</Text>
            </View>
          ) : null}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  pinIcon: {
    marginLeft: 6,
  },
  muteIcon: {
    marginLeft: 4,
  },
  readIcon: {
    marginRight: 4,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  callBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E3B5C',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
  },
  callBannerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
  },
  callBannerSubtitle: {
    fontSize: 12,
    color: '#FFFFFF',
  },
  callBannerButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  callBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
    backgroundColor: colors.background,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: colors.textPrimary,
    letterSpacing: 0.3,
  },
  moreBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: colors.background,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16212E',
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: colors.textPrimary,
    paddingVertical: 0,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 10,
    gap: 8,
  },
  tabButton: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#16212E',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  listContent: {
    paddingBottom: 110,
  },
  emptyListContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  roomItem: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    // Sabit yükseklik: getItemLayout ile ölçüm yapılmadan anında sanallaştırma
    height: ROOM_ITEM_HEIGHT,
    alignItems: 'center',
  },
  roomItemPinned: {
    backgroundColor: 'rgba(56, 189, 248, 0.04)',
  },
  avatarWrapper: {
    position: 'relative',
    marginRight: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 52,
    height: 52,
    borderRadius: 26,
  },
  avatarText: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '700',
  },
  onlineBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.background,
  },
  liveVoiceBadge: {
    position: 'absolute',
    bottom: -1,
    right: -1,
    backgroundColor: colors.voiceActive,
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.background,
  },
  roomDetails: {
    flex: 1,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    paddingBottom: 10,
    justifyContent: 'center',
  },
  roomHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  roomNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  roomName: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  metaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  lastMessageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  lastMessageText: {
    color: colors.textSecondary,
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  lastMessageSender: {
    color: colors.primaryLight,
    fontWeight: '500',
  },
  voicePreviewRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  voicePreviewText: {
    color: '#10B981',
    fontSize: 13,
    flex: 1,
  },
  voicePreviewHighlight: {
    fontWeight: '700',
    color: '#10B981',
  },
  unreadBadge: {
    backgroundColor: colors.primary,
    minWidth: 22,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  unreadBadgeText: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '700',
  },
  liveTagBadge: {
    backgroundColor: colors.voiceActive,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  liveTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  brandIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  liveVoiceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.15)',
  },
  liveVoiceCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  liveDotIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10B981',
    marginRight: 10,
  },
  liveVoiceTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 2,
  },
  liveVoiceSubtitle: {
    fontSize: 12,
    color: '#38BDF8',
  },
  liveJoinBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
  },
  liveJoinBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
  fab: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 8,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    zIndex: 99,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  menuOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-start',
    alignItems: 'flex-end',
    paddingTop: 54,
    paddingRight: 16,
  },
  menuCard: {
    backgroundColor: '#1A243B',
    borderRadius: 14,
    minWidth: 210,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    elevation: 14,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  menuDivider: {
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginVertical: 4,
  },
  actionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(5, 8, 16, 0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  actionModalContainer: {
    width: '100%',
    maxWidth: 360,
  },
  actionHighlightedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101728',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.8,
    borderColor: '#2563EB',
    marginBottom: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 10,
  },
  actionHighlightedDetails: {
    flex: 1,
    marginLeft: 12,
  },
  actionHighlightedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actionHighlightedTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  actionHighlightedTime: {
    color: '#7E8BA6',
    fontSize: 12,
  },
  actionHighlightedFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  actionHighlightedLastMsg: {
    color: '#94A3B8',
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  actionHighlightedBadge: {
    backgroundColor: '#2563EB',
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionHighlightedBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  actionModalCard: {
    backgroundColor: '#101726',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#1C273E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 14,
  },
  actionModalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
  },
  actionModalRowLast: {
    borderBottomWidth: 0,
  },
  actionModalRowText: {
    fontSize: 15,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  skeletonContainer: {
    paddingVertical: 8,
  },
  skeletonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  skeletonAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    marginRight: 14,
  },
  skeletonContent: {
    flex: 1,
    justifyContent: 'center',
  },
  skeletonHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  skeletonTitle: {
    width: '45%',
    height: 14,
    borderRadius: 7,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  skeletonTime: {
    width: '15%',
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  skeletonSubtitle: {
    width: '75%',
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  emptySubtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  directSearchContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  directSearchHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directSearchHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  userSearchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.05)',
    gap: 14,
  },
  userSearchAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userSearchName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  userSearchUsername: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptySearchText: {
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 24,
    fontSize: 14,
  },
});
