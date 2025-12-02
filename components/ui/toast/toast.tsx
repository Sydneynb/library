"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Toast = {
  id: string;
  title?: string;
  description?: string;
  duration?: number; // ms
  variant?: "checked-in" | "checked-out" | "default";
};

type ToastOptions = {
  title?: string;
  description?: string;
  duration?: number;
  variant?: "checked-in" | "checked-out" | "default";
};

type ToastContextValue = {
  notify: (opts: ToastOptions) => string;
  dismiss: (id: string) => void;
  clear: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

/**
 * useToast
 * Helper hook to create and dismiss toasts.
 *
 * Example:
 * const { notify } = useToast();
 * notify({ title: "Checked in", description: "Book has been checked in" });
 */
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return ctx;
}

/**
 * ToastProvider
 * Wrap your app with this provider (or mount near pages that will use toasts).
 * It renders the toast viewport (bottom-centered) and provides the `notify` API.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counterRef = useRef(0);

  const notify = useCallback((opts: ToastOptions) => {
    const id = `${Date.now()}-${counterRef.current++}`;
    const toast: Toast = {
      id,
      title: opts.title,
      description: opts.description,
      duration: opts.duration ?? 4000,
      variant: opts.variant ?? "default",
    };
    setToasts((t) => [toast, ...t]);
    return id;
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const clear = useCallback(() => setToasts([]), []);

  const value = useMemo(
    () => ({
      notify,
      dismiss,
      clear,
    }),
    [notify, dismiss, clear],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

/**
 * ToastViewport
 * Renders the active toasts at the bottom-center of the screen.
 */
function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-4 z-1000 flex items-end justify-center px-4"
    >
      <div className="w-full max-w-lg space-y-2">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

/**
 * Variant classes helper
 *
 * Returns className fragments for container/title/description based on variant.
 * Keeps colors aligned with the status badges used elsewhere.
 */
function variantClasses(v: Toast["variant"]) {
  switch (v) {
    case "checked-in":
      return {
        container:
          "bg-green-50 dark:bg-green-800/20 border border-green-200 dark:border-green-700 text-green-800 dark:text-green-200",
        title: "text-green-800 dark:text-green-200",
        description: "text-green-700 dark:text-green-200",
      };
    case "checked-out":
      return {
        container:
          "bg-amber-50 dark:bg-amber-800/20 border border-amber-200 dark:border-amber-700 text-amber-800 dark:text-amber-200",
        title: "text-amber-800 dark:text-amber-200",
        description: "text-amber-700 dark:text-amber-200",
      };
    default:
      return {
        container:
          "bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100",
        title: "text-slate-900 dark:text-slate-100",
        description: "text-slate-700 dark:text-slate-300",
      };
  }
}

/**
 * ToastItem
 * Single toast card. Auto-dismisses after `duration`.
 */
function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const { id, title, description, duration, variant } = toast;
  const [isVisible, setIsVisible] = useState(false);
  const mountedRef = useRef(true);
  const dismissTimerRef = useRef<number | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    // small enter delay so animation runs
    const enter = window.setTimeout(() => {
      if (mountedRef.current) setIsVisible(true);
    }, 10);

    // auto-dismiss after `duration`
    dismissTimerRef.current = window.setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      mountedRef.current = false;
      clearTimeout(enter);
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleClose = useCallback(() => {
    setIsVisible(false);
    // wait for exit animation (200ms) then remove from list
    hideTimerRef.current = window.setTimeout(() => {
      onDismiss(id);
    }, 220);
  }, [id, onDismiss]);

  const classes = variantClasses(variant ?? "default");

  return (
    <div
      className={`pointer-events-auto rounded-md ${classes.container} shadow-lg overflow-hidden transition-all transform duration-200 ease-out ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
      role="status"
      aria-atomic="true"
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1 min-w-0">
          {title && (
            <div className={`text-sm font-semibold truncate ${classes.title}`}>
              {title}
            </div>
          )}
          {description && (
            <div className={`text-xs mt-0.5 truncate ${classes.description}`}>
              {description}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            aria-label="Dismiss notification"
            onClick={handleClose}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md hover:bg-slate-100/60 dark:hover:bg-slate-800/30"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
