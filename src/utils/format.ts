/**
 * Önbellekli tarih/saat biçimlendiricileri.
 * `toLocaleTimeString` her çağrıda yeni bir Intl formatter oluşturur ve Hermes'te pahalıdır;
 * listelerde yüzlerce kez çağrıldığında kaydırma ve geçişlerde takılmaya yol açar.
 */

let timeFormatter: Intl.DateTimeFormat | null = null;
let dateFormatter: Intl.DateTimeFormat | null = null;

try {
  timeFormatter = new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' });
  dateFormatter = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' });
} catch {
  // Intl desteklenmiyorsa aşağıdaki yedek yollar kullanılır
}

const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);

// Aynı zaman damgaları tekrar tekrar biçimlendirilmesin diye küçük bir önbellek
const timeCache = new Map<string, string>();
const MAX_CACHE = 500;

export function formatTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const cached = timeCache.get(dateStr);
  if (cached !== undefined) return cached;

  let out = '';
  try {
    const d = new Date(dateStr);
    out = timeFormatter ? timeFormatter.format(d) : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    out = '';
  }

  if (timeCache.size >= MAX_CACHE) timeCache.clear();
  timeCache.set(dateStr, out);
  return out;
}

export function formatListTimestamp(dateStr?: string | null): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const now = new Date();
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      return timeFormatter ? timeFormatter.format(d) : `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return dateFormatter ? dateFormatter.format(d) : `${d.getDate()}/${d.getMonth() + 1}`;
  } catch {
    return '';
  }
}

export function formatChatDay(dateVal?: string | Date | number | null): string {
  if (!dateVal) return '';
  try {
    const d = new Date(dateVal);
    const now = new Date();
    if (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    ) {
      return 'Bugün';
    }

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (
      d.getFullYear() === yesterday.getFullYear() &&
      d.getMonth() === yesterday.getMonth() &&
      d.getDate() === yesterday.getDate()
    ) {
      return 'Dün';
    }

    const months = [
      'Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran',
      'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık',
    ];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  } catch {
    return '';
  }
}
