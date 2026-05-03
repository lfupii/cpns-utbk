const PENDING_GOOGLE_CREDENTIAL_KEY = 'pendingGoogleCredential';

export function setPendingGoogleCredential(credential) {
  if (typeof window === 'undefined' || !credential) {
    return;
  }

  window.sessionStorage.setItem(PENDING_GOOGLE_CREDENTIAL_KEY, credential);
}

export function getPendingGoogleCredential() {
  if (typeof window === 'undefined') {
    return '';
  }

  return window.sessionStorage.getItem(PENDING_GOOGLE_CREDENTIAL_KEY) || '';
}

export function clearPendingGoogleCredential() {
  if (typeof window === 'undefined') {
    return;
  }

  window.sessionStorage.removeItem(PENDING_GOOGLE_CREDENTIAL_KEY);
}
