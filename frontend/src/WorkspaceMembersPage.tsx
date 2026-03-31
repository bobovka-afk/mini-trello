import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, API_URL, type ApiError } from './lib/api';
import { formatWorkspaceRole } from './lib/roles';

type Props = {
  accessToken: string | null;
  workspaceId: number;
};

type UserMe = {
  id: number;
};

type WorkspaceMemberRow = {
  id: number;
  workspaceId: number;
  userId: number;
  role: string;
  createdAt: string;
  user: {
    id: number;
    name: string;
    avatarPath: string | null;
  };
};

function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function avatarSrcFromPath(p: string | null | undefined): string {
  if (!p) return '';
  const normalized = p.replace(/\\/g, '/');
  if (normalized.startsWith('data:')) return normalized;
  if (normalized.startsWith('http://') || normalized.startsWith('https://')) return normalized;
  // Protocol-relative URLs sometimes come as `//host/path`.
  // Preserve API protocol to avoid mixed-content / wrong protocol issues.
  if (normalized.startsWith('//')) {
    const proto = API_URL.startsWith('https://') ? 'https:' : 'http:';
    return `${proto}${normalized}`;
  }
  if (normalized.startsWith('/')) return `${API_URL}${normalized}`;
  return `${API_URL}/${normalized}`;
}

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

