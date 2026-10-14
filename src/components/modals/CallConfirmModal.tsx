import React from "react";
import { ChronoDialogModal } from "./ChronoDialogModal";

interface CallConfirmModalProps {
  visible: boolean;
  onClose: () => void;
  chatTitle: string;
  isVideo: boolean;
  onConfirm: () => void;
}

export const CallConfirmModal: React.FC<CallConfirmModalProps> = ({
  visible,
  onClose,
  chatTitle,
  isVideo,
  onConfirm,
}) => {
  return (
    <ChronoDialogModal
      visible={visible}
      onClose={onClose}
      variant="primary"
      icon={isVideo ? "videocam-outline" : "call-outline"}
      title={isVideo ? "Görüntülü Arama" : "Sesli Arama"}
      description={`${chatTitle} kullanıcısını ${isVideo ? "görüntülü" : "sesli"} olarak aramak istiyor musunuz?`}
      confirmText="Ara"
      cancelText="Vazgeç"
      onConfirm={onConfirm}
    />
  );
};
