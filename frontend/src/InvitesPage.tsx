import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';
import { formatWorkspaceRole } from './lib/roles';

type InviteRow = {
  id: number;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  workspace: { name: string };
  invitedBy: { name: string; email: string };
};

function formatWorkspaceNameForUI(name: string) {
  const m = name.match(/^\s*\d+\s*\((.*)\)\s*$/);
  return m ? m[1] : name;
}

type Props = { accessToken: string | null };
type InviteRole = 'ADMIN' | 'MEMBER';

function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

function formatDate(iso: string) {
  try {
    const d = new Date(iso);
    const months = [
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
    const day = d.getDate();
    const mon = months[d.getMonth()] ?? '';
    const y = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${day} ${mon} ${y} ${h}:${min}`;
  } catch {
    return iso;
  }
}

function isExpired(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function InvitesPage({ accessToken }: Props) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createWorkspaceId, setCreateWorkspaceId] = useState('');
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<InviteRole>('MEMBER');

  const [limit] = useState(20);
  const [offset, setOffset] = useState(0);

  const load = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const data = await api<InviteRow[]>(
        `/workspace-invite/my?limit=${limit}&offset=${offset}`,
        {
          method: 'GET',
          accessToken,
        },
      );
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setRows([]);
      setMsg(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, limit, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  async function acceptInvite(row: InviteRow) {
    if (!accessToken) return;
    setBusyId(row.id);
    setMsg(null);
    try {
      await api(`/workspace-invite/${row.id}/accept`, {
        method: 'POST',
        accessToken,
      });
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function declineInvite(row: InviteRow) {
    if (!accessToken) return;
    setBusyId(row.id);
    setMsg(null);
    try {
      await api(`/workspace-invite/${row.id}/decline`, {
        method: 'POST',
        accessToken,
      });
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusyId(null);
    }
  }

  async function submitCreate() {
    if (!accessToken) return;
    const workspaceId = Number(createWorkspaceId);
    if (!Number.isInteger(workspaceId) || workspaceId <= 0) {
      setMsg('Укажите корректный Workspace ID.');
      return;
    }
    if (!createEmail.trim()) {
      setMsg('Укажите email.');
      return;
    }
    setCreateBusy(true);
    setMsg(null);
    try {
      await api(`/workspace-invite/create/${workspaceId}`, {
        method: 'POST',
        accessToken,
        json: {
          email: createEmail.trim().toLowerCase(),
          role: createRole,
        },
      });
      setCreateOpen(false);
      setCreateWorkspaceId('');
      setCreateEmail('');
      setCreateRole('MEMBER');
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="jira-shell">
      <div className="jira-main">
        <header className="jira-topbar">
          <button type="button" className="trello-top-left-brand" onClick={() => navigate('/workspaces')}>
            <span className="trello-logo" aria-hidden />
            <span className="trello-top-left-brand-text">mini trello</span>
          </button>
          <div>
            <h1 className="jira-page-title">Мои приглашения</h1>
            <p className="jira-page-desc">
              Просматривайте и обрабатывайте входящие приглашения в рабочие пространства.
            </p>
          </div>
          <div className="jira-topbar-actions">
            <button
              type="button"
              className="jira-btn jira-btn-primary"
              disabled={!accessToken}
              onClick={() => {
                setCreateOpen(true);
                setMsg(null);
              }}
            >
              Отправить приглашение
            </button>
          </div>
        </header>

        {!accessToken && (
          <div className="jira-banner jira-banner-warn">
            Войдите на главной странице, чтобы просматривать приглашения.
            <button type="button" className="jira-link-btn" onClick={() => navigate('/')}>
              На главную
            </button>
          </div>
        )}

        {msg && <div className="jira-banner jira-banner-error">{msg}</div>}

        <section className="jira-panel">
          <div className="jira-panel-head">
            <span className="jira-panel-title">Список приглашений</span>
            <div className="jira-row-actions">
              <button
                type="button"
                className="jira-btn jira-btn-ghost jira-btn-sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset((v) => Math.max(v - limit, 0))}
              >
                Назад
              </button>
              <button
                type="button"
                className="jira-btn jira-btn-ghost jira-btn-sm"
                disabled={rows.length < limit || loading}
                onClick={() => setOffset((v) => v + limit)}
              >
                Вперед
              </button>
            </div>
          </div>

          {loading ? (
            <div className="jira-empty">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="jira-empty">Приглашений пока нет.</div>
          ) : (
            <div className="jira-table-wrap">
              <table className="jira-table">
                <thead>
                  <tr>
                    <th>Рабочее пространство</th>
                    <th>Роль</th>
                    <th>Отправитель</th>
                    <th>Истекает</th>
                    <th>Создано</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const disabled = !!row.usedAt || isExpired(row.expiresAt);
                    return (
                      <tr key={row.id}>
                        <td>
                          <div className="jira-cell-title">
                            {formatWorkspaceNameForUI(row.workspace.name)}
                          </div>
                        </td>
                        <td>
                          <span className="jira-pill">{formatWorkspaceRole(row.role)}</span>
                        </td>
                        <td>
                          <div className="jira-cell-title">{row.invitedBy.name}</div>
                          <div className="jira-cell-meta">{row.invitedBy.email}</div>
                        </td>
                        <td className="jira-cell-meta">
                          {formatDate(row.expiresAt)}
                          {isExpired(row.expiresAt) ? ' (истекло)' : ''}
                        </td>
                        <td className="jira-cell-meta">{formatDate(row.createdAt)}</td>
                        <td className="jira-row-actions">
                          <button
                            type="button"
                            className="jira-btn jira-btn-primary jira-btn-sm"
                            disabled={disabled || busyId === row.id}
                            onClick={() => void acceptInvite(row)}
                          >
                            Принять
                          </button>
                          <button
                            type="button"
                            className="jira-btn jira-btn-danger-ghost jira-btn-sm"
                            disabled={disabled || busyId === row.id}
                            onClick={() => void declineInvite(row)}
                          >
                            Отклонить
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {createOpen && (
        <div className="jira-modal-backdrop" role="presentation" onClick={() => !createBusy && setCreateOpen(false)}>
          <div className="jira-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="jira-modal-header">
              <h2 className="jira-modal-title">Отправить приглашение</h2>
              <button type="button" className="jira-icon-btn" onClick={() => !createBusy && setCreateOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="jira-modal-body">
              <label className="jira-field">
                <span className="jira-label">ID рабочего пространства *</span>
                <input
                  className="jira-input"
                  value={createWorkspaceId}
                  onChange={(e) => setCreateWorkspaceId(e.target.value)}
                />
              </label>
              <label className="jira-field">
                <span className="jira-label">Почта *</span>
                <input
                  className="jira-input"
                  value={createEmail}
                  onChange={(e) => setCreateEmail(e.target.value)}
                  autoComplete="email"
                />
              </label>
              <label className="jira-field">
                <span className="jira-label">Роль</span>
                <select
                  className="jira-input"
                  value={createRole}
                  onChange={(e) => setCreateRole(e.target.value as InviteRole)}
                >
                  <option value="MEMBER">MEMBER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </label>
            </div>
            <div className="jira-modal-footer">
              <button type="button" className="jira-btn jira-btn-ghost" onClick={() => !createBusy && setCreateOpen(false)}>
                Отмена
              </button>
              <button type="button" className="jira-btn jira-btn-primary" disabled={createBusy} onClick={() => void submitCreate()}>
                {createBusy ? 'Отправка…' : 'Отправить приглашение'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

