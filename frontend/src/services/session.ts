export const SESSION_EXPIRED_EVENT = 'cafam:session-expired';

let expirationHandled = false;

export function clearStoredSession() {
  localStorage.removeItem('cafam_token');
  localStorage.removeItem('cafam_user');
  localStorage.removeItem('cafam_demo');
}

export function notifySessionExpired() {
  if (expirationHandled) return;
  expirationHandled = true;
  clearStoredSession();
  window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
}

export function resetSessionExpiration() {
  expirationHandled = false;
}

export function isJwtExpired(token: string) {
  if (token === 'demo-token') return false;
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = encoded.padEnd(Math.ceil(encoded.length / 4) * 4, '=');
    const payload = JSON.parse(atob(padded));
    return typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}
