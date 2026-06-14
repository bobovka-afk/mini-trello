import { useCallback, useEffect, useState } from 'react';
import { api, formatApiError, isRateLimitMessage } from '@shared/api';
import { formatWorkspaceRole } from '@entities/workspace';
import { formatDateRuLong } from '@shared/lib/formatDateRu';

type InviteRow = {
  id: number;
  role: string;
  expiresAt: string;
  createdAt: string;
  workspace: { name: string };
  invitedBy: { name: string; email: string };
};

type Props = {
  accessToken: string | null;
  onRowsCountChange?: (count: number) => void;
};

function formatError(e: unknown) {
  return formatApiError(e);
}

function formatWorkspaceNameForUI(name: string) {
  const m = name.match(/^\s*\d+\s*\((.*)\)\s*$/);
  return m ? m[1] : name;
}

function isExpired(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function ProfileInvitesSection({ accessToken, onRowsCountChange }: Props) {
  const [rows, setRows] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [limit] = useState(20);
  const [offset] = useState(0);

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!accessToken) {
      setRows([]);
      setLoading(false);
      onRowsCountChange?.(0);
      return;
    }

    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setMsg(null);
    }
    try {
      const data = await api<InviteRow[]>(`/workspace-invite/my?limit=${limit}&offset=${offset}`, {
        method: 'GET',
        accessToken,
      });
      const nextRows = Array.isArray(data) ? data : [];
      setRows(nextRows);
      onRowsCountChange?.(nextRows.length);
    } catch (e) {
      setRows([]);
      onRowsCountChange?.(0);
      if (!silent) {
        setMsg(formatError(e));
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [accessToken, limit, offset, onRowsCountChange]);

  useEffect(() => {
    void load();
  }, [load]);

  async function acceptInvite(row: InviteRow) {
    if (!accessToken) return;
    setBusyId(row.id);
    setMsg(null);
    try {
      await api(`/workspace-invite/${row.id}/accept`, { method: 'POST', accessToken });
      setRows((prev) => {
        const next = prev.filter((item) => item.id !== row.id);
        onRowsCountChange?.(next.length);
        return next;
      });
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
      setRows((prev) => {
        const next = prev.filter((item) => item.id !== row.id);
        onRowsCountChange?.(next.length);
        return next;
      });
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="trello-panel trello-profile-invites-section">
      <div className="trello-panel-head">
        <span className="trello-panel-title">Мои приглашения</span>
      </div>

      {!accessToken && (
        <div className="trello-banner trello-banner-warn" style={{ margin: 16 }}>
          Войдите на главной, чтобы просматривать приглашения.
        </div>
      )}

      {msg && (
        <div
          className={
            isRateLimitMessage(msg)
              ? 'trello-banner trello-banner-rate-limit'
              : 'trello-banner trello-banner-error'
          }
          style={{ margin: 16 }}
        >
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
                const disabled = isExpired(row.expiresAt);
                return (
                  <tr key={row.id}>
                    <td>
                      <div className="trello-cell-title">
                        {formatWorkspaceNameForUI(row.workspace.name)}
                      </div>
                    </td>
                    <td>
                      <span className="trello-pill">{formatWorkspaceRole(row.role)}</span>
                    </td>
                    <td>
                      <div className="trello-cell-title">{row.invitedBy.name}</div>
                      <div className="trello-cell-meta">{row.invitedBy.email}</div>
                    </td>
                    <td className="trello-cell-meta">
                      {formatDateRuLong(row.expiresAt)}
                      {isExpired(row.expiresAt) ? ' (истекло)' : ''}
                    </td>
                    <td className="trello-cell-meta">{formatDateRuLong(row.createdAt)}</td>
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
