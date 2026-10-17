import React from 'react';
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AudioOutputDevice } from '../../hooks/useAudioRouting';

interface AudioOutputPickerModalProps {
  visible: boolean;
  onClose: () => void;
  availableOutputs: AudioOutputDevice[];
  currentOutput: AudioOutputDevice;
  onSelectOutput: (device: AudioOutputDevice) => void;
  onOpenSystemPicker?: () => void;
}

export const AudioOutputPickerModal: React.FC<AudioOutputPickerModalProps> = ({
  visible,
  onClose,
  availableOutputs,
  currentOutput,
  onSelectOutput,
  onOpenSystemPicker,
}) => {
  const getDeviceDetails = (device: AudioOutputDevice) => {
    switch (device) {
      case 'bluetooth':
        return {
          title: 'Bluetooth Cihazı',
          subtitle: 'Kablosuz kulaklık veya hoparlör',
          icon: 'bluetooth' as const,
          color: '#38BDF8',
        };
      case 'headset':
        return {
          title: 'Kablolu Kulaklık',
          subtitle: '3.5mm veya USB-C kulaklık',
          icon: 'headset' as const,
          color: '#10B981',
        };
      case 'speaker':
        return {
          title: 'Hoparlör',
          subtitle: 'Cihazın ana hoparlörü (eller serbest)',
          icon: 'volume-high' as const,
          color: '#F59E0B',
        };
      case 'earpiece':
      default:
        return {
          title: 'Telefon Ahizesi',
          subtitle: 'Kulağa tutularak yapılan standart görüşme',
          icon: 'phone-portrait-outline' as const,
          color: '#94A3B8',
        };
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.modalContent}>
              <View style={styles.dragHandle} />

              <View style={styles.headerRow}>
                <View style={styles.titleWrapper}>
                  <Ionicons name="musical-notes-outline" size={20} color="#38BDF8" style={{ marginRight: 8 }} />
                  <Text style={styles.headerTitle}>Ses Çıkış Cihazı</Text>
                </View>
                <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
                  <Ionicons name="close" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.headerSubtitle}>
                Arama sesinin hangi cihaz üzerinden aktarılacağını seçin:
              </Text>

              <View style={styles.deviceList}>
                {availableOutputs.map((device) => {
                  const details = getDeviceDetails(device);
                  const isSelected = currentOutput === device;

                  return (
                    <TouchableOpacity
                      key={device}
                      style={[styles.deviceItem, isSelected && styles.deviceItemSelected]}
                      onPress={() => {
                        onSelectOutput(device);
                        onClose();
                      }}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.iconCircle, { backgroundColor: `${details.color}1E` }]}>
                        <Ionicons name={details.icon} size={22} color={details.color} />
                      </View>

                      <View style={styles.deviceTextCol}>
                        <Text style={[styles.deviceTitle, isSelected && styles.deviceTitleSelected]}>
                          {details.title}
                        </Text>
                        <Text style={styles.deviceSubtitle}>{details.subtitle}</Text>
                      </View>

                      {isSelected ? (
                        <View style={styles.checkWrapper}>
                          <Ionicons name="checkmark-circle" size={22} color="#38BDF8" />
                        </View>
                      ) : (
                        <View style={styles.radioPlaceholder} />
                      )}
                    </TouchableOpacity>
                  );
                })}

                {/* iOS AirPlay / Sistem Ses Menüsü Butonu */}
                {Platform.OS === 'ios' && onOpenSystemPicker && (
                  <TouchableOpacity
                    style={styles.systemPickerBtn}
                    onPress={() => {
                      onClose();
                      onOpenSystemPicker();
                    }}
                    activeOpacity={0.75}
                  >
                    <Ionicons name="radio-outline" size={20} color="#38BDF8" style={{ marginRight: 10 }} />
                    <Text style={styles.systemPickerText}>Diğer Ses Aygıtları (AirPlay / Sistem)...</Text>
                  </TouchableOpacity>
                )}
              </View>

              <TouchableOpacity style={styles.doneBtn} onPress={onClose} activeOpacity={0.8}>
                <Text style={styles.doneBtnText}>Tamam</Text>
              </TouchableOpacity>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#101726',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dragHandle: {
    width: 38,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 14,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  titleWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 16,
    lineHeight: 18,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deviceList: {
    gap: 10,
    marginBottom: 18,
  },
  deviceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  deviceItemSelected: {
    backgroundColor: 'rgba(56, 189, 248, 0.09)',
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  deviceTextCol: {
    flex: 1,
  },
  deviceTitle: {
    color: '#F1F5F9',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  deviceTitleSelected: {
    color: '#38BDF8',
    fontWeight: '700',
  },
  deviceSubtitle: {
    color: '#94A3B8',
    fontSize: 12,
  },
  checkWrapper: {
    marginLeft: 10,
  },
  radioPlaceholder: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    marginLeft: 10,
  },
  systemPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    backgroundColor: 'rgba(56, 189, 248, 0.08)',
    borderRadius: 14,
    marginTop: 4,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.2)',
  },
  systemPickerText: {
    color: '#38BDF8',
    fontSize: 14,
    fontWeight: '600',
  },
  doneBtn: {
    backgroundColor: '#2563EB',
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  doneBtnText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
