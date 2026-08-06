import { useState, useEffect } from 'react';
import { verifyEmail as verifyEmailRequest } from '../../../shared/apis';
import { showError, showSuccess } from '../../../shared/utils/toast.js';

// Evita multiples requests en React StrictMode (montaje doble).
const verifyPromiseByToken = new Map();
const verifyResultByToken = new Map();
const toastShownByToken = new Map();
const finishCalledByToken = new Map();

export const useVerifyEmail = (token, onFinish) => {
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    const finishOnce = (key, nextStatus) => {
      if (!finishCalledByToken.get(key)) {
        finishCalledByToken.set(key, true);
        onFinish && onFinish(nextStatus);
      }
    };

    const run = async () => {
      if (!token) {
        const invalidTokenKey = 'invalid-token';
        setStatus('error');
        setMessage('Token invalido.');

        if (!toastShownByToken.get(invalidTokenKey)) {
          showError('Token invalido.');
          toastShownByToken.set(invalidTokenKey, true);
        }

        finishOnce(invalidTokenKey, 'error');
        return;
      }

      const cached = verifyResultByToken.get(token);
      if (cached) {
        if (isMounted) {
          setStatus(cached.status);
          setMessage(cached.message);
        }

        if (!toastShownByToken.get(token)) {
          toastShownByToken.set(token, true);
          cached.status === 'success'
            ? showSuccess('Correo verificado correctamente.')
            : showError(cached.message);
        }

        finishOnce(token, cached.status);
        return;
      }

      let promise = verifyPromiseByToken.get(token);
      if (!promise) {
        promise = verifyEmailRequest(token)
          .then((res) => {
            if (res.status === 200) {
              const successMessage =
                'Tu correo ha sido verificado correctamente. Seras redirigido al login...';
              const result = { status: 'success', message: successMessage };
              verifyResultByToken.set(token, result);
              return result;
            }

            const errorMessage = 'El enlace ha expirado o no es valido.';
            const result = { status: 'error', message: errorMessage };
            verifyResultByToken.set(token, result);
            return result;
          })
          .catch(() => {
            const errorMessage = 'El enlace ha expirado o no es valido.';
            const result = { status: 'error', message: errorMessage };
            verifyResultByToken.set(token, result);
            return result;
          })
          .finally(() => {
            verifyPromiseByToken.delete(token);
          });

        verifyPromiseByToken.set(token, promise);
      }

      const result = await promise;

      if (isMounted) {
        setStatus(result.status);
        setMessage(result.message);
      }

      if (!toastShownByToken.get(token)) {
        toastShownByToken.set(token, true);
        result.status === 'success'
          ? showSuccess('Correo verificado correctamente.')
          : showError(result.message);
      }

      finishOnce(token, result.status);
    };

    run();
    return () => {
      isMounted = false;
    };
  }, [token, onFinish]);

  return { status, message };
};
