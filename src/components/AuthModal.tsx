import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useChatStore } from '../store/useChatStore';
import { api } from '../services/api';
import { registerForPushNotificationsAsync } from '../services/notifications';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<Props> = ({ visible, onClose }) => {
  const { setAuth } = useChatStore();
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);

    try {
      let pushToken: string | null = null;
      try {
        pushToken = await registerForPushNotificationsAsync();
      } catch (tokenErr) {
        console.warn('AuthModal push token alma uyarısı:', tokenErr);
      }

      if (isRegister) {
        const res = await api.post('/auth/register', {
          email,
          username,
          displayName: displayName || username,
          password,
          pushToken,
        });
        setAuth(res.data.user, res.data.accessToken);
      } else {
        const res = await api.post('/auth/login', {
          identifier: email || username,
          password,
          pushToken,
        });
        setAuth(res.data.user, res.data.accessToken);
      }
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.message ||
          'Giriş başarısız. Lütfen bilgilerinizi kontrol edin.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleQuickDemo = (name: string, user: string) => {
    const demoUser = {
      id: `demo-${user}`,
      email: `${user}@chrono.app`,
      username: user,
      displayName: name,
      avatarUrl: `https://api.dicebear.com/7.x/bottts/png?seed=${encodeURIComponent(user)}`,
      status: 'ONLINE' as const,
    };
    setAuth(demoUser, 'demo-jwt-token-123');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <SafeAreaView style={styles.card}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.brandRow}>
              <View style={styles.logoBadge}>
                <Ionicons name="chatbubbles" size={22} color="#fff" />
              </View>
              <Text style={styles.brandTitle}>Chrono</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color="#8696a0" />
            </TouchableOpacity>
          </View>

          {/* Quick Demo Login Bar */}
          <View style={styles.demoSection}>
            <Text style={styles.demoLabel}>Hızlı Test için Demo Profil Seçin:</Text>
            <View style={styles.demoButtonsRow}>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleQuickDemo('Ahmet Yılmaz', 'ahmet')}
              >
                <Text style={styles.demoBtnText}>👨‍💻 Ahmet</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleQuickDemo('Ayşe Kaya', 'ayse')}
              >
                <Text style={styles.demoBtnText}>👩‍🎨 Ayşe</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.demoBtn}
                onPress={() => handleQuickDemo('Mehmet Demir', 'mehmet')}
              >
                <Text style={styles.demoBtnText}>⚡ Mehmet</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>veya hesap ile bağlanın</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* Switch tabs */}
          <View style={styles.tabsRow}>
            <TouchableOpacity
              style={[styles.tab, !isRegister && styles.activeTab]}
              onPress={() => setIsRegister(false)}
            >
              <Text
                style={[styles.tabText, !isRegister && styles.activeTabText]}
              >
                Giriş Yap
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, isRegister && styles.activeTab]}
              onPress={() => setIsRegister(true)}
            >
              <Text
                style={[styles.tabText, isRegister && styles.activeTabText]}
              >
                Kayıt Ol
              </Text>
            </TouchableOpacity>
          </View>

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          {/* Form Fields */}
          <View style={styles.form}>
            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Görünen İsim</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Örn: Ahmet"
                  placeholderTextColor="#666"
                  value={displayName}
                  onChangeText={setDisplayName}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                {isRegister ? 'E-Posta' : 'E-Posta veya Kullanıcı Adı'}
              </Text>
              <TextInput
                style={styles.input}
                placeholder={isRegister ? 'ornek@email.com' : 'ahmet veya ahmet@email.com'}
                placeholderTextColor="#666"
                autoCapitalize="none"
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {isRegister && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Kullanıcı Adı</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ahmet"
                  placeholderTextColor="#666"
                  autoCapitalize="none"
                  value={username}
                  onChangeText={setUsername}
                />
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Şifre</Text>
              <TextInput
                style={styles.input}
                placeholder="••••••••"
                placeholderTextColor="#666"
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
              onPress={handleSubmit}
              disabled={loading}
            >
              <Text style={styles.submitBtnText}>
                {loading
                  ? 'İşleniyor...'
                  : isRegister
                  ? 'Hesap Oluştur'
                  : 'Giriş Yap'}
              </Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1f2c34', // WhatsApp dark card
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#00a884',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  brandTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#00a884',
  },
  closeBtn: {
    padding: 4,
  },
  demoSection: {
    backgroundColor: '#111b21',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#202c33',
  },
  demoLabel: {
    color: '#8696a0',
    fontSize: 12,
    marginBottom: 8,
    fontWeight: '600',
  },
  demoButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  demoBtn: {
    flex: 1,
    backgroundColor: '#202c33',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoBtnText: {
    color: '#e9edef',
    fontSize: 13,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#2a3942',
  },
  dividerText: {
    color: '#8696a0',
    fontSize: 11,
    marginHorizontal: 8,
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#111b21',
    borderRadius: 10,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#00a884',
  },
  tabText: {
    color: '#8696a0',
    fontWeight: '600',
    fontSize: 14,
  },
  activeTabText: {
    color: '#fff',
  },
  errorText: {
    color: '#ea4335',
    fontSize: 13,
    marginBottom: 10,
    textAlign: 'center',
  },
  form: {
    gap: 12,
  },
  inputGroup: {
    gap: 4,
  },
  label: {
    color: '#8696a0',
    fontSize: 12,
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#111b21',
    color: '#e9edef',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a3942',
  },
  submitBtn: {
    backgroundColor: '#00a884',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
});
