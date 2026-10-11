import dayjs from 'dayjs';
import isToday from 'dayjs/plugin/isToday';
import isYesterday from 'dayjs/plugin/isYesterday';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

import 'dayjs/locale/tr';
import 'dayjs/locale/en';
import 'dayjs/locale/de';
import 'dayjs/locale/fr';
import 'dayjs/locale/es';
import 'dayjs/locale/ru';
import 'dayjs/locale/ar';

dayjs.extend(isToday);
dayjs.extend(isYesterday);
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

/**
 * Cihazın varsayılan sistem dilini tespit eder (ör. 'tr', 'en', 'de', vb.)
 */
export function getDeviceLanguage(): string {
  try {
    const loc = Intl?.DateTimeFormat?.().resolvedOptions()?.locale || 'en';
    const lang = loc.split('-')[0].toLowerCase();
    return lang;
  } catch {
    return 'en';
  }
}

const currentLang = getDeviceLanguage();
try {
  dayjs.locale(currentLang);
} catch {
  dayjs.locale('en');
}

export const isTurkish = currentLang === 'tr';

// Yerelleştirilmiş sohbet ve durum sözlüğü
const DICTIONARY: Record<string, Record<string, string>> = {
  tr: {
    today: 'Bugün',
    yesterday: 'Dün',
    online: 'çevrimiçi',
    lastSeenRecently: 'son görülme yakınlarda',
    lastSeenAt: 'son görülme',
    typing: 'yazıyor...',
    min: 'dk',
    sec: 'sn',
    incomingAudio: 'Gelen sesli arama',
    incomingVideo: 'Gelen görüntülü arama',
    outgoingAudio: 'Giden sesli arama',
    outgoingVideo: 'Giden görüntülü arama',
    missedAudio: 'Cevapsız arama',
    missedVideo: 'Cevapsız görüntülü arama',
    callLog: 'Arama kaydı',
    voiceChatPeople: 'kişi sesli sohbette',
    joinNow: 'Hemen katıl',
    member: 'üye',
  },
  en: {
    today: 'Today',
    yesterday: 'Yesterday',
    online: 'online',
    lastSeenRecently: 'last seen recently',
    lastSeenAt: 'last seen',
    typing: 'typing...',
    min: 'min',
    sec: 'sec',
    incomingAudio: 'Incoming voice call',
    incomingVideo: 'Incoming video call',
    outgoingAudio: 'Outgoing voice call',
    outgoingVideo: 'Outgoing video call',
    missedAudio: 'Missed voice call',
    missedVideo: 'Missed video call',
    callLog: 'Call log',
    voiceChatPeople: 'in voice chat',
    joinNow: 'Join now',
    member: 'members',
  },
  de: {
    today: 'Heute',
    yesterday: 'Gestern',
    online: 'online',
    lastSeenRecently: 'zuletzt kürzlich gesehen',
    lastSeenAt: 'zuletzt gesehen',
    typing: 'schreibt...',
    min: 'Min.',
    sec: 'Sek.',
    incomingAudio: 'Eingehender Sprachanruf',
    incomingVideo: 'Eingehender Videoanruf',
    outgoingAudio: 'Ausgehender Sprachanruf',
    outgoingVideo: 'Ausgehender Videoanruf',
    missedAudio: 'Verpasster Sprachanruf',
    missedVideo: 'Verpasster Videoanruf',
    callLog: 'Anrufprotokoll',
    voiceChatPeople: 'im Sprachchat',
    joinNow: 'Jetzt beitreten',
    member: 'Mitglieder',
  },
  es: {
    today: 'Hoy',
    yesterday: 'Ayer',
    online: 'en línea',
    lastSeenRecently: 'últ. vez recientemente',
    lastSeenAt: 'últ. vez',
    typing: 'escribiendo...',
    min: 'min',
    sec: 'seg',
    incomingAudio: 'Llamada de voz entrante',
    incomingVideo: 'Videollamada entrante',
    outgoingAudio: 'Llamada de voz saliente',
    outgoingVideo: 'Videollamada saliente',
    missedAudio: 'Llamada de voz perdida',
    missedVideo: 'Videollamada perdida',
    callLog: 'Registro de llamadas',
    voiceChatPeople: 'en chat de voz',
    joinNow: 'Unirse ahora',
    member: 'miembros',
  },
};

export function getTranslation(key: string, fallback?: string): string {
  const dict = DICTIONARY[currentLang] || DICTIONARY.en;
  return dict[key] || DICTIONARY.en[key] || fallback || key;
}

/**
 * Arama kaydı önizleme metni (Ör. 📞 Gelen sesli arama, 📹 Cevapsız görüntülü arama)
 */
export function formatCallPreview(content?: string, isMe?: boolean): string {
  if (!content) return `📞 ${getTranslation('callLog', 'Arama kaydı')}`;
  try {
    const data = JSON.parse(content);
    const isMissed =
      !isMe && (data.status === 'missed' || data.status === 'declined' || data.status === 'busy');
    if (data.video) {
      if (isMissed) return `📹 ${getTranslation('missedVideo', 'Cevapsız görüntülü arama')}`;
      return isMe
        ? `📹 ${getTranslation('outgoingVideo', 'Giden görüntülü arama')}`
        : `📹 ${getTranslation('incomingVideo', 'Gelen görüntülü arama')}`;
    }
    if (isMissed) return `📞 ${getTranslation('missedAudio', 'Cevapsız arama')}`;
    return isMe
      ? `📞 ${getTranslation('outgoingAudio', 'Giden sesli arama')}`
      : `📞 ${getTranslation('incomingAudio', 'Gelen sesli arama')}`;
  } catch {
    return `📞 ${getTranslation('callLog', 'Arama kaydı')}`;
  }
}

