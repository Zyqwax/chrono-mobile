import * as Updates from 'expo-updates';
import { Alert } from 'react-native';

export interface UpdateCheckResult {
  isAvailable: boolean;
  error?: string;
}

/**
 * OTA (Over-The-Air) güncelleme kontrol ve yükleme servisi.
 */
class UpdateService {
  private isChecking = false;

  /**
   * Yeni bir JS/Asset güncellemesi var mı denetler.
   * @param silent - true ise arka planda sessiz çalışır, false ise kullanıcıya bilgilendirme kutusu gösterir.
   */
  async checkAndApplyUpdates(silent = true): Promise<UpdateCheckResult> {
    // Geliştirme ortamında (Expo Go / local dev) OTA güncellemeleri devre dışıdır
    if (__DEV__) {
      if (!silent) {
        Alert.alert(
          'Geliştirici Modu',
          'Geliştirici ortamında OTA güncellemeleri aktif değildir. Sadece APK / Production derlemelerinde çalışır.',
        );
      }
      return { isAvailable: false };
    }

    if (this.isChecking) {
      return { isAvailable: false };
    }

    this.isChecking = true;

    try {
      console.log('🔄 OTA Güncellemesi kontrol ediliyor...');
      const checkResult = await Updates.checkForUpdateAsync();

      if (checkResult.isAvailable) {
        console.log('📦 Yeni güncelleme bulundu, indiriliyor...');
        await Updates.fetchUpdateAsync();
        console.log('✅ Yeni güncelleme başarıyla indirildi.');

        if (!silent) {
          Alert.alert(
            'Güncelleme Hazır! 🚀',
            'Chrono için yeni bir güncelleme indirildi. Yeni özellikleri kullanmak için uygulama şimdi yeniden başlatılsın mı?',
            [
              { text: 'Daha Sonra', style: 'cancel' },
              {
                text: 'Yeniden Başlat',
                onPress: () => {
                  Updates.reloadAsync().catch(console.error);
                },
              },
            ],
          );
        } else {
          // Sessiz mod: Kullanıcıyı rahatsız etmeden nazikçe sor veya bir sonraki açılışta aktif et
          Alert.alert(
            'Chrono Güncellendi ✨',
            'Yeni sürüm arka planda hazırlandı. Güncellemeyi şimdi uygulamak ister misiniz?',
            [
              { text: 'Sonraki Açılışta', style: 'cancel' },
              {
                text: 'Şimdi Uygula',
                onPress: () => {
                  Updates.reloadAsync().catch(console.error);
                },
              },
            ],
          );
        }

        return { isAvailable: true };
      } else {
        console.log('✨ Uygulama zaten en son sürümde.');
        if (!silent) {
          Alert.alert(
            'Uygulama Güncel',
            'Chrono şu an en son sürümü kullanıyor. Yeni bir güncelleme bulunmuyor.',
          );
        }
        return { isAvailable: false };
      }
    } catch (err: any) {
      console.warn('OTA Güncelleme kontrol hatası:', err?.message || err);
      if (!silent) {
        Alert.alert(
          'Güncelleme Hatası',
          'Güncellemeler kontrol edilirken bir sorun oluştu: ' + (err?.message || 'Ağ bağlantınızı kontrol edin.'),
        );
      }
      return { isAvailable: false, error: err?.message };
    } finally {
      this.isChecking = false;
    }
  }

  /**
   * Mevcut çalışan sürüm bilgilerini döner.
   */
  getUpdateMetadata() {
    return {
      updateId: Updates.updateId || 'embedded',
      channel: Updates.channel || 'development',
      isEmbedded: Updates.isEmbeddedLaunch,
      runtimeVersion: Updates.runtimeVersion || '1.0.0',
    };
  }
}

export const updateService = new UpdateService();
