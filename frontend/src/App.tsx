import { useEffect, useMemo, useRef, useState } from 'react';
import { api, API_URL, type ApiError } from './lib/api';
import { WorkspacesPage } from './WorkspacesPage';
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
    <div className="jira-shell">
      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Email verification</h1>
            <p className="jira-page-desc">Request confirmation email</p>
          </div>
          <div className="jira-topbar-actions">
            <button className="jira-btn jira-btn-ghost" onClick={() => navigate('/')} type="button">
              Home
            </button>
          </div>
        </header>

        <section className="jira-panel">
          <div className="jira-modal-body">
            <label className="jira-field">
              <span className="jira-label">Email</span>
              <input
                className="jira-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@example.com"
                autoComplete="email"
              />
            </label>

            <button className="jira-btn jira-btn-primary" onClick={() => void submit()} disabled={busy} type="button">
              {busy ? '...' : 'Send verification email'}
            </button>

            {msg && <div className={isErrorMsg ? 'jira-banner jira-banner-error' : 'jira-banner'}>{msg}</div>}
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
    <div className="jira-shell">
      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Email verification</h1>
            <p className="jira-page-desc">Result: {title}</p>
          </div>
          <div className="jira-topbar-actions">
            <button className="jira-btn jira-btn-ghost" onClick={() => navigate('/')} type="button">
              Home
            </button>
          </div>
        </header>

        <section className="jira-panel">
          <div className="jira-modal-body">
            <div className="jira-banner">
              <strong>Status:</strong> {status}
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
    <div className="jira-shell">
      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Password reset</h1>
            <p className="jira-page-desc">Request reset link</p>
          </div>
          <div className="jira-topbar-actions">
            <button className="jira-btn jira-btn-ghost" onClick={() => navigate('/')} type="button">
              Home
            </button>
          </div>
        </header>

        <section className="jira-panel">
          <div className="jira-modal-body">
            <label className="jira-field">
              <span className="jira-label">Email</span>
              <input
                className="jira-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mail@example.com"
                autoComplete="email"
              />
            </label>

            <button className="jira-btn jira-btn-primary" onClick={() => void submit()} disabled={busy} type="button">
              {busy ? '...' : 'Send reset email'}
            </button>

            {msg && <div className={isErrorMsg ? 'jira-banner jira-banner-error' : 'jira-banner'}>{msg}</div>}
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
    <div className="jira-shell">
      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Password reset</h1>
            <p className="jira-page-desc">Confirm token and set new password</p>
          </div>
          <div className="jira-topbar-actions">
            <button className="jira-btn jira-btn-ghost" onClick={() => navigate('/')} type="button">
              Home
            </button>
          </div>
        </header>

        <section className="jira-panel">
          <div className="jira-modal-body">
            {!token ? (
              <div className="jira-banner jira-banner-error">
                Token отсутствует в query param `token`. Откройте ссылку из письма.
              </div>
            ) : (
              <>
                <label className="jira-field">
                  <span className="jira-label">New password</span>
                  <input
                    className="jira-input"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="new-password"
                  />
                </label>

                <button
                  className="jira-btn jira-btn-primary"
                  onClick={() => void submit()}
                  disabled={busy || !newPassword}
                  type="button"
                >
                  {busy ? '...' : 'Set new password'}
                </button>
              </>
            )}

            {msg && <div className={isErrorMsg ? 'jira-banner jira-banner-error' : 'jira-banner'}>{msg}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function Home(props: { onAuthed: (token: string) => void }) {
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
    <div className="jira-shell jira-auth-shell">
      <header className="jira-auth-header">
        <button type="button" className="jira-sidebar-brand jira-brand-btn" onClick={() => navigate('/workspaces')}>
          <span className="jira-logo-mark" aria-hidden />
          <div>
            <div className="jira-sidebar-title">Mini trello</div>
            <div className="jira-sidebar-sub">team spaces</div>
          </div>
        </button>
      </header>

      <main className="jira-auth-main">
        <div className="jira-panel jira-auth-panel">
          <div className="jira-auth-panel-head">
            <h1 className="jira-auth-title">{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
            <p className="jira-auth-subtitle">
              {mode === 'login'
                ? 'Войдите, чтобы управлять рабочими пространствами'
                : 'Создайте аккаунт и присоединяйтесь к командам'}
            </p>
          </div>

          <div className="jira-auth-tabs">
            <button
              className={mode === 'login' ? 'jira-auth-tab jira-auth-tab-active' : 'jira-auth-tab'}
              onClick={() => setMode('login')}
              type="button"
            >
              Вход
            </button>
            <button
              className={mode === 'register' ? 'jira-auth-tab jira-auth-tab-active' : 'jira-auth-tab'}
              onClick={() => setMode('register')}
              type="button"
            >
              Регистрация
            </button>
          </div>

          {msg && <div className="jira-banner jira-banner-error">{msg}</div>}

          <div className="jira-auth-form">
            {mode === 'register' && (
              <label className="jira-field">
                <span className="jira-label">Имя</span>
                <input
                  className="jira-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={40}
                />
              </label>
            )}

            <label className="jira-field">
              <span className="jira-label">Email</span>
              <input
                className="jira-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                maxLength={80}
              />
            </label>

            <label className="jira-field">
              <span className="jira-label">Пароль</span>
              <input
                className="jira-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                maxLength={80}
              />
            </label>

            <button
              type="button"
              className="jira-btn jira-btn-primary jira-auth-submit"
              onClick={() => void submit()}
              disabled={busy}
            >
              {busy ? '...' : mode === 'login' ? 'Войти' : 'Зарегистрироваться'}
            </button>

            <a className="jira-btn jira-btn-ghost jira-auth-google" href={`${API_URL}/auth/google`}>
              Продолжить с Google
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}

function Dashboard(props: { accessToken: string | null; setToken: (t: string | null) => void }) {
  const [status, setStatus] = useState<string | null>(null);

  const accessTokenShort = useMemo(() => {
    if (!props.accessToken) return '(empty)';
    return `${props.accessToken.slice(0, 18)}...${props.accessToken.slice(-10)}`;
  }, [props.accessToken]);

  useEffect(() => {
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get('accessToken');
    if (tokenFromQuery) {
      props.setToken(tokenFromQuery);
      url.searchParams.delete('accessToken');
      window.history.replaceState({}, '', url.pathname + url.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function refresh() {
    setStatus(null);
    try {
      const res = await api<AuthResponse>('/auth/login/access-token', { method: 'POST' });
      props.setToken(res.accessToken);
      setStatus('Refreshed');
    } catch (e) {
      setStatus(formatError(e));
    }
  }

  async function logout() {
    setStatus(null);
    try {
      await api<boolean>('/auth/logout', { method: 'POST' });
      props.setToken(null);
      navigate('/');
    } catch (e) {
      setStatus(formatError(e));
    }
  }

  return (
    <div className="jira-shell">
      <aside className="jira-sidebar">
        <button type="button" className="jira-sidebar-brand jira-brand-btn" onClick={() => navigate('/workspaces')}>
          <span className="jira-logo-mark" aria-hidden />
          <div>
            <div className="jira-sidebar-title">Mini trello</div>
            <div className="jira-sidebar-sub">team spaces</div>
          </div>
        </button>
        <nav className="jira-nav">
          <div className="jira-nav-section">Разделы</div>
          <button type="button" className="jira-nav-item jira-nav-item-active">
            Дашборд
          </button>
          <button type="button" className="jira-nav-item" onClick={() => navigate('/workspaces')}>
            Рабочие пространства
          </button>
          <button type="button" className="jira-nav-item" onClick={() => navigate('/profile/me')}>
            Профиль
          </button>
        </nav>
      </aside>

      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Dashboard</h1>
            <p className="jira-page-desc">Access token: {accessTokenShort}</p>
          </div>
          <div className="jira-topbar-actions">
            <button className="jira-btn jira-btn-danger" onClick={() => void logout()} type="button">
              Выйти
            </button>
          </div>
        </header>

        {!props.accessToken && (
          <div className="jira-banner jira-banner-warn">
            Войдите на главной странице, чтобы работать с рабочими пространствами.
            <button type="button" className="jira-link-btn" onClick={() => navigate('/')}>
              На главную
            </button>
          </div>
        )}

        <section className="jira-panel">
          <div className="jira-panel-head">
            <span className="jira-panel-title">Actions</span>
            <button className="jira-btn jira-btn-ghost jira-btn-sm" onClick={() => void refresh()} type="button">
              Refresh tokens (cookie)
            </button>
          </div>

          <div className="jira-modal-body">
            {status && <div className="jira-banner">{status}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}

function ProfileMePage(props: { accessToken: string | null }) {
  const [user, setUser] = useState<UserSafe | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState(false);
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

  async function uploadAvatar() {
    if (!props.accessToken) return;
    if (!selectedFile) return;

    setBusy(true);
    setMsg(null);
    try {
      const form = new FormData();
      form.append('file', selectedFile);

      const updated = await api<UserSafe>('/user/update-avatar', {
        method: 'PATCH',
        accessToken: props.accessToken,
        body: form,
      });
      setUser(updated);
      setSelectedFile(null);
      setSelectedFileName(null);
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
    setSelectedFile(null);
    setPreviewUrl(null);
    setSelectedFileName(null);
    if (!file) return;

    // Чтобы не упираться в MaxLength на бэке (и не отправлять огромные строки).
    const MAX_BYTES = 50 * 1024; // ~50 KB
    if (file.size > MAX_BYTES) {
      setMsg('Файл слишком большой. Максимум ~50 KB.');
      return;
    }

    setSelectedFile(file);
    setSelectedFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
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
      setSelectedFile(null);
      setSelectedFileName(null);
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
    <div className="jira-shell">
      <aside className="jira-sidebar">
        <button type="button" className="jira-sidebar-brand jira-brand-btn" onClick={() => navigate('/workspaces')}>
          <span className="jira-logo-mark" aria-hidden />
          <div>
            <div className="jira-sidebar-title">Mini trello</div>
            <div className="jira-sidebar-sub">team spaces</div>
          </div>
        </button>
        <nav className="jira-nav">
          <div className="jira-nav-section">Разделы</div>
          <button type="button" className="jira-nav-item" onClick={() => navigate('/workspaces')}>
            Рабочие пространства
          </button>
          <button type="button" className="jira-nav-item jira-nav-item-active">
            Профиль
          </button>
        </nav>
      </aside>

      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Профиль</h1>
            <p className="jira-page-desc">Личные данные</p>
          </div>
          <div className="jira-topbar-actions">
            <button className="jira-btn jira-btn-ghost" onClick={() => navigate('/workspaces')} type="button">
              Назад
            </button>
          </div>
        </header>

        {msg && <div className={isErrorMsg ? 'jira-banner jira-banner-error' : 'jira-banner'}>{msg}</div>}

        <section className="jira-panel">
          <div className="jira-modal-body">
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
                        <div className="jira-cell-meta" style={{ marginTop: 0, padding: 0 }}>
                          Не удалось загрузить аватар
                        </div>
                      )
                    ) : (
                      <div className="jira-cell-meta" style={{ marginTop: 0, padding: 0 }}>
                        Нет аватара
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

                  <button
                    className="avatarEditBtn"
                    type="button"
                    disabled={busy}
                    onClick={() => triggerPick()}
                  >
                    Редактировать
                  </button>
                </div>

                {selectedFile && (
                  <div className="avatarActions">
                    <div className="avatarHint">
                      {selectedFileName ? `Выбрано: ${selectedFileName}` : 'Выберите файл'}
                    </div>

                    <button
                      className="jira-btn jira-btn-primary"
                      type="button"
                      disabled={busy || !selectedFile}
                      onClick={() => void uploadAvatar()}
                    >
                      {busy ? '...' : 'Загрузить фото...'}
                    </button>
                  </div>
                )}

                {user?.avatarPath && (
                  <div style={{ marginTop: 12 }}>
                    <button
                      className="jira-btn jira-btn-danger avatarDeleteBtn"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeAvatar()}
                    >
                      {busy ? '...' : 'Удалить'}
                    </button>
                  </div>
                )}
              </div>

              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 12, fontWeight: 600 }}>{user?.name || '-'}</div>

                <div className="jira-label">Почта</div>
                <div style={{ marginBottom: 12 }}>{user?.email || '-'}</div>

                <div className="jira-label">Зарегистрирован</div>
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

  const memberRouteMatch = route.match(/^\/workspaces\/(\d+)\/members$/);
  let page: JSX.Element;
  if (memberRouteMatch) {
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
    page = <Home onAuthed={(t) => setToken(t)} />;
  }

  useEffect(() => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    document.documentElement.classList.toggle('theme-dark', theme === 'dark');
  }, [theme]);

  return (
    <>
      <div className="theme-toggle" aria-label="Theme switch">
        <span className="theme-toggle-icon" aria-hidden>
          ◐
        </span>
        <label className="theme-switch" aria-label="Toggle dark theme">
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
      </div>
      {page}
    </>
  );
}

export default App;
