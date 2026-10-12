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

  const strokeWidth = innerSize >= 80 ? 2.8 : 1.8;
  const radius = outerSize / 2;
  const R = radius - strokeWidth / 2;

  // 3-nokta pozisyonları: üst (-34°), orta (0°), alt (+34°)
  const angleRad = 0.58;
  const cosA = Math.cos(angleRad);
  const sinA = Math.sin(angleRad);

  const topX = radius + R * cosA - dotSize / 2;
  const topY = radius - R * sinA - dotSize / 2;
  const midX = radius + R - dotSize / 2;
  const midY = radius - dotSize / 2;
  const botX = radius + R * cosA - dotSize / 2;
  const botY = radius + R * sinA - dotSize / 2;

  // İlk harf
  const initial = (name || 'U').trim().charAt(0).toUpperCase();

  // Arka plan rengi belirleme (Görsellerdeki Chrono Koyu Lacivert Zemin Stili)
  const fallbackBg = backgroundColor || '#121A2C';
  const letterColor = ringColor === '#10B981' ? '#34D399' : '#60A5FA';

  return (
    <View style={[styles.root, { width: outerSize, height: outerSize }, style]}>
      {/* Chrono İmzası Çemberi */}
      {showRing && (
        <>
          {/* Sönük arka plan izi */}
          <View
            style={[
              styles.ring,
              {
                width: outerSize,
                height: outerSize,
                borderRadius: outerSize / 2,
                borderColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: strokeWidth,
              },
            ]}
          />
          {/* Aktif Renkli Yay (Sağ taraf 3 nokta için açık) */}
          <View
            style={[
              styles.ring,
              {
                width: outerSize,
                height: outerSize,
                borderRadius: outerSize / 2,
                borderColor: ringColor,
                borderRightColor: 'transparent',
                borderWidth: strokeWidth,
              },
            ]}
          />
          {/* Chrono 3 İkonik Nokta */}
          <View
            style={[
              styles.dot,
              {
                left: topX,
                top: topY,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: ringColor,
              },
            ]}
          />
          <View
            style={[
              styles.dot,
              {
                left: midX,
                top: midY,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: ringColor,
              },
            ]}
          />
          <View
            style={[
              styles.dot,
              {
                left: botX,
                top: botY,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: ringColor,
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
              { fontSize: innerSize * 0.44, fontWeight: '700', color: letterColor },
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
