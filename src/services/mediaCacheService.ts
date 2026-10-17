import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

// Android Scoped Storage medya dizini (WhatsApp / Telegram standardı)
const ANDROID_MEDIA_ROOT = 'file:///storage/emulated/0/Android/media/com.zyqwax.chrono/Chrono';
const FALLBACK_MEDIA_ROOT = `${FileSystem.documentDirectory || ''}Chrono`;

class MediaCacheService {
  private baseDir: string = FALLBACK_MEDIA_ROOT;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;
  private inFlightDownloads: Map<string, Promise<string>> = new Map();

  /**
   * Cihazın işletim sistemine göre en uygun medya depolama yolunu belirler ve klasörleri oluşturur.
   * Android: /storage/emulated/0/Android/media/com.zyqwax.chrono/Chrono/
   * iOS / Fallback: {documentDirectory}/Chrono/
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      try {
        if (Platform.OS === 'android') {
          // Önce harici Scoped Storage medya klasörünü dene
          try {
            const testInfo = await FileSystem.getInfoAsync(ANDROID_MEDIA_ROOT);
            if (!testInfo.exists) {
              await FileSystem.makeDirectoryAsync(ANDROID_MEDIA_ROOT, { intermediates: true });
            }
            this.baseDir = ANDROID_MEDIA_ROOT;
          } catch (androidErr) {
            console.warn(
              '⚠️ [MediaCache] Android harici medya yolu açılamadı, dahili depolama kullanılıyor:',
              androidErr,
            );
            this.baseDir = FALLBACK_MEDIA_ROOT;
            await FileSystem.makeDirectoryAsync(FALLBACK_MEDIA_ROOT, { intermediates: true });
          }
        } else {
          // iOS ve diğer sistemlerde doğrudan güvenli sandbox documentDirectory
          this.baseDir = FALLBACK_MEDIA_ROOT;
          await FileSystem.makeDirectoryAsync(FALLBACK_MEDIA_ROOT, { intermediates: true });
        }

        // Alt dizinleri oluştur
        const imagesDir = this.getImagesDir();
        const voiceDir = this.getVoiceDir();

        await FileSystem.makeDirectoryAsync(imagesDir, { intermediates: true });
        await FileSystem.makeDirectoryAsync(voiceDir, { intermediates: true });

        // Ses kayıtlarının müzik çalar gibi genel uygulamaları kirletmemesi için .nomedia ekle
        try {
          const noMediaVoice = `${voiceDir}/.nomedia`;
          const noMediaInfo = await FileSystem.getInfoAsync(noMediaVoice);
          if (!noMediaInfo.exists) {
            await FileSystem.writeAsStringAsync(noMediaVoice, '');
          }
        } catch {
          // yut
        }

        this.isInitialized = true;
        console.log(`📁 [MediaCache] Medya deposu hazır: ${this.baseDir}`);
      } catch (err) {
        console.error('❌ [MediaCache] Başlatma hatası:', err);
      } finally {
        this.initPromise = null;
      }
    })();

    return this.initPromise;
  }

  private getImagesDir(): string {
    return `${this.baseDir}/Chrono Images`;
  }

  private getVoiceDir(): string {
    return `${this.baseDir}/Chrono Voice`;
  }

  /**
   * Uzaktaki URL'den temiz, güvenli ve benzersiz bir dosya adı üretir.
   */
  getFileNameFromUrl(url: string, type: 'IMAGE' | 'AUDIO'): string {
    try {
      const cleanUrl = url.split('?')[0];
      const segments = cleanUrl.split('/');
      let rawName = segments[segments.length - 1] || '';

      // Eğer dosya adında uzantı yoksa uygun uzantıyı ekle
      const ext = type === 'IMAGE' ? '.jpg' : '.m4a';
      if (!rawName.includes('.')) {
        rawName += ext;
      }
      // Dosya adındaki geçersiz karakterleri temizle
      const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_');
      return safeName.length > 0 ? safeName : `${type.toLowerCase()}_${Date.now()}${ext}`;
    } catch {
      return `${type.toLowerCase()}_${Date.now()}.${type === 'IMAGE' ? 'jpg' : 'm4a'}`;
    }
  }

