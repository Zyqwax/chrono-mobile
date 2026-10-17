import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as ImageManipulator from "expo-image-manipulator";
import { processAndOptimizeImage } from "../../services/imageProcessService";

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  mode?: "viewer" | "send";
  isSending?: boolean;
  onClose: () => void;
  onSend?: (finalUri: string, caption?: string) => void;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  mode = "viewer",
  isSending = false,
  onClose,
  onSend,
}) => {
  const insets = useSafeAreaInsets();
  const [currentUri, setCurrentUri] = useState<string | null>(imageUri);
  const [caption, setCaption] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    setCurrentUri(imageUri);
    setCaption("");
    if (imageUri) {
      Image.getSize(
        imageUri,
        (width, height) => {
          setImageSize({ width, height });
        },
        () => {
          setImageSize(null);
        },
      );
    }
  }, [imageUri, visible]);

  if (!visible || !currentUri) return null;

  const isSendMode = mode === "send";

  // 90 Derece Sağa Döndürme
  const handleRotate = async () => {
    if (!currentUri || isProcessing || isSending) return;
    setIsProcessing(true);
    try {
      const res = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setCurrentUri(res.uri);
      setImageSize({ width: res.width, height: res.height });
    } catch (err) {
      console.warn("Rotate error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Yatay Çevirme (Flip)
  const handleFlip = async () => {
    if (!currentUri || isProcessing || isSending) return;
    setIsProcessing(true);
    try {
      const res = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ flip: ImageManipulator.FlipType.Horizontal }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setCurrentUri(res.uri);
      setImageSize({ width: res.width, height: res.height });
    } catch (err) {
      console.warn("Flip error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 1:1 Kare Kırpma (Orta Bölge)
  const handleCropSquare = async () => {
    if (!currentUri || !imageSize || isProcessing || isSending) return;
    setIsProcessing(true);
    try {
      const side = Math.min(imageSize.width, imageSize.height);
      const originX = Math.round((imageSize.width - side) / 2);
      const originY = Math.round((imageSize.height - side) / 2);

      const res = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ crop: { originX, originY, width: side, height: side } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setCurrentUri(res.uri);
      setImageSize({ width: res.width, height: res.height });
    } catch (err) {
      console.warn("Crop square error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // 4:5 Portre Kırpma (Instagram / Chat Portrait)
  const handleCropPortrait = async () => {
    if (!currentUri || !imageSize || isProcessing || isSending) return;
    setIsProcessing(true);
    try {
      let targetWidth = imageSize.width;
      let targetHeight = Math.round((imageSize.width * 5) / 4);

      if (targetHeight > imageSize.height) {
        targetHeight = imageSize.height;
        targetWidth = Math.round((imageSize.height * 4) / 5);
      }

      const originX = Math.round((imageSize.width - targetWidth) / 2);
      const originY = Math.round((imageSize.height - targetHeight) / 2);

      const res = await ImageManipulator.manipulateAsync(
        currentUri,
        [{ crop: { originX, originY, width: targetWidth, height: targetHeight } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG },
      );
      setCurrentUri(res.uri);
      setImageSize({ width: res.width, height: res.height });
    } catch (err) {
      console.warn("Crop portrait error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  // Orijinal Görsele Sıfırla
  const handleReset = () => {
    if (imageUri) {
      setCurrentUri(imageUri);
      Image.getSize(imageUri, (width, height) => {
        setImageSize({ width, height });
      });
    }
  };

  const handleSend = async () => {
    if (!currentUri || !onSend || isProcessing || isSending) return;
    setIsProcessing(true);
    try {
      // 1. Göndermeden önce optimize et, boyutunu düşür ve EXIF/GPS metadatasını tamamen temizle
      const optimized = await processAndOptimizeImage(currentUri, {
        maxWidth: 1920,
        quality: 0.78,
      });

      onSend(optimized.uri, caption.trim());
      setCaption("");
    } catch (err) {
      console.warn("Optimize error:", err);
      // Fallback
      onSend(currentUri, caption.trim());
    } finally {
      setIsProcessing(false);
    }
  };

  const isModified = imageUri !== currentUri;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            disabled={isSending || isProcessing}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {isSendMode ? "Düzenle ve Gönder" : "Fotoğraf"}
          </Text>

          {isSendMode && isModified ? (
            <TouchableOpacity
              style={styles.resetBtn}
              onPress={handleReset}
              disabled={isSending || isProcessing}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh-outline" size={17} color="#38BDF8" />
              <Text style={styles.resetBtnText}>Sıfırla</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
        </View>

        {/* Görsel Alanı */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: currentUri }}
            style={styles.image}
            resizeMode="contain"
          />

          {isProcessing && (
            <View style={styles.processingOverlay}>
              <ActivityIndicator size="large" color="#38BDF8" />
              <Text style={styles.processingText}>İşleniyor...</Text>
            </View>
          )}
        </View>

        {/* Gönderme Modu: Düzenleme Araç Çubuğu (Kırpma, Döndürme, Çevirme) */}
        {isSendMode && (
          <View style={styles.toolsBar}>
            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleCropSquare}
              disabled={isProcessing || isSending}
              activeOpacity={0.75}
            >
              <Ionicons name="square-outline" size={20} color="#F1F5F9" />
              <Text style={styles.toolBtnText}>1:1 Kare</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleCropPortrait}
              disabled={isProcessing || isSending}
              activeOpacity={0.75}
            >
              <Ionicons name="phone-portrait-outline" size={20} color="#F1F5F9" />
              <Text style={styles.toolBtnText}>4:5 Portre</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleRotate}
              disabled={isProcessing || isSending}
              activeOpacity={0.75}
            >
              <Ionicons name="reload-outline" size={20} color="#F1F5F9" />
              <Text style={styles.toolBtnText}>Döndür</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.toolBtn}
              onPress={handleFlip}
              disabled={isProcessing || isSending}
              activeOpacity={0.75}
            >
              <Ionicons name="swap-horizontal-outline" size={20} color="#F1F5F9" />
              <Text style={styles.toolBtnText}>Çevir</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Gönderme Modu: Açıklama ve Gönder Butonu */}
        {isSendMode && (
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 10 : 0}
          >
            <View
              style={[
                styles.bottomBar,
                { paddingBottom: Math.max(insets.bottom, 12) },
              ]}
            >
              <TextInput
                style={styles.captionInput}
                placeholder="Bir açıklama ekleyin..."
                placeholderTextColor="#94A3B8"
                value={caption}
                onChangeText={setCaption}
                editable={!isSending && !isProcessing}
                multiline
                maxLength={500}
              />

              <TouchableOpacity
                style={[
                  styles.sendBtn,
                  (isSending || isProcessing) && styles.sendBtnDisabled,
                ]}
                onPress={handleSend}
                disabled={isSending || isProcessing}
                activeOpacity={0.8}
              >
                {isSending || isProcessing ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons name="send" size={20} color="#FFFFFF" style={{ marginLeft: 2 }} />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0F1A",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    backgroundColor: "rgba(11, 15, 26, 0.88)",
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
  },
  resetBtnText: {
    color: "#38BDF8",
    fontSize: 12,
    fontWeight: "600",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.65,
  },
  processingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(11, 15, 26, 0.65)",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  processingText: {
    color: "#38BDF8",
    fontSize: 13,
    fontWeight: "600",
  },
  toolsBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: "#101726",
    paddingVertical: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.06)",
  },
  toolBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    gap: 4,
  },
  toolBtnText: {
    color: "#94A3B8",
    fontSize: 11,
    fontWeight: "500",
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: "#101726",
    gap: 10,
  },
  captionInput: {
    flex: 1,
    minHeight: 42,
    maxHeight: 100,
    backgroundColor: "#182234",
    borderRadius: 21,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 15,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 2,
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
});
