import { Alert, Linking, PermissionsAndroid, Platform } from 'react-native';

/**
 * Android 12+ (API 31+) Bluetooth Connect iznini çalışma zamanında ister.
 * İzin reddedilse bile aramanın çökmeden normal şekilde (hoparlör/ahize ile) devam
 * edebilmesi için hata fırlatmaz, false döner.
 */
export async function requestBluetoothPermissions(): Promise<boolean> {
  if (Platform.OS === 'android' && Platform.Version >= 31) {
    try {
      const bluetoothConnectPerm = (PermissionsAndroid.PERMISSIONS as any).BLUETOOTH_CONNECT;
      if (!bluetoothConnectPerm) return true;

      const hasPerm = await PermissionsAndroid.check(bluetoothConnectPerm);
      if (hasPerm) return true;

      const result = await PermissionsAndroid.request(bluetoothConnectPerm);
      return result === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('BLUETOOTH_CONNECT izni istenirken hata:', err);
      return false;
    }
  }
  return true;
}

/**
 * Arama başlamadan veya odaya bağlanmadan hemen önce ses ve bluetooth izinlerini kontrol eder/ister.
 */
export async function requestAudioPermissions(): Promise<{ micGranted: boolean; bluetoothGranted: boolean }> {
  let micGranted = true;
  let bluetoothGranted = true;

  if (Platform.OS === 'android') {
    try {
      const micStatus = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
      micGranted = micStatus === PermissionsAndroid.RESULTS.GRANTED;

      bluetoothGranted = await requestBluetoothPermissions();
    } catch (err) {
      console.warn('requestAudioPermissions hatası:', err);
    }
  }

  return { micGranted, bluetoothGranted };
}

/**
 * Arama başlatılmadan veya kabul edilmeden önce mikrofon, kamera ve bluetooth izinlerini önceden sorgular.
 * Kullanıcı ilk kez arama yapıyorsa izinler arama başlatılmadan hemen önce istenir.
 * Zorunlu izin (mikrofon) verilmezse arama başlatılmaz ve kullanıcı bilgilendirilir.
 */
export async function requestCallPermissions(video = false): Promise<boolean> {
  if (Platform.OS === 'android') {
    try {
      // Android 12+ Bluetooth iznini arka planda iste (reddedilse bile arama devam edebilir)
      requestBluetoothPermissions().catch(() => {});

      const permsToCheck: string[] = [PermissionsAndroid.PERMISSIONS.RECORD_AUDIO];
      if (video) {
        permsToCheck.push(PermissionsAndroid.PERMISSIONS.CAMERA);
      }

      // Önce mevcut izin durumlarını kontrol et
      const needRequest: string[] = [];
      for (const perm of permsToCheck) {
        const hasPerm = await PermissionsAndroid.check(perm as any);
        if (!hasPerm) {
          needRequest.push(perm);
        }
      }

      // Eğer tüm izinler zaten verilmişse doğrudan devam et
      if (needRequest.length === 0) {
        return true;
      }

      // İzinleri kullanıcıdan talep et
      const results = await PermissionsAndroid.requestMultiple(needRequest as any);

      // RECORD_AUDIO kontrolü
      const micStatus =
        results[PermissionsAndroid.PERMISSIONS.RECORD_AUDIO] ??
        (needRequest.includes(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO)
          ? PermissionsAndroid.RESULTS.DENIED
          : PermissionsAndroid.RESULTS.GRANTED);

      if (micStatus !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert(
          'Mikrofon İzni Gerekli',
          'Arama gerçekleştirebilmek ve sesinizi iletebilmek için mikrofon erişimine izin vermeniz gerekmektedir.',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Ayarları Aç',
              onPress: () => {
                Linking.openSettings().catch(() => {});
              },
            },
          ],
        );
        return false;
      }

      // CAMERA kontrolü (Eğer görüntülü arama ise)
      if (video) {
        const camStatus =
          results[PermissionsAndroid.PERMISSIONS.CAMERA] ??
          (needRequest.includes(PermissionsAndroid.PERMISSIONS.CAMERA)
            ? PermissionsAndroid.RESULTS.DENIED
            : PermissionsAndroid.RESULTS.GRANTED);

        if (camStatus !== PermissionsAndroid.RESULTS.GRANTED) {
          Alert.alert(
            'Kamera İzni Gerekli',
            'Görüntülü arama yapabilmek için kamera erişimine izin vermeniz gerekmektedir.',
            [
              { text: 'Vazgeç', style: 'cancel' },
              {
                text: 'Ayarları Aç',
                onPress: () => {
                  Linking.openSettings().catch(() => {});
                },
              },
            ],
          );
          return false;
        }
      }

      return true;
    } catch (err) {
      console.warn('requestCallPermissions hatası:', err);
      return false;
    }
  }

  // iOS ortamında mikrofon ve kamera izinleri sistem tarafından veya WebRTC katmanında yönetilir
  return true;
}
