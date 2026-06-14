import { useCallback, useEffect, useLayoutEffect, useState, type ReactElement } from 'react';
import { createPortal } from 'react-dom';
import {
  api,
  API_URL,
  formatApiError,
  isRateLimitMessage,
  setAccessTokenRefreshedHandler,
  setSessionExpiredHandler,
  tryRefreshAccessToken,
  type ApiError,
} from '@shared/api';
import { AppLogo } from '@shared/ui/app-logo/AppLogo';
import { routeNeedsCharacterGate, type CharacterDto } from '@entities/character';
import {
  dismissGamificationIntroPending,
  isGamificationIntroPending,
  markGamificationIntroPending,
} from '@shared/lib';
import {
  getPendingInviteToken,
  tryAcceptPendingInvite,
} from '@shared/lib';
import {
  BoardPage,
  CharacterSetupPage,
  InviteAcceptPage,
  NotificationsPage,
  parseSettingsTabFromRoute,
  ProfileCharacterPage,
  SettingsPage,
  UserCharacterPage,
  WorkspaceActivityPage,
  WorkspaceBoardsPage,
  WorkspaceMembersPage,
  WorkspacesPage,
  PersonalPage,
} from '@pages/index';
import { GamificationIntroModal, ProfileInvitesSection } from '@widgets/index';
import { AppShell, routeUsesAppShell } from '@widgets/app-shell';
import { RailIconThemeMoon, RailIconThemeSun } from '@widgets/app-shell/RailNavIcons';
import { useAppTheme } from './theme/useAppTheme';
import { navigate, SpaLink } from '@shared/lib';
import { canonicalProfilePath } from '@shared/lib/normalizeLegacyProfilePath';
import { ProfileToolbarOutletProvider } from '@shared/ui/profile-toolbar';
import '../index.css';

type UserSafe = {
  id: number;
  email: string;
  name: string;
  avatarPath?: string | null;
  hasPassword: boolean;
  createdAt: string;
};

type AuthResponse = { user: UserSafe; accessToken: string };

const ACCESS_TOKEN_KEY = 'questflow_access_token';
const ACCESS_TOKEN_KEY_LEGACY = 'mini_trello_access_token';

function migrateLegacyAccessTokenKey() {
  try {
    if (!localStorage.getItem(ACCESS_TOKEN_KEY) && localStorage.getItem(ACCESS_TOKEN_KEY_LEGACY)) {
      localStorage.setItem(ACCESS_TOKEN_KEY, localStorage.getItem(ACCESS_TOKEN_KEY_LEGACY)!);
      localStorage.removeItem(ACCESS_TOKEN_KEY_LEGACY);
    }
  } catch {
    /* ignore */
  }
}
migrateLegacyAccessTokenKey();

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

