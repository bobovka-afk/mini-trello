import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { api, API_URL, type ApiError } from './lib/api';
import { WorkspacesPage } from './WorkspacesPage';
import { WorkspaceBoardsPage } from './WorkspaceBoardsPage';
import { BoardPage } from './BoardPage';
import { WorkspaceMembersPage } from './WorkspaceMembersPage';
import { ProfileInvitesSection } from './ProfileInvitesSection';
import './index.css';

type UserSafe = {
  id: number;
  email: string;
  name: string;
  avatarPath?: string | null;
  createdAt: string;
};

type AuthResponse = { user: UserSafe; accessToken: string };

const ACCESS_TOKEN_KEY = 'mini_trello_access_token';

function useRoute() {
  const [path, setPath] = useState(() => window.location.pathname);
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  return path;
}

function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function getAccessTokenFromStorage() {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function setAccessTokenToStorage(token: string | null) {
  if (!token) localStorage.removeItem(ACCESS_TOKEN_KEY);
  else localStorage.setItem(ACCESS_TOKEN_KEY, token);
}

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
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

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar">
          <div>
            <h1 className="trello-boards-title">Подтверждение email</h1>
            <p className="trello-boards-sub">Запрос письма с ссылкой</p>
          </div>
          <button className="trello-btn trello-btn-ghost" onClick={() => navigate('/')} type="button">
            На главную
          </button>
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
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
              onClick={() => void submit()}
              disabled={busy}
              type="button"
            >
              {busy ? '…' : 'Отправить письмо'}
            </button>

            {msg && (
              <div
                className={
                  isErrorMsg ? 'trello-banner trello-banner-error' : 'trello-banner trello-banner-warn'
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

  let title = 'Invalid';
  if (status === 'success') title = 'Success';
  else if (status === 'expired') title = 'Expired';
  else if (status === 'missing') title = 'Missing token';

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar">
          <div>
            <h1 className="trello-boards-title">Подтверждение email</h1>
            <p className="trello-boards-sub">Результат: {title}</p>
          </div>
          <button className="trello-btn trello-btn-ghost" onClick={() => navigate('/')} type="button">
            На главную
          </button>
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
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

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar">
          <div>
            <h1 className="trello-boards-title">Сброс пароля</h1>
            <p className="trello-boards-sub">Запрос ссылки на почту</p>
          </div>
          <button className="trello-btn trello-btn-ghost" onClick={() => navigate('/')} type="button">
            На главную
          </button>
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
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
              onClick={() => void submit()}
              disabled={busy}
              type="button"
            >
              {busy ? '…' : 'Отправить письмо'}
            </button>

            {msg && (
              <div
                className={
                  isErrorMsg ? 'trello-banner trello-banner-error' : 'trello-banner trello-banner-warn'
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

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar">
          <div>
            <h1 className="trello-boards-title">Сброс пароля</h1>
            <p className="trello-boards-sub">Введите новый пароль по ссылке из письма</p>
          </div>
          <button className="trello-btn trello-btn-ghost" onClick={() => navigate('/')} type="button">
            На главную
          </button>
        </header>

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            {!token ? (
              <div className="trello-banner trello-banner-error">
                В ссылке нет параметра <code>token</code>. Откройте письмо и перейдите по ссылке оттуда.
              </div>
            ) : (
              <>
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
                  onClick={() => void submit()}
                  disabled={busy || !newPassword}
                  type="button"
                >
                  {busy ? '…' : 'Сохранить пароль'}
                </button>
              </>
            )}

            {msg && (
              <div
                className={
                  isErrorMsg ? 'trello-banner trello-banner-error' : 'trello-banner trello-banner-warn'
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

function avatarSrcForToolbar(p: string | null | undefined): string {
  if (!p) return '';
  const normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('data:')) return normalized;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  if (normalized.startsWith('//')) return `https:${normalized}`;
  if (normalized.startsWith('/')) return `${API_URL}${normalized}`;
  return `${API_URL}/${normalized}`;
}

function Home(props: { onAuthed: (token: string) => void; hasSession: boolean }) {
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
      if (mode === 'register') {
        await api<UserSafe>('/auth/register', {
          method: 'POST',
          json: { email, password, name },
        });
        setMsg('Регистрация ок. Теперь залогинься.');
        setMode('login');
        return;
      }

      const res = await api<AuthResponse>('/auth/login', {
        method: 'POST',
        json: { email, password },
      });
      props.onAuthed(res.accessToken);
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
        <button
          type="button"
          className="trello-home-brand"
          onClick={() => (props.hasSession ? navigate('/workspaces') : navigate('/'))}
        >
          <span className="trello-logo" aria-hidden />
          Mini Trello
        </button>
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
          <p className="trello-home-sub trello-home-sub-center">
            {mode === 'login'
              ? 'Войдите, чтобы открыть доски и рабочие пространства'
              : 'Зарегистрируйтесь и приглашайте команду на доски'}
          </p>

          {msg && (
            <div className="trello-banner trello-banner-error" style={{ marginBottom: 16 }}>
              {msg}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              type="button"
              className="trello-btn trello-btn-primary trello-home-submit"
              onClick={() => void submit()}
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
          </div>
        </div>
      </main>
    </div>
  );
}

function ProfileMePage(props: { accessToken: string | null }) {
  const [user, setUser] = useState<UserSafe | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [avatarEditMenuOpen, setAvatarEditMenuOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    async function load() {
      setMsg(null);
      if (!props.accessToken) {
        setMsg('Пожалуйста, сначала выполните вход.');
        return;
      }

      try {
        const res = await api<UserSafe>('/user/me', {
          method: 'GET',
          accessToken: props.accessToken,
        });
        setUser(res);
      } catch (e) {
        setMsg(formatError(e));
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    load();
  }, [props.accessToken]);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    setAvatarError(false);
  }, [user?.avatarPath, previewUrl]);

  const avatarSrc = useMemo(() => {
    if (!user) return '';
    const p = previewUrl || user.avatarPath || '';
    if (!p) return '';
    if (p.startsWith('data:')) return p;
    if (p.startsWith('http://') || p.startsWith('https://')) return p;
    if (p.startsWith('//')) return `https:${p}`;
    if (p.startsWith('/')) return `${API_URL}${p}`;
    return `${API_URL}/${p}`;
  }, [previewUrl, user]);

  async function uploadAvatar(fileToUpload: File) {
    if (!props.accessToken) return;

    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', fileToUpload);

      const updated = await api<UserSafe>('/user/update-avatar', {
        method: 'PATCH',
        accessToken: props.accessToken,
        body: form,
      });
      setUser(updated);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMsg('Аватар обновлён.');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  function onPickFile(file: File | null) {
    setMsg(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    if (!file) return;

    // Чтобы не упираться в MaxLength на бэке (и не отправлять огромные строки).
    const MAX_BYTES = 50 * 1024; // ~50 KB
    if (file.size > MAX_BYTES) {
      setMsg('Файл слишком большой. Максимум ~50 KB.');
      return;
    }

    const nextPreview = URL.createObjectURL(file);
    setPreviewUrl(nextPreview);
    void uploadAvatar(file);
  }

  function triggerPick() {
    setMsg(null);
    fileInputRef.current?.click();
  }

  async function removeAvatar() {
    if (!props.accessToken) return;

    setBusy(true);
    setMsg(null);
    try {
      const updated = await api<UserSafe>('/user/remove-avatar', {
        method: 'DELETE',
        accessToken: props.accessToken,
      });
      setUser(updated);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
      setMsg('Аватар удалён.');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  function formatRegisteredRU(isoDate: string) {
    const d = new Date(isoDate);
    const day = d.getDate();
    // Месяц в родительном падеже (например: 20 марта, 5 апреля)
    const monthGenitive = [
      'января',
      'февраля',
      'марта',
      'апреля',
      'мая',
      'июня',
      'июля',
      'августа',
      'сентября',
      'октября',
      'ноября',
      'декабря',
    ];
    const month = monthGenitive[d.getMonth()] ?? '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  const isErrorMsg =
    typeof msg === 'string' &&
    (msg.toLowerCase().includes('ошиб') || msg.toLowerCase().includes('error'));

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar">
          <div>
            <button type="button" className="trello-top-left-brand" onClick={() => navigate('/workspaces')}>
              <span className="trello-logo" aria-hidden />
              <span className="trello-top-left-brand-text">mini trello</span>
            </button>
            <h1 className="trello-boards-title">Профиль</h1>
            <p className="trello-boards-sub">Личные данные и приглашения</p>
          </div>
          <button className="trello-btn trello-btn-ghost" onClick={() => navigate('/workspaces')} type="button">
            Назад
          </button>
        </header>

        {msg && (
          <div className={isErrorMsg ? 'trello-banner trello-banner-error' : 'trello-banner trello-banner-warn'}>
            {msg}
          </div>
        )}

        <section className="trello-panel">
          <div style={{ padding: 16 }}>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start' }}>
              <div style={{ width: 160, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ marginTop: 12 }}>
                  <div className="avatarWrap">
                    {previewUrl || user?.avatarPath ? (
                      !avatarError ? (
                        <img
                          className="avatarImg"
                          src={avatarSrc}
                          alt="avatar"
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          crossOrigin="anonymous"
                          onError={() => setAvatarError(true)}
                        />
                      ) : (
                        <div className="trello-cell-meta" style={{ marginTop: 0, padding: 0 }}>
                          Не удалось загрузить аватар
                        </div>
                      )
                    ) : (
                      <div className="trello-cell-meta" style={{ marginTop: 0, padding: 0 }}>
                        Нет аватара
                      </div>
                    )}

                    <button
                      type="button"
                      className="avatar-edit-toggle"
                      onClick={() => setAvatarEditMenuOpen((o) => !o)}
                      disabled={busy}
                      aria-label="Изменить аватар"
                    >
                      <span className="avatar-edit-toggle-icon" aria-hidden>
                        ✎
                      </span>
                      <span className="avatar-edit-toggle-text">Изменить</span>
                    </button>

                    {avatarEditMenuOpen && (
                      <div className="avatar-edit-menu" role="menu" aria-label="Действия с аватаром">
                        <button
                          type="button"
                          className="trello-btn trello-btn-primary trello-btn-sm avatar-edit-menu-btn"
                          disabled={busy}
                          onClick={() => {
                            setAvatarEditMenuOpen(false);
                            triggerPick();
                          }}
                        >
                          {busy ? '…' : 'Загрузить фото'}
                        </button>
                        <button
                          type="button"
                          className="trello-btn trello-btn-danger-ghost trello-btn-sm avatar-edit-menu-btn"
                          disabled={busy || !user?.avatarPath}
                          onClick={() => {
                            setAvatarEditMenuOpen(false);
                            void removeAvatar();
                          }}
                        >
                          {busy ? '…' : 'Удалить фото'}
                        </button>
                      </div>
                    )}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
                    disabled={busy}
                  />
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 12, fontWeight: 600 }}>{user?.name || '-'}</div>

                <div className="trello-label">Почта</div>
                <div style={{ marginBottom: 12 }}>{user?.email || '-'}</div>

                <div className="trello-label">Зарегистрирован</div>
                <div style={{ marginBottom: 12 }}>
                  {user?.createdAt ? formatRegisteredRU(user.createdAt) : '-'}
                </div>
              </div>
            </div>
          </div>
        </section>

        <div style={{ marginTop: 20 }}>
          <ProfileInvitesSection accessToken={props.accessToken} />
        </div>
      </div>
    </div>
  );
}

function App() {
  const route = useRoute();
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    const stored = getAccessTokenFromStorage();
    if (stored) return stored;
    const url = new URL(window.location.href);
    return url.searchParams.get('accessToken');
  });

  type Theme = 'light' | 'dark';
  const THEME_KEY = 'mini_trello_theme';
  const getInitialTheme = (): Theme => {
    const fromStorage = localStorage.getItem(THEME_KEY);
    if (fromStorage === 'light' || fromStorage === 'dark') return fromStorage;
    try {
      return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } catch {
      return 'light';
    }
  };

  const [theme, setTheme] = useState<Theme>(() => getInitialTheme());
  const [toolbarUser, setToolbarUser] = useState<UserSafe | null>(null);
  const [toolbarAvatarBroken, setToolbarAvatarBroken] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  const setToken = (t: string | null) => {
    setAccessTokenToStorage(t);
    setAccessToken(t);
  };

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get('accessToken');
    if (!tokenFromQuery) return;
    setToken(tokenFromQuery);
    url.searchParams.delete('accessToken');
    window.history.replaceState({}, '', url.pathname + url.search);
    if (url.pathname.startsWith('/dashboard')) {
      navigate('/workspaces');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!accessToken) {
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
    setToolbarAvatarBroken(false);
  }, [toolbarUser?.avatarPath]);

  useEffect(() => {
    setProfileMenuOpen(false);
  }, [route]);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onDocMouseDown(e: MouseEvent) {
      const el = profileMenuRef.current;
      if (el && !el.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [profileMenuOpen]);

  useEffect(() => {
    const protectedPath =
      route === '/workspaces' ||
      route.startsWith('/workspaces/') ||
      route.startsWith('/profile');
    if (!accessToken && protectedPath) {
      navigate('/');
    }
  }, [route, accessToken]);

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  const toolbarInitials = useMemo(() => {
    const n = toolbarUser?.name?.trim();
    if (!n) return '?';
    const parts = n.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0]![0]!}${parts[1]![0]!}`.toUpperCase();
    return n.slice(0, 2).toUpperCase();
  }, [toolbarUser?.name]);

  const toolbarAvatarSrc =
    toolbarUser?.avatarPath && !toolbarAvatarBroken ? avatarSrcForToolbar(toolbarUser.avatarPath) : '';

  async function handleLogout() {
    try {
      await api<boolean>('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setToken(null);
    setProfileMenuOpen(false);
    navigate('/');
  }

  const boardDetailMatch = route.match(/^\/workspaces\/(\d+)\/boards\/(\d+)$/);
  const boardsListMatch = route.match(/^\/workspaces\/(\d+)\/boards\/?$/);
  const memberRouteMatch = route.match(/^\/workspaces\/(\d+)\/members$/);
  let page: ReactElement;
  if (boardDetailMatch) {
    page = (
      <BoardPage
        accessToken={accessToken}
        workspaceId={Number(boardDetailMatch[1])}
        boardId={Number(boardDetailMatch[2])}
      />
    );
  } else if (boardsListMatch) {
    page = (
      <WorkspaceBoardsPage accessToken={accessToken} workspaceId={Number(boardsListMatch[1])} />
    );
  } else if (memberRouteMatch) {
    page = <WorkspaceMembersPage accessToken={accessToken} workspaceId={Number(memberRouteMatch[1])} />;
  } else if (route.startsWith('/dashboard')) {
    // Google callback redirects here; we no longer show dashboard UI.
    page = <WorkspacesPage accessToken={accessToken} />;
  } else if (route.startsWith('/workspaces')) {
    page = <WorkspacesPage accessToken={accessToken} />;
  } else if (route.startsWith('/profile')) {
    page = <ProfileMePage accessToken={accessToken} />;
  } else if (route.startsWith('/test/email-verification/request')) {
    page = <EmailVerificationRequestPage />;
  } else if (route.startsWith('/email-verified')) {
    page = <EmailVerifiedStatusPage />;
  } else if (route.startsWith('/test/password-reset/request')) {
    page = <PasswordResetRequestPage />;
  } else if (route.startsWith('/reset-password')) {
    page = <PasswordResetConfirmPage />;
  } else {
    page = <Home onAuthed={(t) => setToken(t)} hasSession={!!accessToken} />;
  }

  const themeSwitch = (
    <label className="theme-switch" aria-label="Тёмная тема">
      <input
        className="theme-switch-input"
        type="checkbox"
        checked={theme === 'dark'}
        onChange={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
      />
      <span className="theme-switch-track" aria-hidden>
        <span className="theme-switch-thumb" />
      </span>
    </label>
  );

  return (
    <>
      <div className="trello-fixed-toolbar" aria-label="Параметры приложения">
        {!accessToken && (
          <div className="theme-toggle trello-theme-toggle-inline" aria-label="Theme switch">
            <span className="theme-toggle-icon" aria-hidden>
              ◐
            </span>
            {themeSwitch}
          </div>
        )}
        {accessToken && (
          <div className="trello-profile-dropdown" ref={profileMenuRef}>
            <button
              type="button"
              className="trello-toolbar-avatar-btn"
              title="Меню"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              onClick={() => setProfileMenuOpen((o) => !o)}
            >
              {toolbarAvatarSrc ? (
                <img
                  src={toolbarAvatarSrc}
                  alt=""
                  className="trello-toolbar-avatar-img"
                  onError={() => setToolbarAvatarBroken(true)}
                />
              ) : (
                <span className="trello-toolbar-avatar-fallback">{toolbarInitials}</span>
              )}
            </button>
            {profileMenuOpen && (
              <div className="trello-profile-menu" role="menu">
                <button
                  type="button"
                  className="trello-profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    navigate('/profile/me');
                    setProfileMenuOpen(false);
                  }}
                >
                  Профиль
                </button>
                <div className="trello-profile-menu-theme" role="presentation">
                  <span className="trello-profile-menu-theme-label">
                    <svg className="trello-moon-icon" viewBox="0 0 24 24" aria-hidden>
                      <path
                        fill="currentColor"
                        d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.54 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.86.89-3.51 2.26-4.4-.44-.06-.9-.1-1.36-.1z"
                      />
                    </svg>
                    Темное оформление
                  </span>
                  {themeSwitch}
                </div>
                <button
                  type="button"
                  className="trello-profile-menu-item"
                  role="menuitem"
                  onClick={() => {
                    navigate('/workspaces');
                    setProfileMenuOpen(false);
                  }}
                >
                  Мои рабочие пространства
                </button>
                <button
                  type="button"
                  className="trello-profile-menu-item trello-profile-menu-logout"
                  role="menuitem"
                  onClick={() => void handleLogout()}
                >
                  Выйти
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      {page}
    </>
  );
}

export default App;
