import React, { memo, useCallback, useEffect, useRef } from 'react';
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  Pressable,
  View,
  Image,
  Platform,
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
  isProfile?: boolean;
}

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
  insets?: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
}

// Modül seviyesinde sabit: her render'da yeniden oluşturulmaz
const TABS: Record<string, TabConfig> = {
  index: {
    name: 'index',
    label: 'Sohbetler',
    iconActive: 'chatbubble-ellipses',
    iconInactive: 'chatbubble-ellipses-outline',
    showUnread: true,
  },
  contacts: {
    name: 'contacts',
    label: 'Kişiler',
    iconActive: 'people',
    iconInactive: 'people-outline',
  },
  settings: {
    name: 'settings',
    label: 'Ayarlar',
    iconActive: 'settings',
    iconInactive: 'settings-outline',
  },
  profile: {
    name: 'profile',
    label: 'Profil',
    iconActive: 'person-circle',
    iconInactive: 'person-circle-outline',
    isProfile: true,
  },
};

// Kısa, hafif ve native thread üzerinde çalışan hap animasyonu
const PILL_ANIM_DURATION = 160;

interface TabItemProps {
  routeKey: string;
  routeName: string;
  isFocused: boolean;
  badge?: number | string;
  avatarUrl?: string | null;
  avatarInitial: string;
  navigation: ChronoTabBarProps['navigation'];
}

const TabItem = memo(function TabItem({
  routeKey,
  routeName,
  isFocused,
  badge,
  avatarUrl,
  avatarInitial,
  navigation,
}: TabItemProps) {
  const config: TabConfig = TABS[routeName] || {
    name: routeName,
    label: routeName,
    iconActive: 'ellipse',
    iconInactive: 'ellipse-outline',
  };

  const progress = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: isFocused ? 1 : 0,
      duration: PILL_ANIM_DURATION,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [isFocused, progress]);

  const onPress = useCallback(() => {
    if (isFocused) return;
    const event = navigation.emit({
      type: 'tabPress',
      target: routeKey,
      canPreventDefault: true,
    });
    if (!event.defaultPrevented) {
      navigation.navigate(routeName);
    }
  }, [isFocused, navigation, routeKey, routeName]);

  const pillStyle = {
    opacity: progress,
    transform: [
      {
        scaleX: progress.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }),
      },
    ],
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      onPress={onPress}
      style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
    >
      {/* Sabit kavisli Chrono hap kapsülü (Asla köşeli hale gelmez) */}
      <View style={styles.iconCapsule}>
        <Animated.View style={[styles.activePillBackground, pillStyle]} />

        {config.isProfile ? (
          avatarUrl ? (
            <Image
              source={{ uri: avatarUrl }}
              style={[styles.avatarThumb, isFocused && styles.avatarThumbActive]}
            />
          ) : (
            <View style={[styles.avatarFallback, isFocused && styles.avatarFallbackActive]}>
              <Text style={styles.avatarFallbackText}>{avatarInitial}</Text>
            </View>
          )
        ) : (
          <Ionicons
            name={isFocused ? config.iconActive : config.iconInactive}
            size={22}
            color={isFocused ? colors.primaryLight : colors.textSecondary}
          />
        )}

        {/* Okunmamış bildirim hap rozeti */}
        {badge !== undefined && !isFocused && (
          <View style={styles.badgeContainer}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
      </View>

      <Text
        style={[styles.tabLabel, isFocused ? styles.tabLabelActive : styles.tabLabelInactive]}
        numberOfLines={1}
      >
        {config.label}
      </Text>
    </Pressable>
  );
});

const ChronoTabBarComponent: React.FC<ChronoTabBarProps> = ({ state, navigation }) => {
  const insets = useSafeAreaInsets();

  // Sadece primitif değerlere abone ol → yalnızca gerçekten değiştiklerinde yeniden render
  const avatarUrl = useChatStore((s) => s.currentUser?.avatarUrl ?? null);
  const avatarInitial = useChatStore((s) =>
    (s.currentUser?.displayName || s.currentUser?.username || 'U').slice(0, 1).toUpperCase(),
  );
  const totalUnread = useChatStore((s) => {
    let sum = 0;
    for (const r of s.rooms) sum += r.unreadCount || 0;
    return sum;
  });

  const unreadBadge = totalUnread > 0 ? (totalUnread > 99 ? '99+' : totalUnread) : undefined;

  return (
    <View
      style={[styles.container, { bottom: Math.max(insets.bottom, 12) }]}
      pointerEvents="box-none"
    >
      <View style={styles.tabBar}>
        {state.routes.map((route, index) => (
          <TabItem
            key={route.key}
            routeKey={route.key}
            routeName={route.name}
            isFocused={state.index === index}
            badge={TABS[route.name]?.showUnread ? unreadBadge : undefined}
            avatarUrl={avatarUrl}
            avatarInitial={avatarInitial}
            navigation={navigation}
          />
        ))}
      </View>
    </View>
  );
};

export const ChronoTabBar = memo(ChronoTabBarComponent);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    zIndex: 999,
  },
  tabBar: {
    flexDirection: 'row',
    width: '100%',
    height: 64,
    backgroundColor: '#151E2B',
    borderRadius: 32,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: 8,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.45,
        shadowRadius: 10,
      },
      android: {
        elevation: 12,
      },
    }),
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  tabItemPressed: {
    opacity: 0.7,
  },
  iconCapsule: {
    width: 56,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  activePillBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    backgroundColor: '#1E3B5C', // Chrono aktif koyu mavi hap rengi
    overflow: 'hidden',
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 2,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: colors.primaryLight,
    fontWeight: '700',
  },
  tabLabelInactive: {
    color: colors.textSecondary,
  },
  badgeContainer: {
    position: 'absolute',
    top: -2,
    right: 4,
    backgroundColor: colors.primary,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: '#151E2B',
    overflow: 'hidden',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  avatarThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarThumbActive: {
    borderColor: colors.primaryLight,
  },
  avatarFallback: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceActive,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    overflow: 'hidden',
  },
  avatarFallbackActive: {
    backgroundColor: colors.primaryDark,
    borderColor: colors.primaryLight,
  },
  avatarFallbackText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
});
