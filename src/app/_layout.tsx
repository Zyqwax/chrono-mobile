import React, { useEffect } from 'react';
import {
  ActivityIndicator,
  Image,
  StatusBar,
  StyleSheet,
  View,
} from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { useChatStore } from '../store/useChatStore';
import { ActiveCallModal } from '../components/ActiveCallModal';
import { updateService } from '../services/updates';
import { chronoTheme } from '../theme/colors';

const { colors } = chronoTheme;

const chronoDarkTheme = {
  ...DarkTheme,
  dark: true,
  colors: {
    ...DarkTheme.colors,
    primary: colors.primary,
    background: colors.background, // #0B0F1A Chrono Deep Night
    card: colors.surface,
    text: colors.textPrimary,
    border: colors.border,
    notification: colors.primary,
  },
};

// Sabit (stabil referanslı) ekran seçenekleri: her render'da yeni obje üretmez.
// Animasyonlar tamamen native (UI thread) üzerinde çalışır; JS thread'i yormaz.
const STACK_SCREEN_OPTIONS = {
  headerShown: false,
  animation: 'slide_from_right',
  animationDuration: 200,
  gestureEnabled: true,
  fullScreenGestureEnabled: false,
  contentStyle: { backgroundColor: colors.background },
} as const;

const FADE_SCREEN_OPTIONS = {
  animation: 'fade',
  animationDuration: 180,
} as const;

export default function RootLayout() {
  const isAuthenticated = useChatStore((s) => !!s.currentUser);
  const isAuthLoading = useChatStore((s) => s.isAuthLoading);
  const initAuth = useChatStore((s) => s.initAuth);
  const segments = useSegments();
  const router = useRouter();

  // Uygulama başlangıcında kalıcı oturumu yükle
  useEffect(() => {
    initAuth();
  }, []);

  // Uygulama başlangıcında OTA güncelleme kontrolü yap
  useEffect(() => {
    const timer = setTimeout(() => {
      updateService.checkAndApplyUpdates(true).catch(console.warn);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  // Oturum durumuna göre rotaları yönet
  useEffect(() => {
    if (isAuthLoading) return;

    const firstSegment = segments[0] as string | undefined;
    const isAuthRoute = firstSegment === 'auth' || firstSegment === 'onboarding';

    if (!isAuthenticated && !isAuthRoute) {
      // Giriş yapılmamışsa onboarding sayfasına yönlendir
      router.replace('/onboarding');
    } else if (isAuthenticated && isAuthRoute) {
      // Giriş yapılmışsa ana sekmelere yönlendir
      router.replace('/(tabs)');
    }
  }, [isAuthenticated, isAuthLoading, segments]);

  if (isAuthLoading) {
    return (
      <ThemeProvider value={chronoDarkTheme}>
        <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar barStyle="light-content" backgroundColor="#0B0F1A" />
          <View style={styles.splashContainer}>
            <Image
              source={require('../../assets/splash-icon.png')}
              style={styles.splashLogo}
              resizeMode="contain"
            />
            <ActivityIndicator size="large" color="#38BDF8" style={{ marginTop: 24 }} />
          </View>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider value={chronoDarkTheme}>
      <SafeAreaProvider style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <StatusBar barStyle="light-content" backgroundColor="#0B0F1A" />
          <Stack screenOptions={STACK_SCREEN_OPTIONS}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="onboarding" options={FADE_SCREEN_OPTIONS} />
            <Stack.Screen name="auth" />
          </Stack>
          <ActiveCallModal />
        </View>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: colors.background, // #0B0F1A Chrono Deep Night
    alignItems: 'center',
    justifyContent: 'center',
  },
  splashLogo: {
    width: 96,
    height: 96,
  },
});
