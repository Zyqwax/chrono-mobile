import React from "react";
import { ChronoDialogModal } from "./ChronoDialogModal";

export interface AlertState {
  visible: boolean;
  title: string;
  message?: string;
  type?: "success" | "error" | "info" | "warning";
}

interface ChronoAlertModalProps {
  state: AlertState;
  onClose: () => void;
}

export const ChronoAlertModal: React.FC<ChronoAlertModalProps> = ({ state, onClose }) => {
  const getIcon = () => {
    switch (state.type) {
      case "success":
        return "checkmark-circle-outline";
      case "error":
        return "alert-circle-outline";
      case "warning":
        return "warning-outline";
      default:
        return "information-circle-outline";
    }
  };

  const getVariant = () => {
    switch (state.type) {
      case "success":
        return "success";
      case "error":
      case "warning":
        return "danger";
      default:
        return "primary";
    }
  };

  return (
    <ChronoDialogModal
      visible={state.visible}
      onClose={onClose}
      variant={getVariant()}
      icon={getIcon()}
      title={state.title}
      description={state.message}
      confirmText="Tamam"
      cancelText=""
      onConfirm={onClose}
    />
  );
};
