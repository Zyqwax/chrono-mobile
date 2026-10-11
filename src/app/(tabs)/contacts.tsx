import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { chronoTheme } from '../../theme/colors';
import { useChatStore } from '../../store/useChatStore';
import { useShallow } from 'zustand/react/shallow';
import { Contact } from '../../types';
import { api } from '../../services/api';
import { ChronoAvatar } from '../../components/ChronoAvatar';

const { colors } = chronoTheme;

export default function ContactsScreen() {
  const router = useRouter();
  const {
    contacts,
    fetchContacts,
    addContact,
    removeContact,
    openDirect,
    setActiveRoom,
  } = useChatStore(
    useShallow((s) => ({
      contacts: s.contacts,
      fetchContacts: s.fetchContacts,
      addContact: s.addContact,
      removeContact: s.removeContact,
      openDirect: s.openDirect,
      setActiveRoom: s.setActiveRoom,
    })),
  );

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);

  // Global arama state'leri
  const [globalResults, setGlobalResults] = useState<any[]>([]);
  const [searchingGlobal, setSearchingGlobal] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchReqIdRef = useRef(0);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    setLoading(true);
    await fetchContacts();
    setLoading(false);
  };

  const handleSearchChange = useCallback((text: string) => {
    setSearch(text);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);

    const query = text.trim().replace(/^@/, '');
    if (!query) {
      searchReqIdRef.current++;
      setGlobalResults([]);
      setSearchingGlobal(false);
      return;
    }

    setSearchingGlobal(true);
    searchTimerRef.current = setTimeout(async () => {
      const reqId = ++searchReqIdRef.current;
      try {
        const res = await api.get('/users/search', { params: { q: query } });
        if (reqId === searchReqIdRef.current) {
          setGlobalResults(res.data);
        }
      } catch {
        // Hata durumunda sessiz kal
      } finally {
        if (reqId === searchReqIdRef.current) setSearchingGlobal(false);
      }
    }, 300);
  }, []);

  const handleContactPress = useCallback(
    async (contact: Contact) => {
      try {
        const direct = await openDirect(contact.user.id);
        setActiveRoom(direct);
        router.push({ pathname: '/chat/[id]', params: { id: direct.id } });
      } catch (err: any) {
        Alert.alert('Hata', err.response?.data?.message || 'Sohbet açılamadı');
      }
    },
    [openDirect, setActiveRoom, router],
  );

  const handleAddUserAsContact = async (user: any) => {
    try {
      await addContact(user.id);
      await fetchContacts();
      Alert.alert('Başarılı', `${user.displayName} kişilerinize eklendi.`);
    } catch (err: any) {
      Alert.alert('Hata', err.response?.data?.message || 'Kişi eklenemedi');
    }
  };

  const handleContactLongPress = useCallback(
    (contact: Contact) => {
      Alert.alert(
        contact.user.displayName,
        `@${contact.user.username}`,
        [
          {
            text: 'Mesaj Gönder',
            onPress: () => handleContactPress(contact),
          },
          {
            text: 'Kişiyi Sil',
            style: 'destructive',
            onPress: () => removeContact(contact.user.id),
          },
          { text: 'İptal', style: 'cancel' },
        ],
      );
    },
    [handleContactPress, removeContact],
  );

  // Yerel kişileri filtrele
  const filteredContacts = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.trim().toLowerCase().replace(/^@/, '');
    return contacts.filter((c) => {
      const name = (c.nickname || c.user.displayName || '').toLowerCase();
      const username = (c.user.username || '').toLowerCase();
      return name.includes(q) || username.includes(q);
    });
  }, [contacts, search]);

  // Global arama sonuçlarından zaten kayıtlı kişileri çıkar
  const filteredGlobalResults = useMemo(() => {
    const contactUserIds = new Set(contacts.map((c) => c.user.id));
    return globalResults.filter((u) => !contactUserIds.has(u.id));
  }, [globalResults, contacts]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Kişiler</Text>
      </View>

      {/* Arama Çubuğu */}
      <View style={styles.searchSection}>
        <View
          style={[
            styles.searchBar,
            searchFocused && styles.searchBarFocused,
          ]}
        >
          <Ionicons name="search" size={18} color="#64748B" style={{ marginRight: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="@kullanici_adi ara..."
            placeholderTextColor="#64748B"
            value={search}
            onChangeText={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            autoCapitalize="none"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => handleSearchChange('')}>
              <Ionicons name="close-circle" size={18} color="#64748B" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Liste */}
      <FlatList
        data={filteredContacts}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadContacts}
        ListHeaderComponent={
          <>
            {/* KİŞİLERİN Bölümü */}
            <Text style={styles.sectionHeader}>KİŞİLERİN</Text>
            {filteredContacts.length === 0 && !loading && (
              <Text style={styles.emptyText}>Kayıtlı kişi bulunamadı.</Text>
            )}
          </>
        }
        renderItem={({ item }) => {
          const title = item.nickname || item.user.displayName;
          const isOnline = item.user.status === 'ONLINE';
          return (
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => handleContactPress(item)}
              onLongPress={() => handleContactLongPress(item)}
              activeOpacity={0.7}
            >
              <ChronoAvatar
                size={44}
                name={title}
                uri={item.user.avatarUrl}
                online={isOnline}
                style={{ marginRight: 14 }}
              />
              <View style={styles.contactDetails}>
                <Text style={styles.contactName} numberOfLines={1}>
                  {title}
                </Text>
                <Text style={styles.contactUsername} numberOfLines={1}>
                  @{item.user.username}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => handleContactPress(item)}
                style={styles.messageBtn}
              >
                <Ionicons name="chatbubble-outline" size={20} color="#8A93A8" />
              </TouchableOpacity>
            </TouchableOpacity>
          );
        }}
        ListFooterComponent={
          <>
            {/* CHRONO'DA BUL Bölümü (Global arama sonuçları) */}
            {search.trim().length > 0 && (
              <>
                <Text style={[styles.sectionHeader, { marginTop: 24 }]}>
                  CHRONO'DA BUL
                </Text>

                {searchingGlobal ? (
                  <ActivityIndicator
                    color="#38BDF8"
                    style={{ marginVertical: 14 }}
                  />
                ) : filteredGlobalResults.length > 0 ? (
                  filteredGlobalResults.map((user) => (
                    <View key={user.id} style={styles.contactItem}>
                      <ChronoAvatar
                        size={44}
                        name={user.displayName || user.username}
                        uri={user.avatarUrl}
                        style={{ marginRight: 14 }}
                      />
                      <View style={styles.contactDetails}>
                        <Text style={styles.contactName} numberOfLines={1}>
                          {user.displayName}
                        </Text>
                        <Text style={styles.contactUsername} numberOfLines={1}>
                          @{user.username}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleAddUserAsContact(user)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.addBtnText}>Ekle</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.emptyText}>Chrono'da kullanıcı bulunamadı.</Text>
                )}
              </>
            )}

            {/* Bilgi Kartı */}
            <View style={styles.tipCard}>
              <Text style={styles.tipCardText}>
                Kişi eklemek için tam kullanıcı adını yaz. Ayrı bir ekleme ekranı gerekmiyor.
              </Text>
            </View>
          </>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  searchSection: {
    paddingHorizontal: 16,
    paddingBottom: 14,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111827',
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  searchBarFocused: {
    borderColor: '#2563EB',
    backgroundColor: '#131D33',
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 120,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.8,
    marginBottom: 12,
    marginTop: 8,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  contactDetails: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 3,
  },
  contactUsername: {
    fontSize: 13,
    color: '#64748B',
  },
  messageBtn: {
    padding: 8,
  },
  addBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2563EB',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyText: {
    color: '#64748B',
    fontSize: 13,
    paddingVertical: 8,
  },
  tipCard: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginTop: 28,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  tipCardText: {
    color: '#8A93A8',
    fontSize: 13,
    lineHeight: 20,
  },
});
