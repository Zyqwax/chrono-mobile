/**
 * Chrono Mobile Brand & Theme Configuration
 * Tüm renk paleti, marka gradyanları ve tema değişkenleri tek merkezden yönetilir.
 */

export const chronoTheme = {
  colors: {
    // 🌌 Temel Zemin & Yüzey Renkleri (Chrono Deep Night / Telegram Stili)
    background: '#0B0F1A',          // Ana ekran arka planı (En koyu zemin)
    backgroundSecondary: '#0E1424', // Liste / feed arka planı
    surface: '#151D30',             // Üst bar, alt bar ve kartlar
    surfaceElevated: '#1A243B',     // Açılır menüler, modal ve dialoglar
    surfaceActive: '#22304E',       // Seçili/tıklanan satır efekti

    // ⚡ Chrono Marka Renkleri & Vurguları (Chrono Brand Palette)
    primary: '#2563EB',             // Chrono mavi (Ana aksiyon rengi)
    primaryLight: '#38BDF8',        // Açık camgöbeği (İkonik vurgu / aktif tab)
    primaryDark: '#1D4ED8',         // Koyu mavi (Basılı durumlar)
    accentPurple: '#7C3AED',        // Chrono marka moru (Logo degrade ucu)
    accentGlow: 'rgba(37, 99, 235, 0.25)', // Parlama / Aura efekti

    // 💬 Telegram Tarzı Sohbet Balonları
    bubbleSent: '#2563EB',          // Giden mesaj balonu (Chrono Mavi)
    bubbleSentText: '#FFFFFF',
    bubbleReceived: '#182236',      // Gelen mesaj balonu (Koyu Lacivert)
    bubbleReceivedText: '#FFFFFF',
    bubbleTime: 'rgba(255, 255, 255, 0.55)',
    bubbleSentTime: 'rgba(255, 255, 255, 0.75)',

    // 🔤 Metin Renkleri
    textPrimary: '#FFFFFF',         // Ana beyaz başlıklar ve mesajlar
    textSecondary: '#8A93A8',       // Alt başlıklar, saat damgaları, gri açıklamalar
    textMuted: '#58627A',           // İpucu ve pasif metinler
    textLink: '#38BDF8',            // Bağlantı ve etiketler

    // 🎛️ Çerçeve, Çizgi & Input
    border: '#1F2B45',              // Kart ve ayırıcı sınır çizgileri
    borderLight: '#283756',
    inputBackground: '#101626',     // Metin kutusu arka planı
    inputPlaceholder: '#62708E',

    // 🟢 Durum & Rozet Renkleri
    badge: '#2563EB',               // Okunmamış mesaj bildirim yuvarlağı
    badgeText: '#FFFFFF',
    badgeSecondary: '#38BDF8',
    online: '#10B981',              // Çevrim içi yeşil nokta
    offline: '#64748B',
    error: '#EF4444',               // Hata bildirimleri
    warning: '#F59E0B',
    success: '#10B981',

    // 🎙️ Canlı Ses & Canlı Yayın
    voiceActive: '#10B981',         // Konuşuyor parlaması
    voiceBarBg: '#151D30',
    voiceBarBorder: '#2563EB',

    // ⚙️ Telegram Tarzı Ayarlar İkon Renkleri
    settingsAccount: '#0284C7',
    settingsChat: '#EA580C',
    settingsPrivacy: '#16A34A',
    settingsNotifications: '#DC2626',
    settingsData: '#0284C7',
    settingsFolders: '#2563EB',
    settingsDevices: '#0D9488',
    settingsBattery: '#EA580C',
    settingsLanguage: '#9333EA',
    settingsPremium: '#6366F1',
    settingsLogout: '#EF4444',
  },

  // Marka Degrade Geçişleri
  gradients: {
    chronoMark: ['#38BDF8', '#2563EB', '#7C3AED'] as const,
    primaryButton: ['#38BDF8', '#2563EB'] as const,
    voiceWave: ['#2563EB', '#38BDF8'] as const,
  },

  // Boyut & Kavis Ayarları
  radius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 22,
    full: 9999,
  },
} as const;

export type ChronoTheme = typeof chronoTheme;
export default chronoTheme;
