import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  KeyboardTypeOptions,
  LayoutAnimation,
  Platform,
  ReturnKeyTypeOptions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  UIManager,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { api } from '../services/api';
import { useChatStore } from '../store/useChatStore';
import { registerForPushNotificationsAsync } from '../services/notifications';

type AuthStage =
  | 'CHECK_USERNAME'
  | 'USER_NOT_FOUND'
  | 'REGISTER_NAME'
  | 'REGISTER_EMAIL'
  | 'REGISTER_PASSWORD'
  | 'ENTER_PASSWORD';

interface FoundUser {
  id: string;
  username: string;
  displayName: string;
  avatarUrl?: string;
}

// ---------------------------------------------------------------------------
// Özel Giriş Kartı (Pressable + Lokal Focus):
// Tıklandığında tüm kart alanı odaklanır, ana ekranı gereksiz re-render etmez
// ---------------------------------------------------------------------------
interface AuthInputCardProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  icon: React.ReactNode;
  isPassword?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  onSubmitEditing?: () => void;
  returnKeyType?: ReturnKeyTypeOptions;
  hasError?: boolean;
}

const AuthInputCard: React.FC<AuthInputCardProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  icon,
  isPassword = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  autoCorrect = false,
  onSubmitEditing,
  returnKeyType = 'done',
  hasError = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View
      style={[
        styles.inputCard,
        isFocused && styles.inputCardFocused,
        hasError && styles.inputCardError,
      ]}
    >
      <TouchableOpacity
        style={styles.iconBox}
        activeOpacity={0.7}
        onPress={() => inputRef.current?.focus()}
      >
        {icon}
      </TouchableOpacity>

      <View style={styles.inputInnerColumn}>
        <Text
          style={styles.inputTopLabel}
          onPress={() => inputRef.current?.focus()}
          suppressHighlighting
        >
          {label}
        </Text>
        <TextInput
          ref={inputRef}
          style={styles.textInputField}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#475569"
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          keyboardType={keyboardType}
          secureTextEntry={isPassword && !showPassword}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onSubmitEditing={onSubmitEditing}
          returnKeyType={returnKeyType}
        />
      </View>

      {isPassword && (
        <TouchableOpacity
          onPress={() => setShowPassword((prev) => !prev)}
          style={styles.eyeToggleBtn}
          activeOpacity={0.7}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Ionicons
            name={showPassword ? 'eye-off-outline' : 'eye-outline'}
            size={20}
            color="#94A3B8"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

export const AuthScreen: React.FC = () => {
  const router = useRouter();
  const setAuth = useChatStore((s) => s.setAuth);

  const [stage, setStage] = useState<AuthStage>('CHECK_USERNAME');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  const insets = useSafeAreaInsets();
  const [foundUser, setFoundUser] = useState<FoundUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }

    const onShow = (e: any) => {
      const h = e?.endCoordinates?.height || 0;
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(h);
      setIsKeyboardVisible(true);
    };

    const onHide = () => {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setKeyboardHeight(0);
      setIsKeyboardVisible(false);
    };

    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

    const showSub = Keyboard.addListener(showEvent, onShow);
    const hideSub = Keyboard.addListener(hideEvent, onHide);

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const cleanUsername = (text: string) => {
    return text.toLowerCase().replace(/[^a-z0-9_]/g, '');
  };

  // ---------------------------------------------------------------------------
  // 1. Kullanıcı Adı Kontrolü (POST /auth/check-user)
  // ---------------------------------------------------------------------------
  const handleCheckUsername = async () => {
    setError(null);
    const clean = username.trim().toLowerCase();

    if (!clean) {
      setError('Lütfen bir kullanıcı adı girin');
      return;
    }
    if (clean.length < 3 || clean.length > 20) {
      setError('Kullanıcı adı 3 ile 20 karakter arasında olmalıdır');
      return;
    }

    try {
      setLoading(true);
      const res = await api.post('/auth/check-user', { identifier: clean });

      if (res.data?.exists && res.data?.user) {
        setFoundUser(res.data.user);
        setPassword('');
        setStage('ENTER_PASSWORD');
      } else {
        setStage('USER_NOT_FOUND');
      }
    } catch (err: any) {
      const msg =
        err.response?.data?.message ||
        'Sunucuya ulaşılamadı. Lütfen bağlantınızı kontrol edin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. Giriş Yap (POST /auth/login)
  // ---------------------------------------------------------------------------
  const handleLogin = async () => {
    setError(null);
    if (!password) {
      setError('Lütfen şifrenizi girin');
      return;
    }

    try {
      setLoading(true);
      let pushToken: string | null = null;
      try {
        pushToken = await registerForPushNotificationsAsync();
      } catch (tokenErr) {
        console.warn('Login push token alma uyarısı:', tokenErr);
      }

      const res = await api.post('/auth/login', {
        identifier: username.trim(),
        password,
        pushToken,
      });
      setAuth(res.data.user, res.data.accessToken);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Şifre hatalı. Lütfen tekrar deneyin.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. Kayıt Adım Doğrulamaları
  // ---------------------------------------------------------------------------
  const handleNextFromDisplayName = () => {
    setError(null);
    if (!displayName.trim()) {
      setError('Lütfen bir görünen ad girin');
      return;
    }
    setStage('REGISTER_EMAIL');
  };

  const handleNextFromEmail = () => {
    setError(null);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      setError('Geçerli bir e-posta adresi girin');
      return;
    }
    setStage('REGISTER_PASSWORD');
  };

  // ---------------------------------------------------------------------------
  // 4. Kayıt Tamamla (POST /auth/register)
  // ---------------------------------------------------------------------------
  const handleRegister = async () => {
    setError(null);
    if (!password || password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır');
      return;
    }

    try {
      setLoading(true);
      let pushToken: string | null = null;
      try {
        pushToken = await registerForPushNotificationsAsync();
      } catch (tokenErr) {
        console.warn('Register push token alma uyarısı:', tokenErr);
      }

      const res = await api.post('/auth/register', {
        username: username.trim().toLowerCase(),
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
        pushToken,
      });

      setAuth(res.data.user, res.data.accessToken);
      router.replace('/(tabs)');
    } catch (err: any) {
      const msg =
        err.response?.data?.message || 'Kayıt sırasında bir hata oluştu.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Şifre Gücü Hesaplama (Bar göstergesi için)
  const isLengthValid = password.length >= 6;
  const hasLetterAndNumber = /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
  const isStrong = password.length >= 8 && /[^a-zA-Z0-9]/.test(password);

  // Stepper Header (1/3, 2/3, 3/3)
  const renderStepperHeader = (currentStep: number) => (
    <View style={styles.stepperHeader}>
      <TouchableOpacity
        style={styles.backCircleBtn}
        onPress={() => {
          setError(null);
          if (currentStep === 1) setStage('USER_NOT_FOUND');
          else if (currentStep === 2) setStage('REGISTER_NAME');
          else if (currentStep === 3) setStage('REGISTER_EMAIL');
        }}
        activeOpacity={0.7}
      >
        <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      <View style={styles.stepperBars}>
        <View style={[styles.barItem, currentStep >= 1 ? styles.barActive : styles.barInactive]} />
        <View style={[styles.barItem, currentStep >= 2 ? styles.barActive : styles.barInactive]} />
        <View style={[styles.barItem, currentStep >= 3 ? styles.barActive : styles.barInactive]} />
      </View>

      <Text style={styles.stepCounterText}>{currentStep}/3</Text>
    </View>
  );

  // ---------------------------------------------------------------------------
  // Üst Kaydırılabilir İçerikler (Stage bazlı)
  // ---------------------------------------------------------------------------
  const renderStageTopContent = () => {
    switch (stage) {
      case 'CHECK_USERNAME':
        return (
          <View style={styles.stageContent}>
            <View style={styles.smallLogoBadge}>
              <Image
                source={require('../../assets/app-icon-rounded.png')}
                style={styles.smallLogoImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.stageTitle}>Tekrar hoş geldin</Text>
            <Text style={styles.stageSubtitle}>
              Devam etmek için kullanıcı adını yaz. Hesabın{'\n'}yoksa birlikte oluşturalım.
            </Text>

            <AuthInputCard
              label="Kullanıcı adı"
              value={username}
              onChangeText={(t) => {
                setUsername(cleanUsername(t));
                if (error) setError(null);
              }}
              placeholder="kullanici_adi"
              icon={<Text style={styles.atSignText}>@</Text>}
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleCheckUsername}
              returnKeyType="next"
              hasError={!!error}
            />

            <Text style={styles.helperText}>Örn: enes, ahmet_12, developer</Text>
            {error && <Text style={styles.errorInlineText}>{error}</Text>}
          </View>
        );

      case 'USER_NOT_FOUND':
        return (
          <View style={[styles.stageContent, styles.notFoundCenterContent]}>
            <View style={styles.goldIconContainer}>
              <Ionicons name="person-add" size={32} color="#F59E0B" />
            </View>

            <Text style={styles.notFoundTitle}>Seni henüz tanımıyoruz</Text>

            <Text style={styles.notFoundSubtitle}>
              <Text style={styles.highlightedUsername}>@{username}</Text> adına ait bir hesap
              bulunamadı. Bu kullanıcı adıyla hemen yeni bir Chrono hesabı oluşturabilirsin.
            </Text>
          </View>
        );

      case 'REGISTER_NAME':
        return (
          <View style={styles.stageContent}>
            {renderStepperHeader(1)}

            <View style={styles.usernameChip}>
              <Text style={styles.usernameChipText}>@{username}</Text>
            </View>

            <Text style={styles.stageTitle}>Sana nasıl seslenelim?</Text>
            <Text style={styles.stageSubtitle}>
              Sohbet odalarında diğer kullanıcıların göreceği{'\n'}görünen adını yaz.
            </Text>

            <AuthInputCard
              label="Görünen ad"
              value={displayName}
              onChangeText={(t) => {
                setDisplayName(t);
                if (error) setError(null);
              }}
              placeholder="Örn: Enes Samed"
              icon={<Ionicons name="person-outline" size={20} color="#38BDF8" />}
              onSubmitEditing={handleNextFromDisplayName}
              returnKeyType="next"
              hasError={!!error}
            />

            {error && <Text style={styles.errorInlineText}>{error}</Text>}
          </View>
        );

      case 'REGISTER_EMAIL':
        return (
          <View style={styles.stageContent}>
            {renderStepperHeader(2)}

            <View style={styles.usernameChip}>
              <Text style={styles.usernameChipText}>@{username}</Text>
            </View>

            <Text style={styles.stageTitle}>E-posta adresin</Text>
            <Text style={styles.stageSubtitle}>
              Hesap güvenliği ve kurtarma için geçerli bir e-posta adresi gir.
            </Text>

            <AuthInputCard
              label="E-posta"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (error) setError(null);
              }}
              placeholder="ornek@email.com"
              icon={<Ionicons name="mail-outline" size={20} color="#38BDF8" />}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              onSubmitEditing={handleNextFromEmail}
              returnKeyType="next"
              hasError={!!error}
            />

            {error && <Text style={styles.errorInlineText}>{error}</Text>}
          </View>
        );

      case 'REGISTER_PASSWORD':
        return (
          <View style={styles.stageContent}>
            {renderStepperHeader(3)}

            <View style={styles.usernameChip}>
              <Text style={styles.usernameChipText}>@{username}</Text>
            </View>

            <Text style={styles.stageTitle}>Bir şifre belirle</Text>
            <Text style={styles.stageSubtitle}>
              Hesabını korumak için en az 6 karakterlik bir şifre{'\n'}oluştur.
            </Text>

            <AuthInputCard
              label="Şifre"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              placeholder="••••••••"
              icon={<Ionicons name="lock-closed-outline" size={20} color="#38BDF8" />}
              isPassword
              onSubmitEditing={handleRegister}
              returnKeyType="done"
              hasError={!!error}
            />

            <View style={styles.passwordStrengthRow}>
              <View
                style={[
                  styles.strengthBar,
                  isLengthValid ? styles.strengthBarFilled : styles.strengthBarEmpty,
                ]}
              />
              <View
                style={[
                  styles.strengthBar,
                  hasLetterAndNumber ? styles.strengthBarFilled : styles.strengthBarEmpty,
                ]}
              />
              <View
                style={[
                  styles.strengthBar,
                  isStrong ? styles.strengthBarFilled : styles.strengthBarEmpty,
                ]}
              />
            </View>

            <Text style={styles.helperText}>
              En az 6 karakter. Harf, rakam ve sembol karıştırmak{'\n'}güçlendirir.
            </Text>

            {error && <Text style={styles.errorInlineText}>{error}</Text>}
          </View>
        );

      case 'ENTER_PASSWORD':
        return (
          <View style={styles.stageContent}>
            <View style={styles.loginHeaderBar}>
              <TouchableOpacity
                style={styles.backCircleBtn}
                onPress={() => {
                  setError(null);
                  setStage('CHECK_USERNAME');
                }}
                activeOpacity={0.7}
              >
                <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
              </TouchableOpacity>

              <View style={styles.smallHeaderLogo}>
                <Image
                  source={require('../../assets/app-icon-rounded.png')}
                  style={styles.smallLogoImage}
                  resizeMode="cover"
                />
              </View>
            </View>

            <View style={styles.userFoundCard}>
              {foundUser?.avatarUrl ? (
                <Image source={{ uri: foundUser.avatarUrl }} style={styles.userAvatarImage} />
              ) : (
                <View style={styles.userAvatarFallback}>
                  <Text style={styles.userAvatarText}>
                    {(foundUser?.displayName || foundUser?.username || 'U')
                      .charAt(0)
                      .toUpperCase()}
                  </Text>
                </View>
              )}

              <View style={styles.userFoundInfo}>
                <Text style={styles.userFoundDisplayName} numberOfLines={1}>
                  {foundUser?.displayName || 'Kullanıcı'}
                </Text>
                <Text style={styles.userFoundUsername} numberOfLines={1}>
                  @{foundUser?.username || username}
                </Text>
              </View>

              <TouchableOpacity
                style={styles.changeUserBtn}
                onPress={() => {
                  setError(null);
                  setStage('CHECK_USERNAME');
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.changeUserBtnText}>Değiştir</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.stageTitle}>Tekrar hoş geldin</Text>
            <Text style={styles.stageSubtitle}>
              Hesabına giriş yapmak için şifreni gir.
            </Text>

            <AuthInputCard
              label="Şifre"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (error) setError(null);
              }}
              placeholder="••••••••"
              icon={<Ionicons name="lock-closed-outline" size={20} color="#38BDF8" />}
              isPassword
              onSubmitEditing={handleLogin}
              returnKeyType="done"
              hasError={!!error}
            />

            <TouchableOpacity
              style={styles.forgotPasswordBtn}
              onPress={() =>
                Alert.alert(
                  'Şifre Sıfırlama',
                  'Şifrenizi sıfırlamak için lütfen sistem yöneticisi ile iletişime geçin.',
                )
              }
              activeOpacity={0.7}
            >
              <Text style={styles.forgotPasswordText}>Şifremi unuttum</Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorInlineText}>{error}</Text>}
          </View>
        );
    }
  };

  // ---------------------------------------------------------------------------
  // Sabitlenen Alt Aksiyon Butonları (Klavye üstünde kalır)
  // ---------------------------------------------------------------------------
  const renderStageBottomContent = () => {
    switch (stage) {
      case 'CHECK_USERNAME':
        return (
          <>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={handleCheckUsername}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Text style={styles.actionBtnText}>Devam Et</Text>
                  <View style={styles.actionBtnIconCircle}>
                    <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                  </View>
                </>
              )}
            </TouchableOpacity>

            {!isKeyboardVisible && (
              <Text style={styles.disclaimerText}>
                Devam ederek Kullanım Koşulları ve Gizlilik Politikası'nı kabul{'\n'}etmiş olursun.
              </Text>
            )}
          </>
        );

      case 'USER_NOT_FOUND':
        return (
          <>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => {
                setError(null);
                setDisplayName('');
                setStage('REGISTER_NAME');
              }}
              activeOpacity={0.85}
            >
              <Text style={styles.actionBtnText}>Hesap Oluştur</Text>
              <View style={styles.actionBtnIconCircle}>
                <Ionicons name="sparkles" size={17} color="#FFFFFF" />
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryLinkBtn}
              onPress={() => {
                setError(null);
                setStage('CHECK_USERNAME');
              }}
              activeOpacity={0.7}
            >
              <Text style={styles.secondaryLinkText}>Farklı bir kullanıcı adı dene</Text>
            </TouchableOpacity>
          </>
        );

      case 'REGISTER_NAME':
        return (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleNextFromDisplayName}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>İleri</Text>
            <View style={styles.actionBtnIconCircle}>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        );

      case 'REGISTER_EMAIL':
        return (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleNextFromEmail}
            activeOpacity={0.85}
          >
            <Text style={styles.actionBtnText}>İleri</Text>
            <View style={styles.actionBtnIconCircle}>
              <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        );

      case 'REGISTER_PASSWORD':
        return (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.actionBtnText}>Hesabı Oluştur ve Başla</Text>
                <View style={styles.actionBtnIconCircle}>
                  <Ionicons name="checkmark" size={19} color="#FFFFFF" />
                </View>
              </>
            )}
          </TouchableOpacity>
        );

      case 'ENTER_PASSWORD':
        return (
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Text style={styles.actionBtnText}>Giriş Yap</Text>
                <View style={styles.actionBtnIconCircle}>
                  <Ionicons name="arrow-forward" size={17} color="#FFFFFF" />
                </View>
              </>
            )}
          </TouchableOpacity>
        );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : "height"}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
          <View
            style={[
              styles.screenInner,

            ]}
          >
            <ScrollView
              style={styles.scrollArea}
              contentContainerStyle={[
                styles.scrollContent,
                isKeyboardVisible && styles.scrollContentKeyboard,
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              showsVerticalScrollIndicator={false}
              bounces={false}
            >
              <TouchableWithoutFeedback onPress={Keyboard.dismiss} accessible={false}>
                <View style={styles.stageTopContentWrapper}>
                  {renderStageTopContent()}
                </View>
              </TouchableWithoutFeedback>
            </ScrollView>

            {/* Sabit / Klavye Üstü Aksiyon Alanı */}
            <View
              style={[
                styles.stageBottomPinned,
                isKeyboardVisible
                  ? styles.stageBottomPinnedKeyboard
                  : { paddingBottom: Math.max(insets.bottom, 20) },
              ]}
            >
              {renderStageBottomContent()}
            </View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B0F1A', // Chrono Deep Night
  },
  keyboardRoot: {
    flex: 1,
  },
  screenInner: {
    flex: 1,
    justifyContent: 'space-between',
  },
  scrollArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  scrollContentKeyboard: {
    paddingBottom: 10,
  },
  stageTopContentWrapper: {
    flex: 1,
  },
  stageContent: {
    flex: 1,
  },
  stageBottomPinned: {
    paddingHorizontal: 24,
    paddingTop: 14,
    paddingBottom: 24,
    backgroundColor: '#0B0F1A',
  },
  stageBottomPinnedKeyboard: {
    paddingTop: 8,
    paddingBottom: 8,
  },

  // Üst Küçük Logo Rozeti
  smallLogoBadge: {
    width: 48,
    height: 48,
    borderRadius: 16,
    overflow: 'hidden',
    marginTop: 10,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  smallLogoImage: {
    width: '100%',
    height: '100%',
  },

  // Stepper Header (1/3, 2/3, 3/3)
  stepperHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  backCircleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBars: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    gap: 6,
  },
  barItem: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  barActive: {
    backgroundColor: '#2563EB',
  },
  barInactive: {
    backgroundColor: '#1E293B',
  },
  stepCounterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },

  // @kullanıcı_adı Rozet Çipi
  usernameChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(37, 99, 235, 0.25)',
    marginTop: 22,
    marginBottom: 4,
  },
  usernameChipText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#38BDF8',
  },

  // Başlıklar
  stageTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 20,
    letterSpacing: 0.3,
  },
  stageSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 28,
  },

  // Özel Çerçeveli Input Kartı (Screenshots 2, 4, 5, 6, 7)
  inputCard: {
    width: '100%',
    height: 72,
    borderRadius: 22,
    backgroundColor: '#101726',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  inputCardFocused: {
    borderColor: '#2563EB',
    ...Platform.select({
      ios: {
        shadowColor: '#2563EB',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
      },
    }),
  },
  inputCardError: {
    borderColor: '#EF4444',
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: 'rgba(37, 99, 235, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  atSignText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#38BDF8',
  },
  inputInnerColumn: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  inputTopLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 2,
    letterSpacing: 0.2,
  },
  textInputField: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    minHeight: 28,
  },
  eyeToggleBtn: {
    padding: 8,
  },
  helperText: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 10,
    lineHeight: 18,
  },
  errorInlineText: {
    fontSize: 13,
    color: '#F87171',
    marginTop: 8,
    fontWeight: '500',
  },

  // Şifre Gücü Çubukları (Screenshot 6)
  passwordStrengthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
  },
  strengthBar: {
    flex: 1,
    height: 3,
    borderRadius: 2,
  },
  strengthBarFilled: {
    backgroundColor: '#2563EB',
  },
  strengthBarEmpty: {
    backgroundColor: '#1E293B',
  },

  // User Not Found Sayfası (Screenshot 3)
  notFoundCenterContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 48,
  },
  goldIconContainer: {
    width: 78,
    height: 78,
    borderRadius: 26,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.28)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 28,
  },
  notFoundTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  notFoundSubtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  highlightedUsername: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  secondaryLinkBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 6,
  },
  secondaryLinkText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },

  // Login Header & Bulunan Kullanıcı Kartı (Screenshot 7)
  loginHeaderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 4,
  },
  smallHeaderLogo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  userFoundCard: {
    backgroundColor: '#101726',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 24,
  },
  userAvatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  userAvatarText: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  userFoundInfo: {
    flex: 1,
    marginLeft: 14,
  },
  userFoundDisplayName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  userFoundUsername: {
    fontSize: 13.5,
    color: '#38BDF8',
    marginTop: 2,
    fontWeight: '500',
  },
  changeUserBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.07)',
  },
  changeUserBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  forgotPasswordBtn: {
    marginTop: 16,
    alignSelf: 'flex-start',
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },

  // Alt Butonlar
  stageBottom: {
    width: '100%',
  },
  actionBtn: {
    width: '100%',
    height: 58,
    borderRadius: 29,
    backgroundColor: '#2563EB',
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
  actionBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
    flex: 1,
    textAlign: 'center',
    marginLeft: 36,
  },
  actionBtnIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 14,
  },
});
