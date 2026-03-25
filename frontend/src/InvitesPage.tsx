import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';

type InviteRow = {
  id: number;
  email: string;
  workspaceId: number;
  invitedByUserId: number;
  role: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
};

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
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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

  async function deleteInvite(row: InviteRow) {
    if (!accessToken) return;
    setBusyId(row.id);
    setMsg(null);
    try {
      await api<{ ok: boolean }>(`/workspace-invite/${row.workspaceId}/${row.id}`, {
        method: 'DELETE',
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
            Приглашения
          </button>
        </nav>
      </aside>

      <div className="jira-main">
        <header className="jira-topbar">
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
                    <th>Workspace ID</th>
                    <th>Роль</th>
                    <th>Получатель</th>
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
                          <div className="jira-cell-title">#{row.workspaceId}</div>
                          <div className="jira-cell-meta">Invite ID {row.id}</div>
                        </td>
                        <td>
                          <span className="jira-pill">{row.role}</span>
                        </td>
                        <td className="jira-cell-desc">{row.email}</td>
                        <td className="jira-cell-meta">
                          {formatDate(row.expiresAt)}
                          {isExpired(row.expiresAt) ? ' (expired)' : ''}
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
                          <button
                            type="button"
                            className="jira-btn jira-btn-danger-ghost jira-btn-sm"
                            disabled={busyId === row.id}
                            onClick={() => void deleteInvite(row)}
                          >
                            Удалить
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
                <span className="jira-label">ID пространства *</span>
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

