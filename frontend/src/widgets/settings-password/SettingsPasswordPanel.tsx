import { useEffect, useState } from 'react';
import { api, formatApiError } from '@shared/api';
import { AlertModal } from '@widgets/index';

type UserSafe = {
  hasPassword: boolean;
};

type Props = {
  accessToken: string;
  user: UserSafe | null;
  onUserUpdated?: (hasPassword: boolean) => void;
};

export function SettingsPasswordPanel({ accessToken, user, onUserUpdated }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errorModal, setErrorModal] = useState<string | null>(null);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (window.location.hash === '#password') {
      setHighlight(true);
      const t = window.setTimeout(() => setHighlight(false), 2400);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, []);

  async function submit() {
    if (!newPassword) {
      setErrorModal('Введите новый пароль.');
      return;
    }
    if (newPassword.length < 6 || newPassword.length > 72) {
      setErrorModal('Новый пароль: от 6 до 72 символов.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setErrorModal('Подтверждение нового пароля не совпадает.');
      return;
    }
    if (user?.hasPassword && !currentPassword) {
      setErrorModal('Введите текущий пароль.');
      return;
    }
    if (user?.hasPassword && currentPassword === newPassword) {
      setErrorModal('Новый пароль должен отличаться от текущего.');
      return;
    }

    setBusy(true);
    setMsg(null);
    setErrorModal(null);
    try {
      await api<{ ok: boolean }>('/auth/password/change', {
        method: 'POST',
        accessToken,
        json: user?.hasPassword
          ? { currentPassword, newPassword }
          : { newPassword },
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
      setMsg(user?.hasPassword ? 'Пароль изменён.' : 'Пароль установлен.');
      onUserUpdated?.(true);
    } catch (e) {
      setErrorModal(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article
      className={[
        'trello-settings-card',
        highlight ? 'trello-settings-card--highlight' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      id="settings-password"
    >
      <h2 className="trello-settings-card-title">
        {user?.hasPassword ? 'Смена пароля' : 'Установка пароля'}
      </h2>
      {msg ? <p className="trello-settings-card-hint">{msg}</p> : null}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        {user?.hasPassword ? (
          <label className="trello-field">
            <span className="trello-label">Текущий пароль</span>
            <input
              className="trello-input"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              disabled={busy}
            />
          </label>
        ) : null}
        <label className="trello-field">
          <span className="trello-label">Новый пароль</span>
          <input
            className="trello-input"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <label className="trello-field">
          <span className="trello-label">Подтверждение</span>
          <input
            className="trello-input"
            type="password"
            autoComplete="new-password"
            value={confirmNewPassword}
            onChange={(e) => setConfirmNewPassword(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="trello-settings-card-actions">
          <button
            type="submit"
            className="trello-btn trello-btn-primary trello-btn-sm"
            disabled={busy}
          >
            {busy ? '…' : user?.hasPassword ? 'Изменить пароль' : 'Установить пароль'}
          </button>
        </div>
      </form>
      <AlertModal
        open={errorModal != null}
        title="Ошибка"
        message={errorModal ?? ''}
        onClose={() => setErrorModal(null)}
      />
    </article>
  );
}
