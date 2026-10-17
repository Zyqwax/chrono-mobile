import * as ImageManipulator from "expo-image-manipulator";

export interface ProcessImageOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number; // 0 to 1
  rotate?: number;
  flipHorizontal?: boolean;
  crop?: {
    originX: number;
    originY: number;
    width: number;
    height: number;
  };
}

/**
 * Fotoğrafı sıkıştırır, boyutunu optimize eder, kırpar/döndürür ve EXIF/GPS metadatalarını temizler.
 * expo-image-manipulator manipülasyon işlemi sonrasında yeni bir JPEG/PNG dosyası oluştururken
 * orijinal EXIF/GPS profil etiketlerini aktarmaz, böylece gizlilik korunur.
 */
export async function processAndOptimizeImage(
  uri: string,
  options: ProcessImageOptions = {},
): Promise<{ uri: string; width: number; height: number }> {
  const actions: ImageManipulator.Action[] = [];

  // Kırpma işlemi varsa
  if (options.crop) {
    actions.push({ crop: options.crop });
  }

  // Döndürme işlemi varsa
  if (options.rotate && options.rotate !== 0) {
    actions.push({ rotate: options.rotate });
  }

  // Çevirme işlemi varsa
  if (options.flipHorizontal) {
    actions.push({ flip: ImageManipulator.FlipType.Horizontal });
  }

  // Maksimum genişlik ve yükseklik boyutlandırma (boyut düşürme)
  const maxW = options.maxWidth || 1920;
  const maxH = options.maxHeight || 1920;

  actions.push({
    resize: {
      width: maxW,
    },
  });

  const quality = options.quality !== undefined ? options.quality : 0.78;

  const result = await ImageManipulator.manipulateAsync(uri, actions, {
    compress: quality,
    format: ImageManipulator.SaveFormat.JPEG,
  });

  return {
    uri: result.uri,
    width: result.width,
    height: result.height,
  };
}
