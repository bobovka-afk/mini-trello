import { useEffect, useMemo, useRef, useState } from 'react';
import { api, API_URL, type ApiError } from './lib/api';
import { WorkspacesPage } from './WorkspacesPage';
import { InvitesPage } from './InvitesPage';
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

  return (
    <div className="container">
      <header className="header">
        <div>
          <div className="title">Email verification</div>
          <div className="subtitle">Request confirmation email</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/')} type="button">
            Home
          </button>
        </div>
      </header>

      <div className="card">
        <div className="form">
          <label className="field">
            <div className="label">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mail@example.com"
              autoComplete="email"
            />
          </label>

          <button className="btnPrimary" onClick={submit} disabled={busy}>
            {busy ? '...' : 'Send verification email'}
          </button>

          {msg && <div className="msg">{msg}</div>}
        </div>
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
    <div className="container">
      <header className="header">
        <div>
          <div className="title">Email verification</div>
          <div className="subtitle">Result: {title}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/')} type="button">
            Home
          </button>
          <button
            className="btn"
            onClick={() => navigate('/test/email-verification/request')}
            type="button"
          >
            Request again
          </button>
        </div>
      </header>

      <div className="card">
        <div className="msg">Status: {status}</div>
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

  return (
    <div className="container">
      <header className="header">
        <div>
          <div className="title">Password reset</div>
          <div className="subtitle">Request reset link</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/')} type="button">
            Home
          </button>
        </div>
      </header>

      <div className="card">
        <div className="form">
          <label className="field">
            <div className="label">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mail@example.com"
              autoComplete="email"
            />
          </label>

          <button className="btnPrimary" onClick={submit} disabled={busy}>
            {busy ? '...' : 'Send reset email'}
          </button>

          {msg && <div className="msg">{msg}</div>}
        </div>
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

  return (
    <div className="container">
      <header className="header">
        <div>
          <div className="title">Password reset</div>
          <div className="subtitle">Confirm token and set new password</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/')} type="button">
            Home
          </button>
        </div>
      </header>

      <div className="card">
        <div className="form">
          {!token ? (
            <div className="msg">
              Token отсутствует в query param `token`. Откройте ссылку из письма.
            </div>
          ) : (
            <>
              <label className="field">
                <div className="label">New password</div>
                <input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  type="password"
                  placeholder="••••••••"
                  autoComplete="new-password"
                />
              </label>

              <button
                className="btnPrimary"
                onClick={submit}
                disabled={busy || !newPassword}
              >
                {busy ? '...' : 'Set new password'}
              </button>
            </>
          )}

          {msg && <div className="msg">{msg}</div>}
        </div>
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
      navigate('/dashboard');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <div className="title">mini-trello auth test</div>
          <div className="subtitle">API: {API_URL}</div>
        </div>
        <a className="btn" href={`${API_URL}/auth/google`}>
          Continue with Google
        </a>
      </header>

      <div className="card">
        <div className="tabs">
          <button
            className={mode === 'login' ? 'tab tabActive' : 'tab'}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
          <button
            className={mode === 'register' ? 'tab tabActive' : 'tab'}
            onClick={() => setMode('register')}
            type="button"
          >
            Register
          </button>
        </div>

        <div className="row">
          <button
            className="btn"
            onClick={() => navigate('/test/email-verification/request')}
            type="button"
          >
            Test email verification
          </button>
          <button
            className="btn"
            onClick={() => navigate('/test/password-reset/request')}
            type="button"
          >
            Test password reset
          </button>
        </div>

        <div className="form">
          {mode === 'register' && (
            <label className="field">
              <div className="label">Name</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Igor"
                autoComplete="name"
              />
            </label>
          )}

          <label className="field">
            <div className="label">Email</div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="mail@example.com"
              autoComplete="email"
            />
          </label>

          <label className="field">
            <div className="label">Password</div>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              placeholder="••••••••"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </label>

          <button className="btnPrimary" onClick={submit} disabled={busy}>
            {busy ? '...' : mode === 'login' ? 'Login' : 'Register'}
          </button>

          {msg && <div className="msg">{msg}</div>}
        </div>
      </div>
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
    <div className="container">
      <header className="header">
        <div>
          <div className="title">Dashboard</div>
          <div className="subtitle">Access token: {accessTokenShort}</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/')} type="button">
            Home
          </button>
          <button className="btn" onClick={() => navigate('/workspaces')} type="button">
            Workspaces (Jira UI)
          </button>
          <button className="btn" onClick={() => navigate('/invites')} type="button">
            Invites
          </button>
          <button className="btn" onClick={() => navigate('/profile/me')} type="button">
            Profile
          </button>
          <button className="btnDanger" onClick={logout} type="button">
            Logout
          </button>
        </div>
      </header>

      <div className="card">
        <div className="row">
          <button className="btn" onClick={refresh} type="button">
            Refresh tokens (cookie)
          </button>
        </div>

        <div className="row">
          <button
            className="btn"
            onClick={() => navigate('/test/email-verification/request')}
            type="button"
          >
            Test email verification
          </button>
          <button
            className="btn"
            onClick={() => navigate('/test/password-reset/request')}
            type="button"
          >
            Test password reset
          </button>
        </div>

        {status && <div className="msg">{status}</div>}
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
    const month = d.toLocaleString('ru-RU', { month: 'long' });
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  return (
    <div className="container">
      <header className="header">
        <div>
          <div className="title">Profile</div>
          <div className="subtitle">Me</div>
        </div>
        <div className="row">
          <button className="btn" onClick={() => navigate('/dashboard')} type="button">
            Back
          </button>
        </div>
      </header>

      <div className="card">
        {msg && <div className="msg">{msg}</div>}

        <div className="row" style={{ gap: 24, alignItems: 'flex-start' }}>
          <div style={{ minWidth: 220 }}>
            <div style={{ marginTop: 12 }}>
              <div className="avatarWrap">
                {previewUrl || user?.avatarPath ? (
                  <img
                    className="avatarImg"
                    src={previewUrl || user?.avatarPath || ''}
                    alt="avatar"
                  />
                ) : (
                  <div className="msg" style={{ marginTop: 0, padding: 0 }}>
                    No avatar
                  </div>
                )}

                <button
                  className="avatarEditBtn"
                  type="button"
                  disabled={busy}
                  onClick={triggerPick}
                >
                  Edit
                </button>

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

            {selectedFile && (
              <div className="avatarActions">
                <div className="avatarHint">
                  {selectedFileName ? `Selected: ${selectedFileName}` : 'Selected'}
                </div>

                <button
                  className="btnPrimary"
                  type="button"
                  disabled={busy || !selectedFile}
                  onClick={uploadAvatar}
                >
                  {busy ? '...' : 'Upload a photo...'}
                </button>
              </div>
            )}

            {user?.avatarPath && (
              <div style={{ marginTop: 12 }}>
                <button
                  className="btnDanger"
                  type="button"
                  disabled={busy}
                  onClick={removeAvatar}
                >
                  {busy ? '...' : 'Remove photo'}
                </button>
              </div>
            )}
          </div>

          <div style={{ flex: 1 }}>
            {/* value only: без отдельной подписи */}
            <div style={{ marginBottom: 12, fontWeight: 600 }}>
              {user?.name || '-'}
            </div>

            <div className="label">Почта</div>
            <div style={{ marginBottom: 12 }}>{user?.email || '-'}</div>

            <div className="label">Зарегистрирован</div>
            <div style={{ marginBottom: 12 }}>
              {user?.createdAt ? formatRegisteredRU(user.createdAt) : '-'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  const route = useRoute();
  const [accessToken, setAccessToken] = useState<string | null>(() => getAccessTokenFromStorage());

  const setToken = (t: string | null) => {
    setAccessTokenToStorage(t);
    setAccessToken(t);
  };

  if (route.startsWith('/dashboard')) {
    return <Dashboard accessToken={accessToken} setToken={setToken} />;
  }

  if (route.startsWith('/workspaces')) {
    return <WorkspacesPage accessToken={accessToken} />;
  }

  if (route.startsWith('/invites')) {
    return <InvitesPage accessToken={accessToken} />;
  }

  if (route.startsWith('/profile')) {
    return <ProfileMePage accessToken={accessToken} />;
  }

  if (route.startsWith('/test/email-verification/request')) {
    return <EmailVerificationRequestPage />;
  }

  if (route.startsWith('/email-verified')) {
    return <EmailVerifiedStatusPage />;
  }

  if (route.startsWith('/test/password-reset/request')) {
    return <PasswordResetRequestPage />;
  }

  if (route.startsWith('/reset-password')) {
    return <PasswordResetConfirmPage />;
  }

  return <Home onAuthed={(t) => setToken(t)} />;
}

export default App;
