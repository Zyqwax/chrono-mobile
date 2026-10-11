import React, { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

export type ChronoRingStatus = 'pending' | 'sent' | 'read';

interface ChronoProgressRingProps {
  status: ChronoRingStatus;
  size?: number;
}

/**
 * Chrono Zaman Akışı / Halka Kadranı (Progress Ring)
 * - Gönderiliyor: Kesikli dönen mikro kadran (dashed rotating spinner)
 * - İletildi: 180° yarısı dolu kadran yayı (half-filled ring + center pivot)
 * - Okundu: 360° tam dolu neon parıltılı Chrono halkası (spring animasyonlu dolum)
 */
export const ChronoProgressRing: React.FC<ChronoProgressRingProps> = React.memo(
  ({ status, size = 12 }) => {
    // 1. Gönderiliyor için dönme animasyonu
    const spinAnim = useRef(new Animated.Value(0)).current;

    // 2. Okundu durumuna geçişte yaylanma (spring) ve parıldama animasyonu
    const scaleAnim = useRef(new Animated.Value(status === 'read' ? 1 : 0.8)).current;
    const glowAnim = useRef(new Animated.Value(status === 'read' ? 1 : 0)).current;

    useEffect(() => {
      let loop: Animated.CompositeAnimation | null = null;
      if (status === 'pending') {
        spinAnim.setValue(0);
        loop = Animated.loop(
          Animated.timing(spinAnim, {
            toValue: 1,
            duration: 900,
            easing: Easing.linear,
            useNativeDriver: true,
          }),
        );
        loop.start();
      } else {
        spinAnim.setValue(0);
      }

      if (status === 'read') {
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 5,
            tension: 90,
            useNativeDriver: true,
          }),
          Animated.timing(glowAnim, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start();
      } else {
        scaleAnim.setValue(1);
        glowAnim.setValue(0);
      }

      return () => {
        if (loop) loop.stop();
      };
    }, [status]);

    const spinInterpolate = spinAnim.interpolate({
      inputRange: [0, 1],
      outputRange: ['0deg', '360deg'],
    });

    const half = size / 2;
    const strokeWidth = size >= 14 ? 1.6 : 1.35;

    // -------------------------------------------------------------
    // DURUM 1: GÖNDERİLİYOR (Kesikli Dönen Mikro Çizgi)
    // -------------------------------------------------------------
    if (status === 'pending') {
      return (
        <View style={[styles.container, { width: size, height: size }]}>
          <Animated.View
            style={[
              styles.ringBase,
              {
                width: size,
                height: size,
                borderRadius: half,
                borderWidth: strokeWidth,
                borderColor: 'rgba(255, 255, 255, 0.18)',
                borderTopColor: '#38BDF8',
                borderRightColor: '#38BDF8',
                transform: [{ rotate: spinInterpolate }],
              },
            ]}
          />
        </View>
      );
    }

    // -------------------------------------------------------------
    // DURUM 2: İLETİLDİ (180 Derece Yay / Yarısı Dolu Halka)
    // -------------------------------------------------------------
    if (status === 'sent') {
      return (
        <View style={[styles.container, { width: size, height: size }]}>
          {/* Arka plan sönük 360° iz */}
          <View
            style={[
              styles.ringBase,
              {
                width: size,
                height: size,
                borderRadius: half,
                borderWidth: strokeWidth,
                borderColor: 'rgba(255, 255, 255, 0.22)',
              },
            ]}
          />
          {/* Ön plan: 180° dolu yay (üst ve sağ kadran) */}
          <View
            style={[
              StyleSheet.absoluteFill,
              styles.ringBase,
              {
                width: size,
                height: size,
                borderRadius: half,
                borderWidth: strokeWidth,
                borderColor: 'transparent',
                borderTopColor: '#94A3B8',
                borderRightColor: '#94A3B8',
              },
            ]}
          />
          {/* Minik saat kadranı merkezi pimi */}
          <View
            style={[
              styles.centerPivot,
              {
                backgroundColor: '#94A3B8',
                width: Math.max(2, size * 0.2),
                height: Math.max(2, size * 0.2),
                borderRadius: size * 0.1,
              },
            ]}
          />
        </View>
      );
    }

    // -------------------------------------------------------------
    // DURUM 3: OKUNDU (360 Derece Tam Daire + Neon Parıltı)
    // -------------------------------------------------------------
    return (
      <Animated.View
        style={[
          styles.container,
          {
            width: size,
            height: size,
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.ringBase,
            styles.readRing,
            {
              width: size,
              height: size,
              borderRadius: half,
              borderWidth: strokeWidth,
              borderColor: '#38BDF8',
              backgroundColor: 'rgba(56, 189, 248, 0.24)',
            },
          ]}
        >
          {/* İçi parlayan neon çekirdek noktası */}
          <View
            style={[
              styles.centerPivot,
              {
                backgroundColor: '#38BDF8',
                width: Math.max(3, size * 0.26),
                height: Math.max(3, size * 0.26),
                borderRadius: size * 0.13,
                shadowColor: '#38BDF8',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.95,
                shadowRadius: 2.5,
              },
            ]}
          />
        </Animated.View>
      </Animated.View>
    );
  },
);

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 4,

  },
  ringBase: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerPivot: {
    position: 'absolute',
  },
  readRing: {
    shadowColor: '#38BDF8',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.55,
    shadowRadius: 3,
  },
});
