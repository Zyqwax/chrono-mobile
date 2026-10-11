import React, { memo, useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { chronoTheme } from '../theme/colors';
import { useChatStore } from '../store/useChatStore';

const { colors } = chronoTheme;

interface TabConfig {
  name: string;
  label: string;
  iconActive: keyof typeof Ionicons.glyphMap;
  iconInactive: keyof typeof Ionicons.glyphMap;
  showUnread?: boolean;
}

const TABS: Record<string, TabConfig> = {
  index: {
    name: 'index',
    label: 'Sohbetler',
    iconActive: 'chatbubble',
    iconInactive: 'chatbubble-outline',
    showUnread: true,
  },
  contacts: {
    name: 'contacts',
    label: 'Kişiler',
    iconActive: 'people',
    iconInactive: 'people-outline',
  },
  profile: {
    name: 'profile',
    label: 'Profil',
    iconActive: 'person',
    iconInactive: 'person-outline',
  },
};

export interface ChronoTabBarProps {
  state: {
    routes: Array<{ key: string; name: string }>;
    index: number;
  };
  descriptors: Record<string, any>;
  navigation: {
    emit: (event: any) => any;
    navigate: (name: string) => void;
  };
}

export const ChronoTabBar = memo(function ChronoTabBar({
  state,
  navigation,
  descriptors,
}: ChronoTabBarProps) {
  const insets = useSafeAreaInsets();

  const totalUnread = useChatStore((s) => {
    let sum = 0;
    for (const r of s.rooms) sum += r.unreadCount || 0;
    return sum;
  });

  const unreadBadge = totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined;

  // Sadece tanımlı sekmeleri filtrele (settings vb. gizli sekmeler görünmesin)
  const visibleRoutes = state.routes.filter((route) => {
    const options = descriptors[route.key]?.options;
    if (options?.href === null) return false;
    return !!TABS[route.name];
  });

  return (
    <View
      style={[
        styles.container,
        {
          paddingBottom: Math.max(insets.bottom, 10),
          height: 62 + Math.max(insets.bottom, 10),
        },
      ]}
    >
      <View style={styles.tabRow}>
        {visibleRoutes.map((route) => {
          const isFocused = state.routes[state.index]?.name === route.name;
          const config = TABS[route.name] || {
            name: route.name,
            label: route.name,
            iconActive: 'ellipse',
            iconInactive: 'ellipse-outline',
          };

          const onPress = () => {
            if (isFocused) return;
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              onPress={onPress}
              style={({ pressed }) => [
                styles.tabItem,
                pressed && { opacity: 0.75 },
              ]}
            >
              {isFocused ? (
                /* Aktif Sekme: İkon + Metin + 3 Dikey Nokta */
                <View style={styles.activePill}>
                  <Ionicons
                    name={config.iconActive}
                    size={22}
                    color="#38BDF8"
                    style={{ marginRight: 8 }}
                  />
                  <Text style={styles.activeLabel}>{config.label}</Text>
                </View>
              ) : (
                /* Pasif Sekme: Sadece İkon */
                <View style={styles.inactiveIconWrapper}>
                  <Ionicons
                    name={config.iconInactive}
                    size={24}
                    color="#8A93A8"
                  />
                  {config.showUnread && unreadBadge !== undefined && (
                    <View style={styles.badge}>
                      <Text style={styles.badgeText}>{unreadBadge}</Text>
                    </View>
                  )}
                </View>
              )}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0B0F1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    zIndex: 999,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 16,
    height: 60,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 60,
  },
  activePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(37, 99, 235, 0.15)',
  },
  activeLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38BDF8',
    letterSpacing: 0.2,
  },
  dotsIndicator: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    height: 12,
    marginLeft: 6,
    paddingVertical: 1,
  },
  indicatorDot: {
    width: 2.5,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: '#38BDF8',
  },
  inactiveIconWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 44,
    height: 44,
  },
  badge: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: colors.primary,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '700',
  },
});
