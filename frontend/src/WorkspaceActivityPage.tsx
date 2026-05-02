import { useCallback, useEffect, useState } from 'react';
import { api, formatApiError, isRateLimitMessage } from './lib/api';
import { SpaLink } from './lib/navigation';
import { formatWorkspaceRole } from './lib/roles';

type Props = {
  accessToken: string | null;
  workspaceId: number;
};

type ActivityRow = {
  id: number;
  type: string;
  payload: Record<string, unknown> | null;
  createdAt: string;
  actor: { id: number; name: string; email: string };
};

const PAGE_SIZE = 25;

function formatError(e: unknown) {
  return formatApiError(e);
}

function formatWhen(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function activitySummary(row: ActivityRow): string {
  const { type, payload, actor } = row;
  const who = actor.name || actor.email;
  const p = payload ?? {};

  switch (type) {
    case 'WORKSPACE_CREATED':
      return `${who} создал(а) это рабочее пространство.`;
    case 'WORKSPACE_UPDATED': {
      const parts: string[] = [];
      const name = p.name as { from?: unknown; to?: unknown } | undefined;
      const desc = p.description as { from?: unknown; to?: unknown } | undefined;
      if (name && String(name.from) !== String(name.to)) {
        parts.push('название');
      }
      if (desc && String(desc.from) !== String(desc.to)) {
        parts.push('описание');
      }
      if (parts.length === 0) {
        return `${who} обновил(а) сведения о пространстве.`;
      }
      return `${who} изменил(а): ${parts.join(', ')}.`;
    }
    case 'MEMBER_INVITED': {
      const email = String(p.invitedEmail ?? '');
      const role = String(p.role ?? '');
      return `${who} пригласил(а) ${email} (${formatWorkspaceRole(role)}).`;
    }
    case 'INVITE_CANCELLED': {
      const email = String(p.invitedEmail ?? '');
      return `${who} отменил(а) приглашение для ${email}.`;
    }
    case 'INVITE_ACCEPTED': {
      const email = String(p.invitedEmail ?? '');
      return `${who} принял(а) приглашение (${email}) и вступил(а) в пространство.`;
    }
    case 'INVITE_DECLINED': {
      const email = String(p.invitedEmail ?? '');
      return `${who} отклонил(а) приглашение (${email}).`;
    }
    case 'MEMBER_REMOVED': {
      const nameRemoved = String(p.removedUserName ?? '');
      const emailRemoved = String(p.removedUserEmail ?? '');
      const label = nameRemoved || emailRemoved || `#${p.removedUserId}`;
      return `${who} исключил(а) участника ${label}.`;
    }
    case 'MEMBER_LEFT':
      return `${who} покинул(а) рабочее пространство.`;
    default:
      return `${who}: ${type}`;
  }
}

export function WorkspaceActivityPage({ accessToken, workspaceId }: Props) {
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setRows([]);
      setLoading(false);
      setHasMore(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const data = await api<ActivityRow[]>(
        `/workspace/${workspaceId}/activity?limit=${PAGE_SIZE}&offset=0`,
        { method: 'GET', accessToken },
      );
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setHasMore(list.length === PAGE_SIZE);
    } catch (e) {
      setRows([]);
      setHasMore(false);
      setMsg(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadMore = useCallback(async () => {
    if (!accessToken || loadMoreBusy || !hasMore) return;
    setLoadMoreBusy(true);
    setMsg(null);
    try {
      const data = await api<ActivityRow[]>(
        `/workspace/${workspaceId}/activity?limit=${PAGE_SIZE}&offset=${rows.length}`,
        { method: 'GET', accessToken },
      );
      const list = Array.isArray(data) ? data : [];
      setRows((prev) => [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setLoadMoreBusy(false);
    }
  }, [accessToken, workspaceId, rows.length, hasMore, loadMoreBusy]);

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col">
          <div className="trello-topbar-stripe-left">
            <SpaLink className="trello-top-left-brand trello-top-left-brand--stripe" to="/workspaces">
              <span className="trello-logo" aria-hidden />
              <span className="trello-top-left-brand-text">mini trello</span>
            </SpaLink>
            <SpaLink
              className="trello-btn trello-btn-sm trello-btn-topbar-nav"
              to={`/workspaces/${workspaceId}/members`}
            >
              ← Участники
            </SpaLink>
          </div>
          <h1 className="trello-topbar-stripe-center">Журнал активности</h1>
          <div className="trello-topbar-actions" />
        </header>

        {!accessToken && (
          <div className="trello-banner trello-banner-warn">
            Войдите на главной, чтобы просматривать журнал.
            <SpaLink className="trello-inline-link" to="/">
              На главную
            </SpaLink>
          </div>
        )}

        {(msg && (
          <div
            className={
              isRateLimitMessage(msg)
                ? 'trello-banner trello-banner-rate-limit'
                : 'trello-banner trello-banner-error'
            }
          >
            {msg}
          </div>
        )) || null}

        <div className="trello-members-table-block">
          {loading ? (
            <div className="trello-empty">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="trello-activity-empty-state" role="status">
              Событий пока нет.
            </div>
          ) : (
            <ul className="trello-activity-list">
              {rows.map((row) => (
                <li key={row.id} className="trello-activity-item">
                  <div className="trello-activity-text">{activitySummary(row)}</div>
                  <div className="trello-activity-meta">{formatWhen(row.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}

          {!loading && rows.length > 0 && hasMore && (
            <div className="trello-workspaces-load-more">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                disabled={loadMoreBusy}
                onClick={() => void loadMore()}
              >
                {loadMoreBusy ? 'Загрузка…' : 'Загрузить ещё'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
