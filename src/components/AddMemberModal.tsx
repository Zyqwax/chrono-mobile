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
import { api } from '../services/api';
import { User } from '../types';
import { chronoTheme } from '../theme/colors';

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

  useEffect(() => {
    if (visible) {
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
      onMemberAdded();
      loadUsers(search);
    } catch (err: any) {
      Alert.alert(
        'Hata',
        err.response?.data?.message || 'Üye eklenirken bir hata oluştu',
      );
    } finally {
      setAddingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.card} edges={['bottom']}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Üye Ekle</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Search bar */}
          <View style={styles.searchBar}>
            <Ionicons
              name="search"
              size={18}
              color={colors.textSecondary}
              style={{ marginRight: 8 }}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="İsim veya kullanıcı adı ara..."
              placeholderTextColor={colors.inputPlaceholder}
              value={search}
              onChangeText={(t) => {
                setSearch(t);
                loadUsers(t);
              }}
            />
          </View>

          {/* User List */}
          {loading ? (
            <ActivityIndicator color={colors.primaryLight} style={{ marginVertical: 40 }} />
          ) : (
            <FlatList
              data={users}
              keyExtractor={(item) => item.id}
              contentContainerStyle={{ paddingBottom: 20 }}
              renderItem={({ item }) => (
                <View style={styles.userRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {item.displayName?.charAt(0).toUpperCase() || 'U'}
                    </Text>
                  </View>
                  <View style={styles.userInfo}>
                    <Text style={styles.name}>{item.displayName}</Text>
                    <Text style={styles.username}>@{item.username}</Text>
                  </View>
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
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>Eklenebilecek kullanıcı bulunamadı</Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.surfaceElevated, // #1A243B
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    height: '75%',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBackground,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: colors.textPrimary,
    fontSize: 14,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  avatarText: {
    color: colors.primaryLight,
    fontSize: 16,
    fontWeight: '700',
  },
  userInfo: {
    flex: 1,
  },
  name: {
    color: colors.textPrimary,
    fontSize: 15,
    fontWeight: '600',
  },
  username: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  addBtn: {
    backgroundColor: colors.primary, // #2563EB
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 14,
  },
  addBtnText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 40,
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
});
