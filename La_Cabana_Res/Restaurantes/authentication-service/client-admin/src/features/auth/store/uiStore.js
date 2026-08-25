import { create } from 'zustand';

export const useUIStore = create((set) => ({
  modal: null,
  confirm: null,
  prompt: null,

  openModal: (title, message, onClose) =>
    set({
      modal: { title, message, onClose },
    }),

  closeModal: () => set({ modal: null }),

  openConfirm: (title, message, onConfirm, onCancel) =>
    set({
      confirm: { title, message, onConfirm, onCancel },
    }),
  closeConfirm: () => set({ confirm: null }),

  // Reemplazo de window.prompt(): los WebView de Android (como el que usa
  // el APK) no muestran los diálogos nativos de JS, así que esto se resuelve
  // con un modal propio de React que sí funciona igual en web y en el APK.
  openPrompt: ({ title, message, defaultValue = '', confirmLabel, onSubmit, onCancel }) =>
    set({
      prompt: { title, message, defaultValue, confirmLabel, onSubmit, onCancel },
    }),
  closePrompt: () => set({ prompt: null }),
}));
