import React, { useState } from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface TextSizeSheetProps {
  visible: boolean;
  onClose: () => void;
  currentSize: number;
  onApply: (newSize: number) => void;
}

const AVAILABLE_SIZES = [13, 14, 15, 16, 17, 18];

export const TextSizeSheet: React.FC<TextSizeSheetProps> = ({
  visible,
  onClose,
  currentSize = 16,
  onApply,
}) => {
  const [size, setSize] = useState(currentSize);

  // Modal her açıldığında store'dan gelen boyuta senkronize et
  React.useEffect(() => {
    setSize(currentSize);
  }, [currentSize, visible]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetContainer}>
              {/* Tutamaç */}
              <View style={styles.handleBar} />

              {/* Üst Başlık */}
              <View style={styles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>Mesaj metin boyutu</Text>
                  <Text style={styles.subtitle}>Önizlemeye bakarak ayarla.</Text>
                </View>
                <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
                  <Ionicons name="close" size={18} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              {/* Sohbet Önizleme Alanı */}
              <View style={styles.previewBox}>
                {/* Sol Baloncuğu */}
                <View style={styles.incomingBubble}>
                  <Text style={[styles.bubbleTextIncoming, { fontSize: size, lineHeight: Math.round(size * 1.35) }]}>
                    Bu akşam müsait misin?
                  </Text>
                </View>

                {/* Sağ Baloncuğu */}
                <View style={styles.outgoingBubble}>
                  <Text style={[styles.bubbleTextOutgoing, { fontSize: size, lineHeight: Math.round(size * 1.35) }]}>
                    Müsaitim, sesli açalım
                  </Text>
                </View>
              </View>

              {/* Boyut Seçici / Slider Çubuğu */}
              <View style={styles.sliderSection}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.fontIndicatorSmall}>A</Text>

                  {/* Adım Butonları ve Çizgi */}
                  <View style={styles.trackContainer}>
                    <View style={styles.trackLine} />
                    <View style={styles.stepsRow}>
                      {AVAILABLE_SIZES.map((s) => {
                        const isSelected = size === s;
                        return (
                          <TouchableOpacity
                            key={s}
                            style={[styles.stepDotBtn, isSelected && styles.stepDotBtnSelected]}
                            onPress={() => setSize(s)}
                            activeOpacity={0.7}
                          >
                            <View style={[styles.stepDot, isSelected && styles.stepDotSelected]} />
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>

                  <Text style={styles.fontIndicatorLarge}>A</Text>
                </View>

                {/* Mevcut px Göstergesi */}
                <Text style={styles.pxIndicatorText}>{size} px</Text>
              </View>

              {/* Uygula Butonu */}
              <TouchableOpacity
                style={styles.applyBtn}
                onPress={() => {
                  onApply(size);
                  onClose();
                }}
                activeOpacity={0.85}
              >
                <Text style={styles.applyBtnText}>Uygula</Text>
                <View style={styles.checkIconBadge}>
                  <Ionicons name="checkmark" size={16} color="#FFFFFF" />
                </View>
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
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "flex-end",
  },
  sheetContainer: {
    backgroundColor: "#101726",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  handleBar: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#334155",
    alignSelf: "center",
    marginBottom: 16,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    color: "#94A3B8",
    marginTop: 4,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#1A2338",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  previewBox: {
    backgroundColor: "#0B0F1A",
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.05)",
    marginBottom: 24,
    gap: 12,
  },
  incomingBubble: {
    alignSelf: "flex-start",
    backgroundColor: "#131B2E",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
    maxWidth: "80%",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.04)",
  },
  outgoingBubble: {
    alignSelf: "flex-end",
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderBottomRightRadius: 4,
    maxWidth: "80%",
  },
  bubbleTextIncoming: {
    color: "#E2E8F0",
  },
  bubbleTextOutgoing: {
    color: "#FFFFFF",
    fontWeight: "500",
  },
  sliderSection: {
    marginBottom: 28,
  },
  sliderHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
  },
  fontIndicatorSmall: {
    fontSize: 14,
    fontWeight: "600",
    color: "#94A3B8",
    width: 20,
    textAlign: "center",
  },
  fontIndicatorLarge: {
    fontSize: 22,
    fontWeight: "700",
    color: "#FFFFFF",
    width: 24,
    textAlign: "center",
  },
  trackContainer: {
    flex: 1,
    marginHorizontal: 14,
    height: 36,
    justifyContent: "center",
    position: "relative",
  },
  trackLine: {
    position: "absolute",
    left: 8,
    right: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#1E293B",
  },
  stepsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    zIndex: 1,
  },
  stepDotBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stepDotBtnSelected: {
    backgroundColor: "rgba(37, 99, 235, 0.2)",
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#475569",
  },
  stepDotSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#2563EB",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  pxIndicatorText: {
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
  },
  applyBtn: {
    backgroundColor: "#2563EB",
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  checkIconBadge: {
    position: "absolute",
    right: 14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255, 255, 255, 0.22)",
    alignItems: "center",
    justifyContent: "center",
  },
});
