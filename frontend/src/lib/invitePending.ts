import { api } from './api';

const KEY = 'pending_invite_token';

export function storeInviteTokenFromUrl(): string | null {
  const t = new URL(window.location.href).searchParams.get('token');
  if (t) sessionStorage.setItem(KEY, t);
  return t;
}

export function getPendingInviteToken(): string | null {
  return sessionStorage.getItem(KEY);
}

export function clearPendingInviteToken() {
  sessionStorage.removeItem(KEY);
}

export async function tryAcceptPendingInvite(
  accessToken: string,
): Promise<'ok' | 'none' | 'fail'> {
  const pending = sessionStorage.getItem(KEY);
  if (!pending) return 'none';
  try {
    await api('/workspace-invite/accept-token', {
      method: 'POST',
      accessToken,
      json: { token: pending },
    });
    clearPendingInviteToken();
    return 'ok';
  } catch {
    return 'fail';
  }
}
