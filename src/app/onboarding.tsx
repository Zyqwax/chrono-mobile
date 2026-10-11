import React from 'react';
import {
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { chronoTheme } from '../theme/colors';
import { useChatStore } from '../store/useChatStore';

const { colors } = chronoTheme;

export default function OnboardingScreen() {
  const router = useRouter();
  const currentUser = useChatStore((s) => s.currentUser);

  // Zaten oturum açılmışsa doğrudan ana sekmelere yönlendir
  React.useEffect(() => {
    if (currentUser) {
      router.replace('/(tabs)');
    }
  }, [currentUser, router]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom', 'left', 'right']}>
      {/* ------------------------------------------------------------- */}
      {/* 1. Üst Kısım: Canlı Mesajlaşma Önizleme Balonları (Screenshot 1) */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.previewContainer}>
        {/* Balon 1 - Gelen */}
        <View style={styles.bubbleReceived}>
          <Text style={styles.bubbleReceivedText}>
            Bu akşam odada buluşuyor muyuz?
          </Text>
        </View>

        {/* Balon 2 - Giden (Chrono Mavi) */}
        <View style={styles.bubbleSent}>
          <Text style={styles.bubbleSentText}>
            Tabii, sesli odayı açıyorum
          </Text>
        </View>

        {/* Balon 3 - Gelen */}
        <View style={styles.bubbleReceived}>
          <Text style={styles.bubbleReceivedText}>
            Geliyorum
          </Text>
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* 2. Orta Kısım: Chrono Logosu, Marka Adı, Slogan & Noktalar       */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.centerSection}>
        {/* Yuvarlatılmış Chrono Logosu */}
        <View style={styles.logoBadgeContainer}>
          <Image
            source={require('../../assets/app-icon-rounded.png')}
            style={styles.logoImage}
            resizeMode="cover"
          />
        </View>

        {/* Marka Adı */}
        <Text style={styles.brandTitle}>Chrono</Text>

        {/* Slogan */}
        <Text style={styles.brandSubtitle}>
          Dünyanın en hızlı mesajlaşma{'\n'}uygulaması. Ücretsiz ve güvenli.
        </Text>

        {/* 5 Noktalı Gösterge (Aktif: Uzun Mavi Hap, Diğerleri: Koyu Nokta) */}
        <View style={styles.paginationRow}>
          <View style={styles.pillActive} />
          <View style={styles.dotInactive} />
          <View style={styles.dotInactive} />
          <View style={styles.dotInactive} />
          <View style={styles.dotInactive} />
        </View>
      </View>

      {/* ------------------------------------------------------------- */}
      {/* 3. Alt Kısım: Aksiyon Butonları                                 */}
      {/* ------------------------------------------------------------- */}
      <View style={styles.bottomSection}>
        {/* Birincil Buton: "Mesajlaşmaya Başla" */}
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.push('/auth')}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryBtnText}>Mesajlaşmaya Başla</Text>
          <View style={styles.primaryBtnIconCircle}>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </View>
        </TouchableOpacity>

        {/* İkincil Buton: "Zaten hesabım var" */}
        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.push('/auth')}
          activeOpacity={0.7}
        >
          <Text style={styles.secondaryBtnText}>Zaten hesabım var</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F1A', // Chrono Deep Night
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  // Üst Mesajlaşma Önizlemesi
  previewContainer: {
    paddingTop: 36,
    paddingHorizontal: 4,
  },
  bubbleReceived: {
    backgroundColor: '#121A2A',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    borderTopLeftRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignSelf: 'flex-start',
    maxWidth: '84%',
    marginBottom: 14,
  },
  bubbleReceivedText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  bubbleSent: {
    backgroundColor: '#2563EB', // Chrono Mavi
    borderRadius: 20,
    borderTopRightRadius: 6,
    paddingHorizontal: 18,
    paddingVertical: 13,
    alignSelf: 'flex-end',
    maxWidth: '84%',
    marginBottom: 14,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 4,
  },
  bubbleSentText: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },

  // Orta Marka Alanı
  centerSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 'auto',
  },
  logoBadgeContainer: {
    width: 78,
    height: 78,
    borderRadius: 26,
    overflow: 'hidden',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.25)',
  },
  logoImage: {
    width: '100%',
    height: '100%',
  },
  brandTitle: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 20,
    letterSpacing: 0.4,
  },
  brandSubtitle: {
    fontSize: 15.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 10,
    paddingHorizontal: 20,
  },
  paginationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 24,
  },
  pillActive: {
    width: 26,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#38BDF8', // Canlı mavi/cyan hap
  },
  dotInactive: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#1E293B',
  },

  // Alt Butonlar
  bottomSection: {
    paddingBottom: 20,
    width: '100%',
  },
  primaryBtn: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563EB', // Chrono Mavi
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 14,
    elevation: 8,
  },
  primaryBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    flex: 1,
    textAlign: 'center',
    marginLeft: 36, // İkonla ortalamayı dengelemek için
  },
  primaryBtnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  secondaryBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
