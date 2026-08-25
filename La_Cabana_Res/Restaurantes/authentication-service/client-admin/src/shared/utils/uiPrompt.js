import { useUIStore } from '../../features/auth/store/uiStore';

/**
 * Reemplazo de window.prompt() basado en un modal de React (ver
 * features/auth/components/PromptModal.jsx). Necesario porque el WebView
 * de Android que empaqueta el APK no muestra window.prompt()/alert() y los
 * resuelve como null en silencio, dejando el flujo "cancelado" sin avisar.
 *
 * Devuelve una Promise que resuelve con el texto ingresado, o con null si
 * el usuario cancela — igual que window.prompt(), pero sin bloquear el hilo
 * y funcionando igual en web y en el APK.
 */
export function askPrompt({ title, message, defaultValue = '', confirmLabel } = {}) {
  return new Promise((resolve) => {
    useUIStore.getState().openPrompt({
      title,
      message,
      defaultValue,
      confirmLabel,
      onSubmit: (value) => resolve(value),
      onCancel: () => resolve(null),
    });
  });
}
