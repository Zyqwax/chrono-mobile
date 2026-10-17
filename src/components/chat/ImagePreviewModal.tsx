import React, { useState } from "react";
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

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  mode?: "viewer" | "send";
  isSending?: boolean;
  onClose: () => void;
  onSend?: (caption?: string) => void;
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
  const [caption, setCaption] = useState("");

  if (!imageUri) return null;

  const isSendMode = mode === "send";

  const handleSend = () => {
    if (onSend) {
      onSend(caption.trim());
      setCaption("");
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header Bar */}
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            disabled={isSending}
            activeOpacity={0.7}
          >
            <Ionicons name="close" size={26} color="#FFFFFF" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>
            {isSendMode ? "Fotoğrafı Gönder" : "Fotoğraf"}
          </Text>

          <View style={{ width: 40 }} />
        </View>

        {/* Görsel Alanı */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            resizeMode="contain"
          />
        </View>

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
                editable={!isSending}
                multiline
                maxLength={500}
              />

              <TouchableOpacity
                style={[styles.sendBtn, isSending && styles.sendBtnDisabled]}
                onPress={handleSend}
                disabled={isSending}
                activeOpacity={0.8}
              >
                {isSending ? (
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
    backgroundColor: "#000000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    zIndex: 10,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
  headerTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT * 0.72,
  },
  bottomBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: "rgba(11, 15, 26, 0.95)",
    gap: 12,
  },
  captionInput: {
    flex: 1,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: "#FFFFFF",
    fontSize: 15,
    maxHeight: 100,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "#2563EB",
    justifyContent: "center",
    alignItems: "center",
  },
  sendBtnDisabled: {
    opacity: 0.6,
  },
});
