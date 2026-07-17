import { create } from "zustand";

export type ToastVariant = "error" | "success" | "info";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ToastOptions {
  /** Auto-dismiss delay. Defaults to 6000ms for errors and 3500ms otherwise. */
  durationMs?: number;
}

interface ToastStore {
  toasts: Toast[];
  push: (message: string, variant?: ToastVariant, options?: ToastOptions) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

export const useToastStore = create<ToastStore>((set, get) => ({
  toasts: [],
  push: (message, variant = "info", options) => {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    // Errors linger a little longer so they stay readable.
    const ttl = options?.durationMs ?? (variant === "error" ? 6000 : 3500);
    setTimeout(() => get().dismiss(id), ttl);
  },
  dismiss: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helper so non-React callers (stores) can raise toasts. */
export const toast = {
  error: (message: string, options?: ToastOptions) =>
    useToastStore.getState().push(message, "error", options),
  success: (message: string, options?: ToastOptions) =>
    useToastStore.getState().push(message, "success", options),
  info: (message: string, options?: ToastOptions) =>
    useToastStore.getState().push(message, "info", options),
};
