import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ChatRoomScreen } from '../../components/ChatRoomScreen';
import { useChatStore } from '../../store/useChatStore';
import { chronoTheme } from '../../theme/colors';

const { colors } = chronoTheme;

export default function ChatDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Sadece bu odaya abone ol: başka odalardaki değişiklikler bu ekranı render etmez
  const room = useChatStore(
    (s) => s.rooms.find((r) => r.id === id) || (s.activeRoom?.id === id ? s.activeRoom : null),
  );
  const hasRoom = !!room;

  useEffect(() => {
    if (!hasRoom && id) {
      setLoading(true);
      useChatStore
        .getState()
        .fetchRooms()
        .finally(() => setLoading(false));
    }
  }, [id, hasRoom]);

  // Bildirim / deep link ile gelindiğinde aktif odayı ayarla
  useEffect(() => {
    if (!hasRoom || !id) return;
    const { activeRoom, rooms, setActiveRoom } = useChatStore.getState();
    if (activeRoom?.id !== id) {
      const target = rooms.find((r) => r.id === id);
      if (target) setActiveRoom(target);
    }
  }, [id, hasRoom]);

  // Ekrandan çıkarken aktif odayı temizle (hook'lar koşullu return'den önce olmalı)
  useEffect(() => {
    return () => {
      const { activeRoom, setActiveRoom } = useChatStore.getState();
      if (activeRoom?.id === id) {
        setActiveRoom(null);
      }
    };
  }, [id]);

  const handleBack = useCallback(() => {
    router.back();
  }, [router]);

  if (loading) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primaryLight} />
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.centerContainer} edges={['top', 'left', 'right']}>
        <Ionicons name="chatbubbles-outline" size={48} color={colors.textSecondary} />
        <Text style={styles.notFoundText}>Sohbet odası bulunamadı.</Text>
        <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.rootContainer}>
      <ChatRoomScreen room={room} onBack={handleBack} />
    </View>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  notFoundText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginTop: 16,
    marginBottom: 24,
  },
  backBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: colors.primary,
    borderRadius: 20,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
});
