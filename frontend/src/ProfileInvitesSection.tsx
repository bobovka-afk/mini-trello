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

export function ProfileInvitesSection({ accessToken }: Props) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

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
      const data = await api<InviteRow[]>(`/workspace-invite/my?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        accessToken,
      });
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
      await api(`/workspace-invite/${row.id}/accept`, { method: 'POST', accessToken });
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
      await api(`/workspace-invite/${row.id}/decline`, { method: 'POST', accessToken });
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

  return (
    <section className="jira-panel">
      <div className="jira-panel-head">
        <span className="jira-panel-title">Мои приглашения</span>
      </div>

      {!accessToken && (
        <div className="jira-banner jira-banner-warn">
          Войдите на главной странице, чтобы просматривать приглашения.
        </div>
      )}

      {msg && <div className="jira-banner jira-banner-error">{msg}</div>}

      {loading ? (
        <div className="jira-empty">Загрузка…</div>
      ) : rows.length === 0 ? (
        <div className="jira-empty">Приглашений пока нет.</div>
      ) : (
        <div className="jira-table-wrap">
          <table className="jira-table">
            <thead>
              <tr>
                <th>ID пространства</th>
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
                      <div className="jira-cell-meta">ID приглашения {row.id}</div>
                    </td>
                    <td>
                      <span className="jira-pill">{row.role}</span>
                    </td>
                    <td className="jira-cell-desc">{row.email}</td>
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
  );
}

