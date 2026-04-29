import React, { useEffect, useRef } from 'react';

const GOOGLE_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

let googleScriptPromise = null;

function loadGoogleScript() {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Google Sign-In hanya tersedia di browser.'));
  }

  if (window.google?.accounts?.id) {
    return Promise.resolve(window.google);
  }

  if (googleScriptPromise) {
    return googleScriptPromise;
  }

  googleScriptPromise = new Promise((resolve, reject) => {
    const existingScript = document.querySelector(`script[src="${GOOGLE_SCRIPT_SRC}"]`);
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.google), { once: true });
      existingScript.addEventListener('error', () => reject(new Error('Google Sign-In gagal dimuat.')), { once: true });
      return;
    }

    const script = document.createElement('script');
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error('Google Sign-In gagal dimuat.'));
    document.head.appendChild(script);
  });

  return googleScriptPromise;
}

export default function GoogleAuthButton({
  onCredential,
  disabled = false,
  text = 'continue_with',
  locale = 'id',
}) {
  const containerRef = useRef(null);
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();

  useEffect(() => {
    let cancelled = false;
    const containerElement = containerRef.current;

    const renderButton = async () => {
      if (!clientId || !containerElement) {
        return;
      }

      const google = await loadGoogleScript();
      if (cancelled || !containerElement || !google?.accounts?.id) {
        return;
      }

      containerElement.innerHTML = '';

      google.accounts.id.initialize({
        client_id: clientId,
        callback: ({ credential }) => {
          if (!disabled && credential) {
            onCredential(credential);
          }
        },
      });

      google.accounts.id.renderButton(containerElement, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text,
        locale,
        shape: 'rectangular',
        logo_alignment: 'left',
        width: Math.max(220, containerElement.offsetWidth || 320),
      });
    };

    renderButton().catch(() => {
      if (containerElement) {
        containerElement.innerHTML = '';
      }
    });

    return () => {
      cancelled = true;
      if (containerElement) {
        containerElement.innerHTML = '';
      }
    };
  }, [clientId, disabled, locale, onCredential, text]);

  if (!clientId) {
    return null;
  }

  return (
    <div className={disabled ? 'opacity-60 pointer-events-none' : ''}>
      <div ref={containerRef} className="flex justify-center w-full" />
    </div>
  );
}