function getAccessTokenFromStorage() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function setAccessTokenToStorage(token: string | null) {
  if (!token) localStorage.removeItem(ACCESS_TOKEN_KEY);
  else localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function formatError(e: unknown) {
  return formatApiError(e);
}

function getQueryParam(name: string) {
  const url = new URL(window.location.href);
  return url.searchParams.get(name);
}

function EmailVerificationRequestPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/auth/email/verification/request', {
        method: 'POST',
        json: { email },
      });
      setMsg('Проверьте почту и папку Спам. Если аккаунт зарегистрирован — письмо придет.');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const isErrorMsg =
    typeof msg === 'string' &&
    (msg.toLowerCase().includes('ошиб') || msg.toLowerCase().includes('error'));
  const isRateLimitMsg = isRateLimitMessage(msg);

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col trello-boards-topbar--sticky">
          <div className="trello-topbar-stripe-left">
            <SpaLink className="trello-top-left-brand trello-top-left-brand--stripe" to="/">
              <AppLogo />
              <span className="trello-top-left-brand-text">Questflow</span>
            </SpaLink>
            <SpaLink className="trello-btn trello-btn-topbar-nav trello-topbar-back-btn" to="/">
              На главную
            </SpaLink>
          </div>
          <h1 className="trello-topbar-stripe-center">Подтверждение email</h1>
          <div className="trello-topbar-actions" />
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            <p className="trello-boards-sub" style={{ marginTop: 0 }}>
              Запрос письма с ссылкой
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy) void submit();
              }}
            >
              <label className="trello-field">
                <span className="trello-label">Email</span>
                <input
                  className="trello-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>

              <button
                className="trello-btn trello-btn-primary"
                style={{ marginTop: 12 }}
                disabled={busy}
                type="submit"
              >
                {busy ? '…' : 'Отправить письмо'}
              </button>
            </form>

            {msg && (
              <div
                className={
                  isRateLimitMsg
                    ? 'trello-banner trello-banner-rate-limit'
                    : isErrorMsg
                      ? 'trello-banner trello-banner-error'
                      : 'trello-banner trello-banner-warn'
                }
                style={{ marginTop: 12 }}
              >
                {msg}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmailVerifiedStatusPage() {
  const status = getQueryParam('status') || 'invalid';

  let title = 'Недействительно';
  if (status === 'success') title = 'Успешно';
  else if (status === 'expired') title = 'Срок истёк';
  else if (status === 'missing') title = 'Токен отсутствует';

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col trello-boards-topbar--sticky">
          <div className="trello-topbar-stripe-left">
            <SpaLink className="trello-top-left-brand trello-top-left-brand--stripe" to="/">
              <AppLogo />
              <span className="trello-top-left-brand-text">Questflow</span>
            </SpaLink>
            <SpaLink className="trello-btn trello-btn-topbar-nav trello-topbar-back-btn" to="/">
              На главную
            </SpaLink>
          </div>
          <h1 className="trello-topbar-stripe-center">Подтверждение email</h1>
          <div className="trello-topbar-actions" />
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            <p className="trello-boards-sub" style={{ marginTop: 0 }}>
              Результат: {title}
            </p>
            <div className="trello-banner trello-banner-warn">
              <strong>Статус:</strong> {status}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PasswordResetRequestPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/auth/password/reset/request', {
        method: 'POST',
        json: { email },
      });
      setMsg('Проверьте почту и папку Спам. Если аккаунт зарегистрирован — письмо придет.');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const isErrorMsg =
    typeof msg === 'string' &&
    (msg.toLowerCase().includes('ошиб') || msg.toLowerCase().includes('error'));
  const isRateLimitMsg = isRateLimitMessage(msg);

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col trello-boards-topbar--sticky">
          <div className="trello-topbar-stripe-left">
            <SpaLink className="trello-top-left-brand trello-top-left-brand--stripe" to="/">
              <AppLogo />
              <span className="trello-top-left-brand-text">Questflow</span>
            </SpaLink>
            <SpaLink className="trello-btn trello-btn-topbar-nav trello-topbar-back-btn" to="/">
              На главную
            </SpaLink>
          </div>
          <h1 className="trello-topbar-stripe-center">Сброс пароля</h1>
          <div className="trello-topbar-actions" />
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            <p className="trello-boards-sub" style={{ marginTop: 0 }}>
              Запрос ссылки на почту
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy) void submit();
              }}
            >
              <label className="trello-field">
                <span className="trello-label">Email</span>
                <input
                  className="trello-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>

              <button
                className="trello-btn trello-btn-primary"
                style={{ marginTop: 12 }}
                disabled={busy}
                type="submit"
              >
                {busy ? '…' : 'Отправить письмо'}
              </button>
            </form>

            {msg && (
              <div
                className={
                  isRateLimitMsg
                    ? 'trello-banner trello-banner-rate-limit'
                    : isErrorMsg
                      ? 'trello-banner trello-banner-error'
                      : 'trello-banner trello-banner-warn'
                }
                style={{ marginTop: 12 }}
              >
                {msg}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function PasswordResetConfirmPage() {
  const token = getQueryParam('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      await api('/auth/password/reset/confirm', {
        method: 'POST',
        json: { token, newPassword },
      });
      setMsg('Пароль успешно изменён.');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  const isErrorMsg =
    typeof msg === 'string' &&
    (msg.toLowerCase().includes('ошиб') || msg.toLowerCase().includes('error'));
  const isRateLimitMsg = isRateLimitMessage(msg);

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col trello-boards-topbar--sticky">
          <div className="trello-topbar-stripe-left">
            <SpaLink className="trello-top-left-brand trello-top-left-brand--stripe" to="/">
              <AppLogo />
              <span className="trello-top-left-brand-text">Questflow</span>
            </SpaLink>
            <SpaLink className="trello-btn trello-btn-topbar-nav trello-topbar-back-btn" to="/">
              На главную
            </SpaLink>
          </div>
          <h1 className="trello-topbar-stripe-center">Сброс пароля</h1>
          <div className="trello-topbar-actions" />
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            <p className="trello-boards-sub" style={{ marginTop: 0 }}>
              Введите новый пароль по ссылке из письма
            </p>
            {!token ? (
              <div className="trello-banner trello-banner-error">
                В ссылке нет параметра <code>token</code>. Откройте письмо и перейдите по ссылке оттуда.
              </div>
            ) : (
              <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!busy && newPassword) void submit();
                }}
              >
                <label className="trello-field">
                  <span className="trello-label">Новый пароль</span>
                  <input
                    className="trello-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    autoComplete="new-password"
                  />
                </label>

                <button
                  className="trello-btn trello-btn-primary"
                  style={{ marginTop: 12 }}
                  disabled={busy || !newPassword}
                  type="submit"
                >
                  {busy ? '…' : 'Сохранить пароль'}
                </button>
              </form>
              </>
            )}

            {msg && (
              <div
                className={
                  isRateLimitMsg
                    ? 'trello-banner trello-banner-rate-limit'
                    : isErrorMsg
                      ? 'trello-banner trello-banner-error'
                      : 'trello-banner trello-banner-warn'
                }
                style={{ marginTop: 12 }}
              >
                {msg}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

type AuthedOptions = { gamificationIntro?: boolean };

function GuestThemeToggle() {
  const { toggleTheme, isDark } = useAppTheme();
  return (
    <button
      type="button"
      className="px-rail-btn px-rail-btn--icon-only px-rail-btn--theme px-guest-theme-toggle"
      aria-label={isDark ? 'Переключить на светлую тему' : 'Переключить на тёмную тему'}
      onClick={toggleTheme}
    >
      {isDark ? (
        <RailIconThemeSun className="px-rail-btn__ico" />
      ) : (
        <RailIconThemeMoon className="px-rail-btn__ico" />
      )}
    </button>
  );
}

function Home(props: { onAuthed: (token: string, options?: AuthedOptions) => void; hasSession: boolean }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function submit() {
    setMsg(null);
    setBusy(true);
    try {
      const fromRegister = mode === 'register';
      if (fromRegister) {
        await api<UserSafe>('/auth/register', {
          method: 'POST',
          json: { email, password, name },
        });
      }

      const res = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      props.onAuthed(res.accessToken, { gamificationIntro: fromRegister });
      const inviteResult = await tryAcceptPendingInvite(res.accessToken);
      if (inviteResult === 'ok') {
        navigate('/profile/character');
        return;
      }
      if (inviteResult === 'fail') {
        const p = getPendingInviteToken();
        if (p) {
          navigate(`/invite?token=${encodeURIComponent(p)}`);
          return;
        }
      }
      navigate('/workspaces');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="trello-home-shell">
      <header className="trello-home-header">
        <SpaLink className="trello-home-brand" to={props.hasSession ? '/workspaces' : '/'}>
          <AppLogo />
          Questflow
        </SpaLink>
      </header>

      <main className="trello-home-main">
        <div className="trello-home-card">
          <div className="trello-home-tabs">
            <button
              className={mode === 'login' ? 'trello-home-tab trello-home-tab-active' : 'trello-home-tab'}
              onClick={() => setMode('login')}
              type="button"
            >
              Вход
            </button>
            <button
              className={mode === 'register' ? 'trello-home-tab trello-home-tab-active' : 'trello-home-tab'}
              onClick={() => setMode('register')}
              type="button"
            >
              Регистрация
            </button>
          </div>

          <h1 className="trello-home-title trello-home-title-center">
            {mode === 'login' ? 'Вход' : 'Создать аккаунт'}
          </h1>

          {msg && (
            <div
              className={
                isRateLimitMessage(msg)
                  ? 'trello-banner trello-banner-rate-limit'
                  : 'trello-banner trello-banner-error'
              }
              style={{ marginBottom: 16 }}
            >
              {msg}
            </div>
          )}

          <form
            className="trello-home-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (!busy) void submit();
            }}
          >
            {mode === 'register' && (
              <label className="trello-field">
                <span className="trello-label">Имя</span>
                <input
                  className="trello-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={40}
                />
              </label>
            )}

            <label className="trello-field">
              <span className="trello-label">Email</span>
              <input
                className="trello-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                maxLength={80}
              />
            </label>

            <label className="trello-field">
              <span className="trello-label">Пароль</span>
              <input
                className="trello-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={80}
              />
            </label>

            <button
              type="submit"
              className="trello-btn trello-btn-primary trello-home-submit"
              disabled={busy}
            >
              {busy ? '…' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>

            <a className="trello-home-google" href={`${API_URL}/auth/google`}>
              <svg className="trello-google-icon" viewBox="0 0 24 24" aria-hidden>
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Продолжить с Google
            </a>
          </form>
        </div>
      </main>
    </div>
  );
}

function MyInvitesPage(props: { accessToken: string | null }) {
  return (
    <div className="px-page">
      <header className="px-topbar">
        <div className="px-topbar-left">
          <SpaLink className="px-btn px-btn--ghost" to="/workspaces">
            Назад
          </SpaLink>
          <h1 className="px-topbar-title">Приглашения</h1>
        </div>
        <div className="px-topbar-actions" />
      </header>
      <ProfileInvitesSection accessToken={props.accessToken} />
    </div>
  );
}

function AppContent() {
  const route = useRoute();
  const { toggleTheme, isDark } = useAppTheme();
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const stored = getAccessTokenFromStorage();
    if (stored) return stored;
    const url = new URL(window.location.href);
    return url.searchParams.get('accessToken');
  });

  const [toolbarUser, setToolbarUser] = useState<UserSafe | null>(null);
  const [characterLoadState, setCharacterLoadState] = useState<
    'idle' | 'loading' | 'missing' | 'ok'
  >('idle');
  const [gamificationIntroOpen, setGamificationIntroOpen] = useState(false);

  const setToken = (t: string | null) => {
    setAccessTokenToStorage(t);
    setAccessToken(t);
  };

  function handleAuthed(token: string, options?: AuthedOptions) {
    setToken(token);
    if (options?.gamificationIntro) {
      markGamificationIntroPending();
      setGamificationIntroOpen(true);
    }
  }

  function closeGamificationIntro() {
    setGamificationIntroOpen(false);
    dismissGamificationIntroPending();
  }

  const handleCharacterUpdated = useCallback(() => {
    setCharacterLoadState('ok');
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get('accessToken');
    if (!tokenFromQuery) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(tokenFromQuery);
    url.searchParams.delete('accessToken');
    window.history.replaceState({}, '', url.pathname + url.search);

    void (async () => {
      const inviteResult = await tryAcceptPendingInvite(tokenFromQuery);
      if (inviteResult === 'ok') {
        navigate('/profile/character');
        return;
      }
      if (inviteResult === 'fail') {
        const p = getPendingInviteToken();
        if (p) {
          navigate(`/invite?token=${encodeURIComponent(p)}`);
          return;
        }
      }
      if (url.pathname.startsWith('/dashboard')) {
        navigate('/workspaces');
      }
    })();
  }, []);

  useEffect(() => {
    if (!accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToolbarUser(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const u = await api<UserSafe>('/user/me', { method: 'GET', accessToken });
        if (!cancelled) setToolbarUser(u);
      } catch {
        if (!cancelled) setToolbarUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, route]);

  useEffect(() => {
    if (!accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCharacterLoadState('idle');
      return;
    }
    let cancelled = false;
    setCharacterLoadState('loading');
    void (async () => {
      try {
        await api<CharacterDto>('/character/me', { method: 'GET', accessToken });
        if (!cancelled) setCharacterLoadState('ok');
      } catch (e) {
        const err = e as ApiError;
        if (
          err.status === 404 &&
          (!err.code || err.code === 'CHARACTER_NOT_FOUND')
        ) {
          if (!cancelled) setCharacterLoadState('missing');
        } else if (!cancelled) {
          setCharacterLoadState('idle');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGamificationIntroOpen(false);
      return;
    }
    if (isGamificationIntroPending()) {
      setGamificationIntroOpen(true);
    }
  }, [accessToken]);

  useEffect(() => {
    const protectedPath =
      route === '/workspaces' ||
      route.startsWith('/workspaces/') ||
      route.startsWith('/profile') ||
      route.startsWith('/personal') ||
      route.startsWith('/invites') ||
      route.startsWith('/notifications') ||
      route.startsWith('/settings') ||
      route.startsWith('/character/setup') ||
      route.startsWith('/dashboard');
    if (!accessToken && protectedPath) {
      navigate('/');
    }
  }, [route, accessToken]);

  useLayoutEffect(() => {
    if (!accessToken) return;
    if (characterLoadState !== 'ok') return;
    if (route.startsWith('/character/setup')) {
      navigate('/workspaces');
    }
  }, [accessToken, characterLoadState, route]);

  useLayoutEffect(() => {
    if (route === '/' && accessToken) {
      navigate('/workspaces');
    }
  }, [route, accessToken]);

  useEffect(() => {
    setAccessTokenRefreshedHandler((token) => {
      setToken(token);
    });
    setSessionExpiredHandler(() => {
      setToken(null);
      navigate('/');
    });
    void tryRefreshAccessToken().then((token) => {
      if (token) setToken(token);
    });
    return () => {
      setAccessTokenRefreshedHandler(null);
      setSessionExpiredHandler(null);
    };
  }, []);

  useEffect(() => {
    const canonical = canonicalProfilePath(route);
    if (!canonical || canonical === route) return;
    window.history.replaceState({}, '', canonical + window.location.search);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, [route]);

  useEffect(() => {
    const m = route.match(/^\/profile\/@([a-z0-9_]{3,32})(\/character)?\/?$/);
    if (!m) return;
    let cancelled = false;
    void (async () => {
      try {
        const resolved = await api<{ id: number; username: string }>(
          `/user/public/username/${m[1]}`,
          { method: 'GET' },
        );
        if (cancelled) return;
        navigate(`/profile/${resolved.id}/character`);
      } catch {
        if (!cancelled) navigate('/profile/character');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [route]);

  async function handleLogout() {
    try {
      await api<boolean>('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setToken(null);
    navigate('/');
  }

  const boardDetailMatch = route.match(/^\/workspaces\/(\d+)\/boards\/(\d+)$/);
  const boardsListMatch = route.match(/^\/workspaces\/(\d+)\/boards\/?$/);
  const activityRouteMatch = route.match(/^\/workspaces\/(\d+)\/activity\/?$/);
  const memberRouteMatch = route.match(/^\/workspaces\/(\d+)\/members$/);
  const profileUserCharacterMatch =
    route.match(/^\/profile\/(\d+)\/character\/?$/) ??
    route.match(/^\/profile\/user\/(\d+)\/character\/?$/);
  const characterGateLoading =
    Boolean(accessToken) &&
    characterLoadState === 'loading' &&
    routeNeedsCharacterGate(route);

  let page: ReactElement;
  if (route === '/invite' || route.startsWith('/invite/')) {
    page = <InviteAcceptPage accessToken={accessToken} />;
  } else if (route.startsWith('/invites')) {
    page = <MyInvitesPage accessToken={accessToken} />;
  } else if (route === '/notifications') {
    page =
      !accessToken ? (
        <Home onAuthed={handleAuthed} hasSession={false} />
      ) : (
        <NotificationsPage accessToken={accessToken} />
      );
  } else if (characterGateLoading) {
    page = (
      <div className="px-page">
        <div className="px-content trello-character-gate-loading">Загрузка профиля персонажа…</div>
      </div>
    );
  } else if (route.startsWith('/character/setup')) {
    page =
      !accessToken ? (
        <Home onAuthed={handleAuthed} hasSession={false} />
      ) : (
        <CharacterSetupPage
          accessToken={accessToken}
          onCharacterCreated={() => setCharacterLoadState('ok')}
        />
      );
  } else if (boardDetailMatch) {
    page = (
      <BoardPage
        accessToken={accessToken}
        workspaceId={Number(boardDetailMatch[1])}
        boardId={Number(boardDetailMatch[2])}
        currentUserId={toolbarUser?.id ?? null}
      />
    );
  } else if (boardsListMatch) {
    page = (
      <WorkspaceBoardsPage accessToken={accessToken} workspaceId={Number(boardsListMatch[1])} />
    );
  } else if (activityRouteMatch) {
    page = (
      <WorkspaceActivityPage
        accessToken={accessToken}
        workspaceId={Number(activityRouteMatch[1])}
      />
    );
  } else if (memberRouteMatch) {
    page = <WorkspaceMembersPage accessToken={accessToken} workspaceId={Number(memberRouteMatch[1])} />;
  } else if (route.startsWith('/dashboard')) {
    // Google callback redirects here; we no longer show dashboard UI.
    page = <WorkspacesPage accessToken={accessToken} />;
  } else if (route.startsWith('/personal')) {
    page =
      !accessToken ? (
        <Home onAuthed={handleAuthed} hasSession={false} />
      ) : (
        <PersonalPage accessToken={accessToken} />
      );
  } else if (route.startsWith('/workspaces')) {
    page = <WorkspacesPage accessToken={accessToken} />;
  } else if (route === '/settings' || route.startsWith('/settings/')) {
    page =
      !accessToken ? (
        <Home onAuthed={handleAuthed} hasSession={false} />
      ) : (
        <SettingsPage
          accessToken={accessToken}
          initialTab={parseSettingsTabFromRoute(route)}
          onAccountDeleted={() => void handleLogout()}
          onCurrentSessionRevoked={() => void handleLogout()}
        />
      );
  } else if (route.startsWith('/profile')) {
    page =
      !accessToken ? (
        <Home onAuthed={handleAuthed} hasSession={false} />
      ) : profileUserCharacterMatch ? (
        <UserCharacterPage
          accessToken={accessToken}
          userId={Number(profileUserCharacterMatch[1])}
          currentUserId={toolbarUser?.id ?? null}
        />
      ) : (
        <ProfileCharacterPage
          accessToken={accessToken}
          onCharacterUpdated={handleCharacterUpdated}
        />
      );
  } else if (route.startsWith('/test/email-verification/request')) {
    page = <EmailVerificationRequestPage />;
  } else if (route.startsWith('/email-verified')) {
    page = <EmailVerifiedStatusPage />;
  } else if (route.startsWith('/test/password-reset/request')) {
    page = <PasswordResetRequestPage />;
  } else if (route.startsWith('/reset-password')) {
    page = <PasswordResetConfirmPage />;
  } else if (route === '/' && accessToken) {
    page = <WorkspacesPage accessToken={accessToken} />;
  } else {
    page = <Home onAuthed={handleAuthed} hasSession={!!accessToken} />;
  }

  const showShell = routeUsesAppShell(route, accessToken);
  const wrappedPage = showShell && accessToken ? (
    <AppShell
      accessToken={accessToken}
      route={route}
      themeIsDark={isDark}
      onThemeToggle={toggleTheme}
      onLogout={handleLogout}
    >
      {page}
    </AppShell>
  ) : (
    page
  );

  return (
    <>
      {!accessToken &&
        createPortal(<GuestThemeToggle />, document.body)}
      {wrappedPage}
      {accessToken &&
        createPortal(
          <GamificationIntroModal
            open={gamificationIntroOpen}
            onClose={closeGamificationIntro}
          />,
          document.body,
        )}
    </>
  );
}

export default function App() {
  return (
    <ProfileToolbarOutletProvider>
      <AppContent />
    </ProfileToolbarOutletProvider>
  );
}
