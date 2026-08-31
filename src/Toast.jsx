import { useCallback, useRef, useState } from "react";
import { CheckCircle, WarningCircle, X } from "@phosphor-icons/react";

const TOAST_DURATION_MS = 4000;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback((message, type = "success") => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, message, type }]);
    setTimeout(() => dismiss(id), TOAST_DURATION_MS);
  }, [dismiss]);

  return { toasts, notify, dismiss };
}

export function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="toast-stack" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <div className={`toast toast-${toast.type}`} key={toast.id}>
          {toast.type === "error" ? <WarningCircle size={18} /> : <CheckCircle size={18} weight="fill" />}
          <span>{toast.message}</span>
          <button type="button" onClick={() => onDismiss(toast.id)} aria-label="Fechar notificação"><X size={14} /></button>
        </div>
      ))}
    </div>
  );
}
