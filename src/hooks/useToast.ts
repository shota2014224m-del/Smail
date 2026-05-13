import { useState, useCallback } from "react";
import type { ToastItem, ToastType } from "@/components/Toast";

let counter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, type: ToastType = "success", options?: { duration?: number; onUndo?: () => void }) => {
      const id = `toast_${++counter}`;
      const item: ToastItem = {
        id,
        type,
        message,
        duration: options?.duration ?? (type === "undo" ? 5000 : 3000),
        onUndo: options?.onUndo,
      };
      setToasts((prev) => [...prev, item]);
      return id;
    },
    []
  );

  return { toasts, toast, dismiss };
}
