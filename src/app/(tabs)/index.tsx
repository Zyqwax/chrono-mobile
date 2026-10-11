import React, { useCallback } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { RoomsListScreen } from '../../components/RoomsListScreen';
import { useChatStore } from '../../store/useChatStore';
import { chronoTheme } from '../../theme/colors';
import { Room } from '../../types';

const { colors } = chronoTheme;

const containerStyle = { flex: 1, backgroundColor: colors.background };

export default function ChatsTab() {
  const router = useRouter();

  // Stabil callback'ler: liste satırları gereksiz yere yeniden render olmaz
  const handleSelectRoom = useCallback(
    (room: Room) => {
      // Önbellekteki mesajlar anında hazır olsun diye aktif odayı push'tan önce ayarla
      useChatStore.getState().setActiveRoom(room);
      router.push({
        pathname: '/chat/[id]',
        params: { id: room.id },
      });
    },
    [router],
  );

  const handleOpenAuth = useCallback(() => {
    router.push('/auth');
  }, [router]);

  return (
    <View style={containerStyle}>
      <RoomsListScreen onSelectRoom={handleSelectRoom} onOpenAuth={handleOpenAuth} />
    </View>
  );
}
