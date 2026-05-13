"use client";
import React, { useEffect, useState } from "react";

export type ToastType = "success" | "error" | "info" | "undo";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number; // ms, 0 = manual dismiss only
  onUndo?: () => void;
}

interface Props {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }) {
  const [exiting, setExiting] = useState(false);

  const dismiss = () => {
    setExiting(true);
    setTimeout(onDismiss, 200);
  };

  useEffect(() => {
    if (!toast.duration) return;
    const t = setTimeout(dismiss, toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration]);

  const base = "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium min-w-[260px] max-w-sm transition-all duration-200";
  const colors: Record<ToastType, string> = {
    success: "bg-gray-900 text-white",
    error: "bg-red-600 text-white",
    info: "bg-blue-600 text-white",
    undo: "bg-gray-900 text-white",
  };

  const icons: Record<ToastType, React.ReactElement> = {
    success: (
      <svg className="w-4 h-4 shrink-0 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ),
    error: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ),
    info: (
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    undo: (
      <svg className="w-4 h-4 shrink-0 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
      </svg>
    ),
  };

  return (
    <div className={`${base} ${colors[toast.type]} ${exiting ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"}`}>
      {icons[toast.type]}
      <span className="flex-1">{toast.message}</span>
      {toast.onUndo && (
        <button
          onClick={() => { toast.onUndo?.(); dismiss(); }}
          className="ml-1 px-2 py-0.5 rounded-md bg-white/20 hover:bg-white/30 text-xs font-semibold transition-colors"
        >
          取り消す
        </button>
      )}
      <button onClick={dismiss} className="ml-1 text-white/60 hover:text-white">
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}

export default function ToastContainer({ toasts, onDismiss }: Props) {
  if (!toasts.length) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 items-center pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={() => onDismiss(t.id)} />
        </div>
      ))}
    </div>
  );
}
