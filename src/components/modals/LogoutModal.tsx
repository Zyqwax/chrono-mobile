import React from "react";
import { ChronoDialogModal } from "./ChronoDialogModal";

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutModal: React.FC<LogoutModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  return (
    <ChronoDialogModal
      visible={visible}
      onClose={onClose}
      variant="danger"
      icon="log-out-outline"
      title="Çıkış yapılsın mı?"
      description="Bu cihazdaki oturum kapanır. Tekrar girmek için kullanıcı adın ve şifren gerekir."
      confirmText="Çıkış Yap"
      cancelText="Vazgeç"
      onConfirm={onConfirm}
    />
  );
};
