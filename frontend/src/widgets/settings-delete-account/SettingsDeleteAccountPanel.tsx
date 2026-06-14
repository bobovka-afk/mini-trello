import { useState } from 'react';
import { api, formatApiError } from '@shared/api';
import { ModalForm } from '@shared/ui/modal-form';

type Props = {
  accessToken: string;
  hasPassword: boolean;
  onDeleted: () => void;
};

export function SettingsDeleteAccountPanel({ accessToken, hasPassword, onDeleted }: Props) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPhrase, setConfirmPhrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setMsg(null);
    try {
      await api<{ ok: boolean }>('/user/me', {
        method: 'DELETE',
        accessToken,
        json: hasPassword ? { password } : { confirmPhrase },
      });
      setOpen(false);
      onDeleted();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="trello-settings-card trello-settings-card--danger">
      <h2 className="trello-settings-card-title">Удаление аккаунта</h2>
      <p className="trello-settings-card-hint">
        Безвозвратно удалит профиль, персонажа, настройки и сессии. Карточки на досках останутся, исполнитель
        будет снят.
      </p>
      <button
        type="button"
        className="trello-btn trello-btn-danger trello-btn-sm"
        onClick={() => {
          setMsg(null);
          setOpen(true);
        }}
      >
        Удалить аккаунт
      </button>

      {open ? (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !busy && setOpen(false)}
        >
          <div
            className="trello-modal trello-modal-narrow"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Удалить аккаунт?</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !busy && setOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <ModalForm
              onSubmit={handleDelete}
              disabled={
                busy ||
                (hasPassword ? !password : confirmPhrase.trim() !== 'УДАЛИТЬ')
              }
            >
              <div className="trello-modal-body">
                <p className="trello-confirm-text">
                  Это действие нельзя отменить. Все данные аккаунта будут удалены.
                </p>
                {hasPassword ? (
                  <label className="trello-field">
                    <span className="trello-label">Текущий пароль</span>
                    <input
                      className="trello-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={busy}
                    />
                  </label>
                ) : (
                  <label className="trello-field">
                    <span className="trello-label">Введите УДАЛИТЬ для подтверждения</span>
                    <input
                      className="trello-input"
                      value={confirmPhrase}
                      onChange={(e) => setConfirmPhrase(e.target.value)}
                      disabled={busy}
                      placeholder="УДАЛИТЬ"
                    />
                  </label>
                )}
                {msg ? <p className="trello-settings-card-hint">{msg}</p> : null}
              </div>
              <div className="trello-modal-foot">
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost"
                  disabled={busy}
                  onClick={() => setOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  className="trello-btn trello-btn-danger"
                  disabled={
                    busy ||
                    (hasPassword ? !password : confirmPhrase.trim() !== 'УДАЛИТЬ')
                  }
                >
                  {busy ? '…' : 'Удалить навсегда'}
                </button>
              </div>
            </ModalForm>
          </div>
        </div>
      ) : null}
    </article>
  );
}
