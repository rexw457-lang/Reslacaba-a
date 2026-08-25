import React, { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../store/uiStore';

// Sustituye a window.prompt(). Dentro del WebView del APK, window.prompt()
// no muestra nada y devuelve null en silencio, por lo que cualquier flujo
// que dependa de él se cancela sin avisar. Este modal vive en el árbol de
// React, así que se comporta igual en la web y en el APK.
export const UiPromptHost = () => {
  const prompt = useUIStore((s) => s.prompt);
  const closePrompt = useUIStore((s) => s.closePrompt);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!prompt) return;
    setValue(prompt.defaultValue ?? '');
    const id = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(id);
  }, [prompt]);

  if (!prompt) return null;

  const handleCancel = () => {
    prompt.onCancel?.();
    closePrompt();
  };

  const handleSubmit = () => {
    prompt.onSubmit?.(value);
    closePrompt();
  };

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4'>
      <div
        className='w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 text-center shadow-lg'
        role='dialog'
        aria-modal='true'
        aria-labelledby='ui-prompt-title'
      >
        <h2 id='ui-prompt-title' className='mb-2 text-xl font-bold'>
          {prompt.title}
        </h2>
        {prompt.message && <p className='mb-4 text-gray-600'>{prompt.message}</p>}
        <input
          ref={inputRef}
          type='text'
          inputMode='decimal'
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') handleCancel();
          }}
          className='w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-lg focus:border-main-blue focus:outline-none focus:ring-2 focus:ring-main-blue/30'
        />
        <div className='mt-4 flex justify-center gap-4'>
          <button
            type='button'
            onClick={handleCancel}
            className='rounded-lg bg-gray-200 px-5 py-2 font-medium text-gray-700 transition hover:bg-gray-300'
          >
            Cancelar
          </button>
          <button
            type='button'
            onClick={handleSubmit}
            className='rounded-lg bg-main-blue px-5 py-2 font-medium text-white transition hover:opacity-90'
          >
            {prompt.confirmLabel || 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
};
