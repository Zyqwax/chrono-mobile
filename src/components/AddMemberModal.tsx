import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { api } from '../services/api';
import { User } from '../types';
import { chronoTheme } from '../theme/colors';
import { ChronoAvatar } from './ChronoAvatar';

const { colors, radius } = chronoTheme;

interface AddMemberModalProps {
  visible: boolean;
  roomId: string;
  existingMemberIds: string[];
  onClose: () => void;
  onMemberAdded: () => void;
}

export const AddMemberModal: React.FC<AddMemberModalProps> = ({
  visible,
  roomId,
  existingMemberIds,
  onClose,
  onMemberAdded,
}) => {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<string[]>([]);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (visible) {
      setAddedIds([]);
      setCopiedLink(false);
      loadUsers('');
    }
  }, [visible]);

  const loadUsers = async (query: string) => {
    try {
      setLoading(true);
      const res = await api.get('/users/search', {
        params: { q: query },
      });
      const available = res.data.filter(
        (u: User) => !existingMemberIds.includes(u.id),
      );
      setUsers(available);
    } catch (err) {
      console.error('search error', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (userId: string) => {
    try {
      setAddingId(userId);
      await api.post(`/rooms/${roomId}/members`, { userId });
      setAddedIds((prev) => [...prev, userId]);
      onMemberAdded();
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err.response?.data?.message || 'Üye eklenirken bir hata oluştu',
      );
    } finally {
      setAddingId(null);
    }
  };

  const handleCopyInviteLink = async () => {
    try {
      const inviteUrl = `https://chrono.chat/join/${roomId}`;
      await Clipboard.setStringAsync(inviteUrl);
      setCopiedLink(true);
      Alert.alert('Kopyalandı', 'Davet bağlantısı panoya kopyalandı.');
      setTimeout(() => setCopiedLink(false), 3000);
    } catch (err) {
      console.warn('Clipboard copy error', err);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.card} edges={['bottom']}>
          {/* Sürükleme / Çekme Çubuğu */}
          <View style={styles.dragHandle} />

          {/* Başlık Alanı */}
          <View style={styles.header}>
            <Text style={styles.title}>Üye ekle</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color="#8A95A5" />
            </TouchableOpacity>
          </View>

          {/* Arama Çubuğu */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color="#7E8BA6"
              style={{ marginRight: 10 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya @kullanıcı adı"
              placeholderTextColor="#5A6782"
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                loadUsers(t);
              }}
              autoCapitalize="none"
            />
          </View>

          {/* Kullanıcı Listesi */}
          {loading ? (
            <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 16 }}
              renderItem={({ item }) => {
                const isAdded = addedIds.includes(item.id);
                return (
                  <View style={styles.userRow}>
                    <ChronoAvatar
                      size={44}
                      name={item.displayName || item.username}
                      uri={item.avatarUrl}
                      ringColor="#2563EB"
                      showRing={true}
                    />
                    <View style={styles.userInfo}>
                      <Text style={styles.name} numberOfLines={1}>
                        {item.displayName || item.username}
                      </Text>
                      <Text style={styles.username} numberOfLines={1}>
                        @{item.username}
                      </Text>
                    </View>
                    {isAdded ? (
                      <View style={styles.addedBadge}>
                        <Ionicons name="checkmark" size={16} color="#10B981" />
                        <Text style={styles.addedBadgeText}>Eklendi</Text>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => handleAdd(item.id)}
                        disabled={addingId === item.id}
                        activeOpacity={0.8}
                      >
                        {addingId === item.id ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <Text style={styles.addBtnText}>Ekle</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              }}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Eklenebilecek kullanıcı bulunamadı</Text>
                </View>
              }
            />
          )}

          {/* Alt Davet Bağlantısı Kartı */}
          <View style={styles.inviteLinkCard}>
            <View style={styles.inviteLeft}>
              <View style={styles.inviteIconBox}>
                <Ionicons name="link-outline" size={20} color="#38BDF8" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.inviteTitle}>Davet bağlantısı</Text>
                <Text style={styles.inviteSubtitle} numberOfLines={1}>
                  Aramadan odaya katılsınlar
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.copyBtn, copiedLink && styles.copyBtnDone]}
              onPress={handleCopyInviteLink}
              activeOpacity={0.8}
            >
              <Text style={styles.copyBtnText}>
                {copiedLink ? 'Kopyalandı' : 'Kopyala'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#0D1322', // Ekran 4 Koyu Lacivert Zemin
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    height: '76%',
    borderTopWidth: 1,
    borderTopColor: '#1A243A',
  },
  dragHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#223048',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#141C2C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#101728',
    borderRadius: 23,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#1C273E',
    marginBottom: 16,
    height: 46,
  },
  searchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 10,
  },
  name: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  username: {
    color: '#7E8BA6',
    fontSize: 13,
    marginTop: 2,
  },
  addBtn: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 18,
    paddingVertical: 7,
    borderRadius: 16,
    minWidth: 70,
    alignItems: 'center',
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  addedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addedBadgeText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: '#7E8BA6',
    fontSize: 14,
  },
  inviteLinkCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#101728',
    borderWidth: 1,
    borderColor: '#1C273E',
    borderRadius: 18,
    padding: 14,
    marginTop: 10,
  },
  inviteLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  inviteIconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#162238',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  inviteTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  inviteSubtitle: {
    color: '#7E8BA6',
    fontSize: 12,
    marginTop: 2,
  },
  copyBtn: {
    backgroundColor: '#1E2B45',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A3B5E',
  },
  copyBtnDone: {
    backgroundColor: '#10B981',
    borderColor: '#10B981',
  },
  copyBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
