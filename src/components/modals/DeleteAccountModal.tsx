import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { ChronoDialogModal } from "./ChronoDialogModal";

interface DeleteAccountModalProps {
  visible: boolean;
  onClose: () => void;
  username: string;
  onConfirm: () => Promise<void>;
}

export const DeleteAccountModal: React.FC<DeleteAccountModalProps> = ({
  visible,
  onClose,
  username,
  onConfirm,
}) => {
  const [confirmText, setConfirmText] = useState("");
  const [loading, setLoading] = useState(false);

  const isConfirmed = confirmText.trim().toLowerCase() === username.trim().toLowerCase();

  const handleClose = () => {
    setConfirmText("");
    setLoading(false);
    onClose();
  };

  const handleExecute = async () => {
    if (!isConfirmed) return;
    setLoading(true);
    try {
      await onConfirm();
      handleClose();
    } catch {
      setLoading(false);
    }
  };

  return (
    <ChronoDialogModal
      visible={visible}
      onClose={handleClose}
      variant="danger"
      icon="trash-outline"
      title="Hesabını sil"
      description="Tüm verilerin ve mesajların kalıcı olarak silinir. Bu işlem geri alınamaz. Devam etmek için kullanıcı adını yaz."
      confirmText="Hesabı Kalıcı Olarak Sil"
      cancelText="Vazgeç"
      confirmDisabled={!isConfirmed}
      loading={loading}
      onConfirm={handleExecute}
    >
      <View style={[styles.inputContainer, isConfirmed && styles.inputContainerActive]}>
        <View style={styles.atBadge}>
          <Text style={styles.atText}>@</Text>
        </View>
        <View style={styles.inputBody}>
          <Text style={styles.inputLabel}>Onay</Text>
          <TextInput
            style={styles.textInput}
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder={`${username} yaz`}
            placeholderTextColor="#475569"
            autoCapitalize="none"
            autoCorrect={false}
          />
        </View>
      </View>
    </ChronoDialogModal>
  );
};

const styles = StyleSheet.create({
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#0B0F1A",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  inputContainerActive: {
    borderColor: "#EF4444",
  },
  atBadge: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(56, 189, 248, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  atText: {
    color: "#38BDF8",
    fontSize: 16,
    fontWeight: "700",
  },
  inputBody: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 11,
    color: "#94A3B8",
    fontWeight: "600",
    marginBottom: 2,
  },
  textInput: {
    fontSize: 15,
    color: "#FFFFFF",
    fontWeight: "600",
    padding: 0,
    height: 24,
  },
});
