import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Room } from "../../types";
import { ChronoAvatar } from "../ChronoAvatar";

interface ForwardMessageModalProps {
  visible: boolean;
  selectedCount: number;
  rooms: Room[];
  currentRoomId: string;
  currentUserId?: string;
  onClose: () => void;
  onForward: (targetRoom: Room) => void;
}

export const ForwardMessageModal: React.FC<ForwardMessageModalProps> = ({
  visible,
  selectedCount,
  rooms,
  currentRoomId,
  currentUserId,
  onClose,
  onForward,
}) => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const isDirect = r.type === "DIRECT";
      const name = isDirect
        ? r.peer?.displayName || r.peer?.username || "Kullanıcı"
        : r.name || "Sohbet Odası";
      return name.toLowerCase().includes(searchQuery.trim().toLowerCase());
    });
  }, [rooms, searchQuery]);

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Header */}
              <View style={styles.headerRow}>
                <View style={styles.headerLeft}>
                  <Text style={styles.sheetTitle}>Mesajı İlet</Text>
                  <Text style={styles.sheetSubtitle}>
                    {selectedCount > 1 ? `${selectedCount} mesaj seçildi` : "1 mesaj seçildi"}
                  </Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={22} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Arama Kutusu */}
              <View style={styles.searchBar}>
                <Ionicons name="search" size={17} color="#64748B" style={{ marginRight: 8 }} />
                <TextInput
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="Sohbet veya kişi ara..."
                  placeholderTextColor="#64748B"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={() => setSearchQuery("")} activeOpacity={0.7}>
                    <Ionicons name="close-circle" size={16} color="#64748B" />
                  </TouchableOpacity>
                )}
              </View>

              {/* Sohbet Listesi */}
              <FlatList
                data={filteredRooms}
                keyExtractor={(item) => item.id}
                style={styles.roomsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => {
                  const isDirect = item.type === "DIRECT";
                  const title = isDirect
                    ? item.peer?.displayName || item.peer?.username || "Kullanıcı"
                    : item.name || "Sohbet Odası";
                  const avatarUri = isDirect ? item.peer?.avatarUrl : item.iconUrl;
                  const isCurrent = item.id === currentRoomId;

                  return (
                    <TouchableOpacity
                      style={styles.roomItemRow}
                      onPress={() => onForward(item)}
                      activeOpacity={0.7}
                    >
                      <ChronoAvatar size={42} uri={avatarUri} name={title} style={{ marginRight: 12 }} />
                      <View style={styles.roomItemInfo}>
                        <View style={styles.titleRow}>
                          <Text style={styles.roomItemTitle} numberOfLines={1}>
                            {title}
                          </Text>
                          {isCurrent && <Text style={styles.currentBadge}>Şu anki sohbet</Text>}
                        </View>
                        <Text style={styles.roomItemSubtitle} numberOfLines={1}>
                          {isDirect
                            ? `@${item.peer?.username || "kullanici"}`
                            : `${item.membersCount || 2} üye`}
                        </Text>
                      </View>
                      <View style={styles.forwardIconCircle}>
                        <Ionicons name="arrow-redo" size={16} color="#38BDF8" />
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>İletilecek sohbet bulunamadı</Text>
                  </View>
                }
              />
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.72)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    maxHeight: "80%",
    backgroundColor: "#101726",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 24,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  headerLeft: {
    gap: 2,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  sheetSubtitle: {
    fontSize: 13,
    color: "#38BDF8",
    fontWeight: "500",
  },
  closeBtn: {
    padding: 6,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
  },
  searchInput: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 14,
    paddingVertical: 0,
  },
  roomsList: {
    maxHeight: 380,
  },
  roomItemRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 14,
  },
  roomItemInfo: {
    flex: 1,
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  roomItemTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#FFFFFF",
    flexShrink: 1,
  },
  currentBadge: {
    fontSize: 10,
    color: "#64748B",
    backgroundColor: "rgba(255, 255, 255, 0.06)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  roomItemSubtitle: {
    fontSize: 12,
    color: "#94A3B8",
    marginTop: 2,
  },
  forwardIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "#64748B",
    fontSize: 14,
  },
});