// Performans için önbellek
const timeCache = new Map<string, string>();
const MAX_CACHE = 500;

/**
 * Mesaj saati: '14:05' / '2:05 PM'
 */
export function formatTime(dateStr?: string | Date | number | null): string {
  if (!dateStr) return '';
  const key = String(dateStr);
  const cached = timeCache.get(key);
  if (cached !== undefined) return cached;

  let out = '';
  try {
    const d = dayjs(dateStr);
    out = d.isValid() ? d.format('HH:mm') : '';
  } catch {
    out = '';
  }

  if (timeCache.size >= MAX_CACHE) timeCache.clear();
  timeCache.set(key, out);
  return out;
}

/**
 * Sohbet ekranı gün ayracı (Date badge):
 * - Bugün: "Bugün" (TR) / "Today" (EN)
 * - Dün: "Dün" (TR) / "Yesterday" (EN)
 * - Aynı yıl: "10 Ekim" (TR) / "October 10" (EN)
 * - Farklı yıl: "10 Ekim 2024" (TR) / "October 10, 2024" (EN)
 */
export function formatChatDay(dateVal?: string | Date | number | null): string {
  if (!dateVal) return '';
  try {
    const d = dayjs(dateVal);
    if (!d.isValid()) return '';

    if (d.isToday()) {
      return getTranslation('today', 'Bugün');
    }
    if (d.isYesterday()) {
      return getTranslation('yesterday', 'Dün');
    }

    const now = dayjs();
    if (d.isSame(now, 'year')) {
      return currentLang === 'en' ? d.format('MMMM D') : d.format('D MMMM');
    }
    return currentLang === 'en' ? d.format('MMMM D, YYYY') : d.format('D MMMM YYYY');
  } catch {
    return '';
  }
}

/**
 * Sohbet listesindeki son mesaj zaman damgası (Chat list):
 * - Bugün: "14:25"
 * - Dün: "Dün" / "Yesterday"
 * - Son 6 gün: "Pazartesi" / "Monday" (haftanın günü)
 * - Bu yıl: "10 Eki" / "Oct 10"
 * - Önceki yıllar: "10/10/2024" / "10.10.2024"
 */
export function formatListTimestamp(dateStr?: string | Date | number | null): string {
  if (!dateStr) return '';
  try {
    const d = dayjs(dateStr);
    if (!d.isValid()) return '';

    const now = dayjs();
    if (d.isToday()) {
      return d.format('HH:mm');
    }
    if (d.isYesterday()) {
      return getTranslation('yesterday', 'Dün');
    }

    const diffDays = now.diff(d, 'day');
    if (diffDays >= 0 && diffDays < 6) {
      const dayName = d.format('dddd');
      return dayName.charAt(0).toUpperCase() + dayName.slice(1);
    }

    if (d.isSame(now, 'year')) {
      return currentLang === 'en' ? d.format('MMM D') : d.format('D MMM');
    }
    return currentLang === 'en' ? d.format('MM/DD/YYYY') : d.format('DD.MM.YYYY');
  } catch {
    return '';
  }
}

/**
 * Arama süresi biçimlendirme:
 * - TR: "1 dk 7 sn", "40 sn"
 * - EN: "1 min 7 sec", "40 sec"
 */
export function formatCallDuration(secs: number): string {
  if (secs <= 0) return '';
  const mins = Math.floor(secs / 60);
  const remainingSecs = secs % 60;
  const minUnit = getTranslation('min', 'dk');
  const secUnit = getTranslation('sec', 'sn');

  if (mins > 0) {
    return `${mins} ${minUnit}${remainingSecs > 0 ? ` ${remainingSecs} ${secUnit}` : ''}`;
  }
  return `${remainingSecs} ${secUnit}`;
}

/**
 * Son görülme metni:
 * - ONLINE: "çevrimiçi" / "online"
 * - HIDDEN / null: "son görülme yakınlarda" / "last seen recently"
 * - Tarih ile: "son görülme bugün 14:05" / "last seen today at 14:05"
 */
export function formatLastSeen(
  status?: string | null,
  lastSeenAt?: string | Date | number | null,
): { text: string; isOnline: boolean } {
  if (status === 'ONLINE') {
    return { text: getTranslation('online', 'çevrimiçi'), isOnline: true };
  }

  if (!lastSeenAt || status === 'HIDDEN') {
    return { text: getTranslation('lastSeenRecently', 'son görülme yakınlarda'), isOnline: false };
  }

  try {
    const d = dayjs(lastSeenAt);
    if (!d.isValid()) {
      return { text: getTranslation('lastSeenRecently', 'son görülme yakınlarda'), isOnline: false };
    }

    const timeStr = d.format('HH:mm');
    if (d.isToday()) {
      const prefix = getTranslation('lastSeenAt', 'son görülme');
      return {
        text: currentLang === 'en' ? `last seen today at ${timeStr}` : `${prefix} bugün ${timeStr}`,
        isOnline: false,
      };
    }
    if (d.isYesterday()) {
      const prefix = getTranslation('lastSeenAt', 'son görülme');
      return {
        text: currentLang === 'en' ? `last seen yesterday at ${timeStr}` : `${prefix} dün ${timeStr}`,
        isOnline: false,
      };
    }
    const dayStr = currentLang === 'en' ? d.format('MMM D') : d.format('D MMMM');
    const prefix = getTranslation('lastSeenAt', 'son görülme');
    return {
      text: `${prefix} ${dayStr}`,
      isOnline: false,
    };
  } catch {
    return { text: getTranslation('lastSeenRecently', 'son görülme yakınlarda'), isOnline: false };
  }
}
