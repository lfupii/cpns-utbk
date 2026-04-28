const ACTIVE_TRYOUT_SESSION_KEY = 'activeTryoutSession';
const ACTIVE_MINI_TEST_SESSION_KEY = 'activeMiniTestSession';

function readJsonStorage(key) {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const rawValue = window.localStorage.getItem(key);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue);
  } catch (error) {
    window.localStorage.removeItem(key);
    return null;
  }
}

function writeJsonStorage(key, value) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getActiveTryoutSession() {
  return readJsonStorage(ACTIVE_TRYOUT_SESSION_KEY);
}

export function persistActiveTryoutSession({ packageId, attemptId = null } = {}) {
  const numericPackageId = Number(packageId || 0);
  if (numericPackageId <= 0) {
    return;
  }

  writeJsonStorage(ACTIVE_TRYOUT_SESSION_KEY, {
    packageId: numericPackageId,
    attemptId: Number(attemptId || 0) || null,
    updatedAt: Date.now(),
  });
}

export function clearActiveTryoutSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACTIVE_TRYOUT_SESSION_KEY);
}

export function getActiveMiniTestSession() {
  return readJsonStorage(ACTIVE_MINI_TEST_SESSION_KEY);
}

export function persistActiveMiniTestSession({ packageId, sectionCode, attemptId = null } = {}) {
  const numericPackageId = Number(packageId || 0);
  const normalizedSectionCode = String(sectionCode || '').trim();
  if (numericPackageId <= 0 || !normalizedSectionCode) {
    return;
  }

  writeJsonStorage(ACTIVE_MINI_TEST_SESSION_KEY, {
    packageId: numericPackageId,
    sectionCode: normalizedSectionCode,
    attemptId: Number(attemptId || 0) || null,
    updatedAt: Date.now(),
  });
}

export function clearActiveMiniTestSession() {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(ACTIVE_MINI_TEST_SESSION_KEY);
}

export function clearAllActiveAssessmentSessions() {
  clearActiveTryoutSession();
  clearActiveMiniTestSession();
}