function formatInviteSendError(e: unknown): string {
  const raw = formatError(e);
  const lower = raw.toLowerCase();
  if (raw.includes('INVITE_ALREADY_SENT') || lower.includes('already been sent')) {
    return 'Этому адресу уже отправлено активное приглашение. Дождитесь ответа или отмените приглашение в настройках рабочего пространства.';
  }
  if (raw.includes('USER_ALREADY_MEMBER') || lower.includes('already a workspace member')) {
    return 'Этот пользователь уже состоит в этом рабочем пространстве.';
  }
  return raw;
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

export function WorkspaceMembersPage({ accessToken, workspaceId }: Props) {
  const [rows, setRows] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserMe | null>(null);
  const [currentUserLoadBusy, setCurrentUserLoadBusy] = useState(false);

  const [brokenAvatarUserIds, setBrokenAvatarUserIds] = useState<Record<number, boolean>>({});

  const MEMBERS_PAGE_SIZE = 20;
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);

  const [deleteMember, setDeleteMember] = useState<WorkspaceMemberRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const [leaveBusy, setLeaveBusy] = useState(false);

  type InviteRole = 'ADMIN' | 'MEMBER';
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createEmail, setCreateEmail] = useState('');
  const [createRole, setCreateRole] = useState<InviteRole>('MEMBER');

  const currentUserId = currentUser?.id ?? null;

  const currentMember = useMemo(() => {
    if (!currentUserId) return null;
    return rows.find((r) => r.userId === currentUserId) ?? null;
  }, [currentUserId, rows]);

  const canManageWorkspace = currentMember?.role === 'OWNER' || currentMember?.role === 'ADMIN';

  const loadCurrentUser = useCallback(async () => {
    if (!accessToken) return;
    setCurrentUserLoadBusy(true);
    setMsg(null);
    try {
      const me = await api<UserMe>('/user/me', { method: 'GET', accessToken });
      setCurrentUser(me);
    } catch (e) {
      setCurrentUser(null);
      setMsg(formatError(e));
    } finally {
      setCurrentUserLoadBusy(false);
    }
  }, [accessToken]);

  const loadMembers = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setRows([]);
      setHasMore(false);
      return;
    }

    setLoading(true);
    setMsg(null);
    setBrokenAvatarUserIds({});
    try {
      const data = await api<WorkspaceMemberRow[]>(
        `/workspace/${workspaceId}/members?limit=${MEMBERS_PAGE_SIZE}&offset=0`,
        {
          method: 'GET',
          accessToken,
        },
      );
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setHasMore(list.length === MEMBERS_PAGE_SIZE);
    } catch (e) {
      setRows([]);
      setHasMore(false);
      setMsg(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId]);

  const loadMoreMembers = useCallback(async () => {
    if (!accessToken || loadMoreBusy || !hasMore) return;
    setLoadMoreBusy(true);
    setMsg(null);
    try {
      const data = await api<WorkspaceMemberRow[]>(
        `/workspace/${workspaceId}/members?limit=${MEMBERS_PAGE_SIZE}&offset=${rows.length}`,
        {
          method: 'GET',
          accessToken,
        },
      );
      const chunk = Array.isArray(data) ? data : [];
      setRows((prev) => [...prev, ...chunk]);
      setHasMore(chunk.length === MEMBERS_PAGE_SIZE);
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setLoadMoreBusy(false);
    }
  }, [accessToken, workspaceId, rows.length, hasMore, loadMoreBusy]);

  useEffect(() => {
    void loadCurrentUser();
  }, [loadCurrentUser]);

  useEffect(() => {
    void loadMembers();
  }, [loadMembers]);

  async function deleteWorkspaceMember() {
    if (!accessToken || !deleteMember) return;
    setDeleteBusy(true);
    setMsg(null);
    try {
      await api<{ ok: boolean }>(`/workspace/${workspaceId}/members/${deleteMember.userId}`, {
        method: 'DELETE',
        accessToken,
      });
      setDeleteMember(null);
      await loadMembers();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function leaveWorkspace() {
    if (!accessToken) return;
    setLeaveBusy(true);
    setMsg(null);
    try {
      await api<{ ok: boolean }>(`/workspace/${workspaceId}/members/me`, {
        method: 'DELETE',
        accessToken,
      });
      navigate('/workspaces');
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setLeaveBusy(false);
    }
  }

  async function submitCreateInvite() {
    if (!accessToken) return;
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
      setCreateEmail('');
      setCreateRole('MEMBER');
      // список членов не меняется, но пусть UI обновится
      await loadMembers();
    } catch (e) {
      setMsg(formatInviteSendError(e));
    } finally {
      setCreateBusy(false);
    }
  }

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col">
          <div className="trello-topbar-stripe-left">
            <button
              type="button"
              className="trello-top-left-brand trello-top-left-brand--stripe"
              onClick={() => navigate('/workspaces')}
            >
              <span className="trello-logo" aria-hidden />
              <span className="trello-top-left-brand-text">mini trello</span>
            </button>
            <button
              type="button"
              className="trello-btn trello-btn-sm trello-btn-topbar-nav"
              onClick={() => navigate('/workspaces')}
            >
              ← Рабочие пространства
            </button>
          </div>
          <h1 className="trello-topbar-stripe-center">Участники рабочего пространства</h1>
          <div className="trello-topbar-actions">
            <button
              type="button"
              className="trello-btn trello-btn-primary"
              disabled={!accessToken || !canManageWorkspace || createBusy}
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
          <div className="trello-banner trello-banner-warn">
            Войдите на главной, чтобы управлять рабочим пространством.
            <button type="button" className="trello-inline-link" onClick={() => navigate('/')}>
              На главную
            </button>
          </div>
        )}

        {(msg && <div className="trello-banner trello-banner-error">{msg}</div>) || null}

        <div className="trello-members-table-block">
          {loading ? (
            <div className="trello-empty">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="trello-empty">Участников пока нет.</div>
          ) : (
            <div className="trello-table-wrap">
              <table className="trello-table">
                <thead>
                  <tr>
                    <th>Пользователь</th>
                    <th>Роль</th>
                    <th>Добавлен</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((member) => {
                    const isMe = member.userId === currentUserId;
                    const deleteAllowed = canManageWorkspace && !isMe && member.role !== 'OWNER';
                    return (
                      <tr key={member.id}>
                        <td>
                          <div className="trello-cell-title">
                            <span style={{ display: 'inline-flex', gap: 10, alignItems: 'center' }}>
                              {member.user.avatarPath && !brokenAvatarUserIds[member.user.id] ? (
                                <img
                                  src={avatarSrcFromPath(member.user.avatarPath)}
                                  alt=""
                                  loading="lazy"
                                  referrerPolicy="no-referrer"
                                  crossOrigin="anonymous"
                                  width={28}
                                  height={28}
                                  style={{
                                    borderRadius: 8,
                                    border: '1px solid #dfe1e6',
                                    objectFit: 'cover',
                                    display: 'block',
                                  }}
                                  onError={() =>
                                    setBrokenAvatarUserIds((prev) => ({
                                      ...prev,
                                      [member.user.id]: true,
                                    }))
                                  }
                                />
                              ) : (
                                <div
                                  style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 8,
                                    border: '1px solid #dfe1e6',
                                    background: '#f1f2f4',
                                    flexShrink: 0,
                                  }}
                                />
                              )}
                              {member.user.name}
                              {isMe ? ' (вы)' : ''}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="trello-pill">{formatWorkspaceRole(member.role)}</span>
                        </td>
                        <td className="trello-cell-meta">{formatDate(member.createdAt)}</td>
                        <td className="trello-row-actions">
                          {isMe ? (
                            <button
                              type="button"
                              className="trello-btn trello-btn-danger-ghost trello-btn-sm"
                              disabled={leaveBusy || currentUserLoadBusy}
                              onClick={() => void leaveWorkspace()}
                            >
                              {leaveBusy ? 'Выход…' : 'Выйти'}
                            </button>
                          ) : deleteAllowed ? (
                            <button
                              type="button"
                              className="trello-btn trello-btn-danger-ghost trello-btn-sm"
                              disabled={deleteBusy}
                              onClick={() => {
                                setDeleteMember(member);
                                setMsg(null);
                              }}
                            >
                              Удалить
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rows.length > 0 && hasMore && (
            <div className="trello-workspaces-load-more">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                disabled={loadMoreBusy}
                onClick={() => void loadMoreMembers()}
              >
                {loadMoreBusy ? 'Загрузка…' : 'Загрузить ещё'}
              </button>
            </div>
          )}
        </div>

        {createOpen && (
          <div
            className="trello-modal-backdrop"
            role="presentation"
            onClick={() => !createBusy && setCreateOpen(false)}
          >
            <div className="trello-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
              <div className="trello-modal-head">
                <h2 className="trello-modal-title">Отправить приглашение</h2>
                <button
                  type="button"
                  className="trello-modal-close"
                  onClick={() => !createBusy && setCreateOpen(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="trello-modal-body">
                <label className="trello-field">
                  <span className="trello-label">Почта *</span>
                  <input
                    className="trello-input"
                    value={createEmail}
                    onChange={(e) => setCreateEmail(e.target.value)}
                    autoComplete="email"
                  />
                </label>
                <div className="trello-field">
                  <span className="trello-label" id="invite-role-label">
                    Роль
                  </span>
                  <div
                    className="trello-invite-role-toggle"
                    role="group"
                    aria-labelledby="invite-role-label"
                  >
                    <button
                      type="button"
                      className={
                        createRole === 'MEMBER'
                          ? 'trello-invite-role-btn trello-invite-role-btn--active'
                          : 'trello-invite-role-btn'
                      }
                      disabled={createBusy}
                      onClick={() => setCreateRole('MEMBER')}
                    >
                      Участник
                    </button>
                    <button
                      type="button"
                      className={
                        createRole === 'ADMIN'
                          ? 'trello-invite-role-btn trello-invite-role-btn--active'
                          : 'trello-invite-role-btn'
                      }
                      disabled={createBusy}
                      onClick={() => setCreateRole('ADMIN')}
                    >
                      Администратор
                    </button>
                  </div>
                </div>
              </div>
              <div className="trello-modal-foot">
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost"
                  onClick={() => !createBusy && setCreateOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="trello-btn trello-btn-primary"
                  disabled={createBusy}
                  onClick={() => void submitCreateInvite()}
                >
                  {createBusy ? 'Отправка…' : 'Отправить приглашение'}
                </button>
              </div>
            </div>
          </div>
        )}

        {deleteMember && (
          <div
            className="trello-modal-backdrop"
            role="presentation"
            onClick={() => !deleteBusy && setDeleteMember(null)}
          >
            <div
              className="trello-modal trello-modal-narrow"
              role="dialog"
              aria-modal
              onClick={(e) => e.stopPropagation()}
            >
              <div className="trello-modal-head">
                <h2 className="trello-modal-title">Удалить участника?</h2>
                <button
                  type="button"
                  className="trello-modal-close"
                  onClick={() => !deleteBusy && setDeleteMember(null)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="trello-modal-body">
                <p className="trello-confirm-text">
                  Пользователь <strong>#{deleteMember.userId}</strong> будет удален из рабочего пространства #{workspaceId}.
                </p>
              </div>
              <div className="trello-modal-foot">
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost"
                  onClick={() => !deleteBusy && setDeleteMember(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="trello-btn trello-btn-danger"
                  disabled={deleteBusy}
                  onClick={() => void deleteWorkspaceMember()}
                >
                  {deleteBusy ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

