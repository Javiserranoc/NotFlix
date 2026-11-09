export type Toast = { key: number; text: string };

let current: Toast | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** Aviso breve encima de la barra de pestañas (lo pinta `ToastHost`). */
export function showToast(text: string) {
  current = { key: Date.now(), text };
  emit();
}

export function clearToast() {
  current = null;
  emit();
}

export const getToast = () => current;

export function subscribeToast(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