  /**
   * Verilen URL için yerel hedef dosya yolunu döner.
   */
  getTargetLocalPath(url: string, type: 'IMAGE' | 'AUDIO'): string {
    const fileName = this.getFileNameFromUrl(url, type);
    const folder = type === 'IMAGE' ? this.getImagesDir() : this.getVoiceDir();
    return `${folder}/${fileName}`;
  }

  /**
   * Dosya yerel depolamada zaten önbelleğe alınmış mı kontrol eder.
   * Varsa yerel `file://...` yolunu, yoksa `null` döner.
   */
  async getLocalUriIfCached(url: string, type: 'IMAGE' | 'AUDIO'): Promise<string | null> {
    if (!url) return null;
    if (url.startsWith('file://')) return url;

    await this.init();
    const localPath = this.getTargetLocalPath(url, type);

    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists && info.size && info.size > 0) {
        return localPath;
      }
    } catch {
      // Hata durumunda null dön
    }
    return null;
  }

  /**
   * Medyayı yerel depolamada arar; yoksa arka planda indirip önbelleğe alır.
   * Çağıran bileşene yerel dosya yolunu döner.
   */
  async ensureLocalMedia(
    url: string,
    type: 'IMAGE' | 'AUDIO',
    onDownloaded?: (localUri: string) => void,
  ): Promise<string> {
    if (!url) return url;
    if (url.startsWith('file://')) return url;

    await this.init();
    const localPath = this.getTargetLocalPath(url, type);

    // 1. Zaten var mı kontrol et
    try {
      const info = await FileSystem.getInfoAsync(localPath);
      if (info.exists && info.size && info.size > 0) {
        return localPath;
      }
    } catch {
      // Devam et
    }

    // 2. Halihazırda aynı URL için süren bir indirme var mı?
    if (this.inFlightDownloads.has(url)) {
      return this.inFlightDownloads.get(url)!;
    }

    // 3. İndirme işlemini başlat
    const downloadPromise = (async () => {
      try {
        console.log(`⬇️ [MediaCache] Medya indiriliyor: ${url.slice(0, 40)}... -> ${localPath}`);
        const result = await FileSystem.downloadAsync(url, localPath);
        if (result.status === 200) {
          console.log(`✅ [MediaCache] Başarıyla önbelleklendi: ${localPath}`);
          if (onDownloaded) {
            onDownloaded(result.uri);
          }
          return result.uri;
        }
        return url; // İndirme başarısız olursa orijinal URL'e geri dön
      } catch (err) {
        console.warn('⚠️ [MediaCache] İndirme hatası:', err);
        return url;
      } finally {
        this.inFlightDownloads.delete(url);
      }
    })();

    this.inFlightDownloads.set(url, downloadPromise);
    return downloadPromise;
  }

  /**
   * Kullanıcının çektiği fotoğrafı veya kaydettiği sesi kalıcı Chrono klasörüne kopyalar.
   * Bu sayede kullanıcı kendi gönderdiği medyayı anında cihazdan offline oynatabilir.
   */
  async saveOutgoingMedia(tempUri: string, type: 'IMAGE' | 'AUDIO'): Promise<string> {
    await this.init();
    try {
      const ext = type === 'IMAGE' ? '.jpg' : '.m4a';
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substring(2, 8);
      const fileName = `chrono_${type.toLowerCase()}_${timestamp}_${randomStr}${ext}`;
      const folder = type === 'IMAGE' ? this.getImagesDir() : this.getVoiceDir();
      const destination = `${folder}/${fileName}`;

      await FileSystem.copyAsync({
        from: tempUri,
        to: destination,
      });

      console.log(`💾 [MediaCache] Giden medya kaydedildi: ${destination}`);
      return destination;
    } catch (err) {
      console.warn('⚠️ [MediaCache] Giden medya kopyalama hatası, geçici URI korunuyor:', err);
      return tempUri;
    }
  }
}

export const mediaCacheService = new MediaCacheService();
