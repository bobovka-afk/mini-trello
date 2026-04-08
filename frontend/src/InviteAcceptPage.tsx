import { useEffect, useState } from 'react';
import { api, formatApiError, isRateLimitMessage } from './lib/api';
import {
  clearPendingInviteToken,
  getPendingInviteToken,
  storeInviteTokenFromUrl,
} from './lib/invitePending';

function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatError(e: unknown) {
  return formatApiError(e);
}

type Props = { accessToken: string | null };

export function InviteAcceptPage({ accessToken }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [attempted, setAttempted] = useState(false);

  const token =
    new URL(window.location.href).searchParams.get('token') ??
    getPendingInviteToken();

  useEffect(() => {
    storeInviteTokenFromUrl();
  }, []);

  useEffect(() => {
    if (!accessToken || !token || attempted) return;
    let cancelled = false;
    setBusy(true);
    setMsg(null);
    void (async () => {
      try {
        await api('/workspace-invite/accept-token', {
          method: 'POST',
          accessToken,
          json: { token },
        });
        clearPendingInviteToken();
        if (!cancelled) navigate('/profile/me');
      } catch (e) {
        if (!cancelled) setMsg(formatError(e));
      } finally {
        if (!cancelled) {
          setBusy(false);
          setAttempted(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, token, attempted]);

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col">
          <div className="trello-topbar-stripe-left">
            <button
              type="button"
              className="trello-top-left-brand trello-top-left-brand--stripe"
              onClick={() => navigate('/')}
            >
              <span className="trello-logo" aria-hidden />
              <span className="trello-top-left-brand-text">mini trello</span>
            </button>
          </div>
          <h1 className="trello-topbar-stripe-center">Приглашение</h1>
          <div className="trello-topbar-actions">
            <button
              type="button"
              className="trello-btn trello-btn-ghost"
              onClick={() => navigate(accessToken ? '/workspaces' : '/')}
            >
              {accessToken ? 'К пространствам' : 'На главную'}
            </button>
          </div>
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            {!token ? (
              <p className="trello-boards-sub" style={{ marginTop: 0 }}>
                В ссылке нет кода приглашения. Откройте письмо и перейдите по
                кнопке из него.
              </p>
            ) : !accessToken ? (
              <>
                <p className="trello-boards-sub" style={{ marginTop: 0 }}>
                  Чтобы принять приглашение, войдите в аккаунт с тем же email,
                  на который оно было отправлено.
                </p>
                <button
                  type="button"
                  className="trello-btn trello-btn-primary"
                  style={{ marginTop: 12 }}
                  onClick={() => navigate('/')}
                >
                  Войти
                </button>
              </>
            ) : busy ? (
              <p className="trello-boards-sub" style={{ marginTop: 0 }}>
                Принимаем приглашение…
              </p>
            ) : msg ? (
              <div
                className={
                  isRateLimitMessage(msg)
                    ? 'trello-banner trello-banner-rate-limit'
                    : 'trello-banner trello-banner-error'
                }
              >
                {msg}
              </div>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
