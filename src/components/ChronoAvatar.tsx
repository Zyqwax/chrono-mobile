import React, { memo } from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { chronoTheme } from '../theme/colors';

const { colors } = chronoTheme;

export type AvatarSizePreset = 'sm' | 'md' | 'lg' | 'xl' | 'xxl';

interface ChronoAvatarProps {
  size?: AvatarSizePreset | number;
  uri?: string | null;
  name?: string;
  emoji?: string;
  online?: boolean;
  showRing?: boolean;
  ringColor?: string;
  badge?: 'camera' | 'mic' | 'none';
  backgroundColor?: string;
  style?: ViewStyle;
}

const SIZE_MAP: Record<AvatarSizePreset, number> = {
  sm: 38,
  md: 48,
  lg: 56,
  xl: 84,
  xxl: 104,
};

export const ChronoAvatar = memo(function ChronoAvatar({
  size = 'md',
  uri,
  name = 'U',
  emoji,
  online = false,
  showRing = true,
  ringColor = '#2563EB',
  badge = 'none',
  backgroundColor,
  style,
}: ChronoAvatarProps) {
  const innerSize = typeof size === 'number' ? size : SIZE_MAP[size] || 48;
  const padding = showRing ? (innerSize >= 80 ? 6 : 4) : 0;
  const outerSize = innerSize + padding * 2;
  const dotSize = innerSize >= 80 ? 5 : innerSize >= 50 ? 3.5 : 2.5;

  // 3-nokta pozisyonları (Dış çemberin sağ yayında)
  const radius = outerSize / 2;
  const dotOffset = outerSize >= 90 ? 4 : 2;

  // 3 nokta: üst (-32°), orta (0°), alt (+32°)
  const angleRad = 0.55; // ~31.5 derece
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  // Orta nokta
  const midX = outerSize - dotSize - dotOffset;
  const midY = radius - dotSize / 2;

  // Üst nokta
  const topX = radius + (radius - dotSize / 2 - dotOffset) * cosA - dotSize / 2;
  const topY = radius - (radius - dotSize / 2 - dotOffset) * sinA - dotSize / 2;

  // Alt nokta
  const botX = topX;
  const botY = radius + (radius - dotSize / 2 - dotOffset) * sinA - dotSize / 2;

  // İlk harf
  const initial = (name || 'U').trim().charAt(0).toUpperCase();

  // Arka plan rengi belirleme
  const fallbackBg =
    backgroundColor ||
    (emoji
      ? '#131B2E'
      : (name?.charCodeAt(0) || 0) % 3 === 0
        ? '#1D4ED8'
        : (name?.charCodeAt(0) || 0) % 3 === 1
          ? '#0284C7'
          : '#7C3AED');

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize }, style]}>
      {/* Chrono İmzası Çemberi */}
      {showRing && (
        <>
          <View
            style={[
              styles.ring,
              {
                width: outerSize,
                height: outerSize,
                borderRadius: outerSize / 2,
                borderColor: ringColor,
                borderWidth: innerSize >= 80 ? 2.5 : 1.8,
              },
            ]}
          />
        </>
      )}

      {/* İç Avatar (Görsel veya Metin/Simge) */}
      <View
        style={[
          styles.inner,
          {
            width: innerSize,
            height: innerSize,
            borderRadius: innerSize / 2,
            backgroundColor: fallbackBg,
          },
        ]}
      >
        {uri ? (
          <Image
            source={{ uri }}
            style={[
              styles.image,
              {
                width: innerSize,
                height: innerSize,
                borderRadius: innerSize / 2,
              },
            ]}
          />
        ) : emoji ? (
          <Text style={{ fontSize: innerSize * 0.52 }}>{emoji}</Text>
        ) : (
          <Text
            style={[
              styles.initialText,
              { fontSize: innerSize * 0.42, fontWeight: '700' },
            ]}
          >
            {initial}
          </Text>
        )}
      </View>

      {/* Çevrim içi Durum Rozeti */}
      {online && (
        <View
          style={[
            styles.onlineBadge,
            {
              width: Math.max(10, innerSize * 0.22),
              height: Math.max(10, innerSize * 0.22),
              borderRadius: Math.max(5, innerSize * 0.11),
              right: padding,
              bottom: padding,
            },
          ]}
        />
      )}

      {/* Kamera Rozeti (Profil düzenleme için) */}
      {badge === 'camera' && (
        <View
          style={[
            styles.cameraBadge,
            {
              width: innerSize >= 80 ? 30 : 22,
              height: innerSize >= 80 ? 30 : 22,
              borderRadius: innerSize >= 80 ? 15 : 11,
              right: 0,
              bottom: 0,
            },
          ]}
        >
          <Ionicons
            name="camera"
            size={innerSize >= 80 ? 15 : 11}
            color="#FFFFFF"
          />
        </View>
      )}

      {/* Canlı Mikrofon Rozeti */}
      {badge === 'mic' && (
        <View
          style={[
            styles.micBadge,
            {
              width: Math.max(16, innerSize * 0.28),
              height: Math.max(16, innerSize * 0.28),
              borderRadius: Math.max(8, innerSize * 0.14),
              right: padding,
              bottom: padding,
            },
          ]}
        >
          <Ionicons name="mic" size={Math.max(10, innerSize * 0.16)} color="#FFFFFF" />
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    borderStyle: 'solid',
    opacity: 0.95,
  },
  dot: {
    position: 'absolute',
    backgroundColor: '#38BDF8',
    zIndex: 2,
  },
  inner: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  image: {
    resizeMode: 'cover',
  },
  initialText: {
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  onlineBadge: {
    position: 'absolute',
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: colors.background,
    zIndex: 3,
  },
  cameraBadge: {
    position: 'absolute',
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.background,
    zIndex: 4,
  },
  micBadge: {
    position: 'absolute',
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: colors.background,
    zIndex: 3,
  },
});
