import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { pbkdf2 } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';

// ---------------------------------------------------------------------------
// 1. Güvenli PRNG Kurulumu (Expo Crypto tabanlı)
// ---------------------------------------------------------------------------
nacl.setPRNG((x, n) => {
  const bytes = Crypto.getRandomBytes(n);
  for (let i = 0; i < n; i++) {
    x[i] = bytes[i];
  }
});

const SECURE_STORE_PRIVATE_KEY = '@chrono_e2ee_private_key';
const SECURE_STORE_PUBLIC_KEY = '@chrono_e2ee_public_key';

export interface KeyBackupPayload {
  publicKey: string;
  encryptedPrivateKey: string;
  keyBackupSalt: string;
  keyBackupNonce: string;
}

export interface EncryptedMessagePayload {
  ciphertext: string;
  nonce: string;
  senderPublicKey: string;
}

class CryptoService {
  /** Bellekte ortak Diffie-Hellman sırlarını önbellekle (peerPubKey -> sharedKey) */
  private sharedKeyCache = new Map<string, Uint8Array>();
  private mySecretKey: Uint8Array | null = null;
  private myPublicKey: Uint8Array | null = null;

  /**
   * Cihazdaki güvenli depolamadan (SecureStore) anahtar çiftini yükler.
   */
  async loadKeys(): Promise<boolean> {
    try {
      const [secB64, pubB64] = await Promise.all([
        SecureStore.getItemAsync(SECURE_STORE_PRIVATE_KEY),
        SecureStore.getItemAsync(SECURE_STORE_PUBLIC_KEY),
      ]);

      if (secB64 && pubB64) {
        this.mySecretKey = naclUtil.decodeBase64(secB64);
        this.myPublicKey = naclUtil.decodeBase64(pubB64);
        return true;
      }
      return false;
    } catch (err) {
      console.warn('[CryptoService] loadKeys hatası:', err);
      return false;
    }
  }

  /**
   * Cihazda aktif özel anahtar var mı kontrol eder.
   */
  async hasKeys(): Promise<boolean> {
    if (this.mySecretKey && this.myPublicKey) return true;
    return this.loadKeys();
  }

  /**
   * Aktif açık anahtarı (Base64) döndürür.
   */
  async getMyPublicKey(): Promise<string | null> {
    if (!this.myPublicKey) {
      await this.loadKeys();
    }
    return this.myPublicKey ? naclUtil.encodeBase64(this.myPublicKey) : null;
  }

  /**
   * Anahtar çiftini SecureStore'a kaydeder.
   */
  private async saveKeys(secretKey: Uint8Array, publicKey: Uint8Array): Promise<void> {
    this.mySecretKey = secretKey;
    this.myPublicKey = publicKey;
    this.sharedKeyCache.clear();

    await Promise.all([
      SecureStore.setItemAsync(
        SECURE_STORE_PRIVATE_KEY,
        naclUtil.encodeBase64(secretKey),
      ),
      SecureStore.setItemAsync(
        SECURE_STORE_PUBLIC_KEY,
        naclUtil.encodeBase64(publicKey),
      ),
    ]);
  }

  /**
   * Oturum düşürüldüğünde veya çıkış yapıldığında anahtarları ve önbelleği tamamen siler.
   */
  async clearKeys(): Promise<void> {
    this.mySecretKey = null;
    this.myPublicKey = null;
    this.sharedKeyCache.clear();

    await Promise.allSettled([
      SecureStore.deleteItemAsync(SECURE_STORE_PRIVATE_KEY),
      SecureStore.deleteItemAsync(SECURE_STORE_PUBLIC_KEY),
    ]);
  }

  // ---------------------------------------------------------------------------
  // 2. Anahtar Üretimi ve PIN ile Şifrelenmiş Yedek Oluşturma (Kayıt Anı)
  // ---------------------------------------------------------------------------
  async createKeyBackup(pin: string): Promise<KeyBackupPayload> {
    if (!pin || pin.length < 6) {
      throw new Error('Kurtarma PIN kodu en az 6 haneli olmalıdır.');
    }

    // 1. X25519 Anahtar Çifti Üret
    const keyPair = nacl.box.keyPair();

    // 2. 32 byte rastgele Salt ve 24 byte Nonce üret
    const salt = Crypto.getRandomBytes(32);
    const nonce = nacl.randomBytes(nacl.secretbox.nonceLength);

    // 3. PBKDF2 (100.000 iterasyon, SHA-256) ile 32 byte simetrik anahtar türet
    const derivedKey = pbkdf2(sha256, pin, salt, { c: 100_000, dkLen: 32 });

    // 4. Özel anahtarı simetrik anahtar ile şifrele
    const encryptedSecretKey = nacl.secretbox(keyPair.secretKey, nonce, derivedKey);

    // 5. Cihazdaki güvenli depolamaya kaydet
    await this.saveKeys(keyPair.secretKey, keyPair.publicKey);

    return {
      publicKey: naclUtil.encodeBase64(keyPair.publicKey),
      encryptedPrivateKey: naclUtil.encodeBase64(encryptedSecretKey),
      keyBackupSalt: naclUtil.encodeBase64(salt),
      keyBackupNonce: naclUtil.encodeBase64(nonce),
    };
  }

