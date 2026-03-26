import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';
import { formatWorkspaceRole } from './lib/roles';

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

export function ProfileInvitesSection({ accessToken }: Props) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [limit] = useState(20);
  const [offset] = useState(0);

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
    <section className="trello-panel">
      <div className="trello-panel-head">
        <span className="trello-panel-title">Мои приглашения</span>
      </div>

      {!accessToken && (
        <div className="trello-banner trello-banner-warn" style={{ margin: 16 }}>
          Войдите на главной, чтобы просматривать приглашения.
        </div>
      )}

      {msg && (
        <div className="trello-banner trello-banner-error" style={{ margin: 16 }}>
          {msg}
        </div>
      )}

      {loading ? (
        <div className="trello-empty" style={{ padding: 16 }}>
          Загрузка…
        </div>
      ) : rows.length === 0 ? (
        <div className="trello-empty" style={{ padding: 16 }}>
          Приглашений пока нет.
        </div>
      ) : (
        <div className="trello-table-wrap">
          <table className="trello-table">
            <thead>
              <tr>
                <th>ID рабочего пространства</th>
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
                      <div className="trello-cell-title">#{row.workspaceId}</div>
                      <div className="trello-cell-meta">ID приглашения {row.id}</div>
                    </td>
                    <td>
                      <span className="trello-pill">{formatWorkspaceRole(row.role)}</span>
                    </td>
                    <td className="trello-cell-desc">{row.email}</td>
                    <td className="trello-cell-meta">
                      {formatDate(row.expiresAt)}
                      {isExpired(row.expiresAt) ? ' (истекло)' : ''}
                    </td>
                    <td className="trello-cell-meta">{formatDate(row.createdAt)}</td>
                    <td className="trello-row-actions">
                      <button
                        type="button"
                        className="trello-btn trello-btn-primary trello-btn-sm"
                        disabled={disabled || busyId === row.id}
                        onClick={() => void acceptInvite(row)}
                      >
                        Принять
                      </button>
                      <button
                        type="button"
                        className="trello-btn trello-btn-danger-ghost trello-btn-sm"
                        disabled={disabled || busyId === row.id}
                        onClick={() => void declineInvite(row)}
                      >
                        Отклонить
                      </button>
                      <button
                        type="button"
                        className="trello-btn trello-btn-danger-ghost trello-btn-sm"
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