  // ---------------------------------------------------------------------------
  // 3. PIN ile Özel Anahtarı Kurtarma (Yeni Cihazda Giriş Anı)
  // ---------------------------------------------------------------------------
  async restoreKeyBackup(
    pin: string,
    backup: {
      encryptedPrivateKey: string;
      keyBackupSalt: string;
      keyBackupNonce: string;
      publicKey: string;
    },
  ): Promise<boolean> {
    try {
      if (!pin || !backup.encryptedPrivateKey || !backup.keyBackupSalt || !backup.keyBackupNonce) {
        return false;
      }

      const encrypted = naclUtil.decodeBase64(backup.encryptedPrivateKey);
      const salt = naclUtil.decodeBase64(backup.keyBackupSalt);
      const nonce = naclUtil.decodeBase64(backup.keyBackupNonce);
      const publicKey = naclUtil.decodeBase64(backup.publicKey);

      // 1. PIN ve Salt ile 32 byte anahtarı yeniden türet
      const derivedKey = pbkdf2(sha256, pin, salt, { c: 100_000, dkLen: 32 });

      // 2. Özel anahtarı çöz
      const secretKey = nacl.secretbox.open(encrypted, nonce, derivedKey);

      if (!secretKey) {
        // PIN yanlış veya veri bozuk
        return false;
      }

      // 3. Başarılı çözüldüyse SecureStore'a kaydet
      await this.saveKeys(secretKey, publicKey);
      return true;
    } catch (err) {
      console.warn('[CryptoService] restoreKeyBackup hatası:', err);
      return false;
    }
  }

  // ---------------------------------------------------------------------------
  // 4. Ortak Sır (Diffie-Hellman Shared Secret) Yönetimi
  // ---------------------------------------------------------------------------
  private async getSharedKey(peerPublicKeyBase64: string): Promise<Uint8Array | null> {
    if (!peerPublicKeyBase64) return null;

    const cached = this.sharedKeyCache.get(peerPublicKeyBase64);
    if (cached) return cached;

    if (!this.mySecretKey) {
      await this.loadKeys();
      if (!this.mySecretKey) return null;
    }

    try {
      const peerPublicKeyBytes = naclUtil.decodeBase64(peerPublicKeyBase64);
      // X25519 Diffie-Hellman ortak sırrı
      const sharedKey = nacl.box.before(peerPublicKeyBytes, this.mySecretKey);
      this.sharedKeyCache.set(peerPublicKeyBase64, sharedKey);
      return sharedKey;
    } catch (err) {
      console.warn('[CryptoService] getSharedKey hatası:', err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 5. Mesaj Şifreleme (Outbox Gönderim)
  // ---------------------------------------------------------------------------
  async encryptMessage(
    plaintext: string,
    peerPublicKeyBase64: string,
  ): Promise<EncryptedMessagePayload | null> {
    try {
      const sharedKey = await this.getSharedKey(peerPublicKeyBase64);
      if (!sharedKey || !this.myPublicKey) {
        console.warn('[CryptoService] Şifreleme yapılamadı: Anahtar bulunamadı');
        return null;
      }

      const nonce = nacl.randomBytes(nacl.box.nonceLength);
      const messageBytes = naclUtil.decodeUTF8(plaintext);
      const cipherBytes = nacl.box.after(messageBytes, nonce, sharedKey);

      return {
        ciphertext: naclUtil.encodeBase64(cipherBytes),
        nonce: naclUtil.encodeBase64(nonce),
        senderPublicKey: naclUtil.encodeBase64(this.myPublicKey),
      };
    } catch (err) {
      console.error('[CryptoService] encryptMessage hatası:', err);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // 6. Mesaj Çözme (Gelen veya Geçmiş Mesajlar)
  // ---------------------------------------------------------------------------
  async decryptMessage(
    ciphertextBase64: string,
    nonceBase64: string,
    otherPartyPublicKeyBase64: string,
  ): Promise<string | null> {
    try {
      if (!ciphertextBase64 || !nonceBase64 || !otherPartyPublicKeyBase64) {
        return null;
      }

      const sharedKey = await this.getSharedKey(otherPartyPublicKeyBase64);
      if (!sharedKey) {
        return null;
      }

      const cipherBytes = naclUtil.decodeBase64(ciphertextBase64);
      const nonceBytes = naclUtil.decodeBase64(nonceBase64);

      const decryptedBytes = nacl.box.open.after(cipherBytes, nonceBytes, sharedKey);
      if (!decryptedBytes) {
        return null;
      }

      return naclUtil.encodeUTF8(decryptedBytes);
    } catch (err) {
      console.warn('[CryptoService] decryptMessage hatası:', err);
      return null;
    }
  }
}

export const cryptoService = new CryptoService();
