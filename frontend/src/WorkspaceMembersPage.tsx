import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, API_URL, type ApiError } from './lib/api';

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

export function WorkspaceMembersPage({ accessToken, workspaceId }: Props) {
  const [rows, setRows] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [currentUser, setCurrentUser] = useState<UserMe | null>(null);
  const [currentUserLoadBusy, setCurrentUserLoadBusy] = useState(false);

  const [brokenAvatarUserIds, setBrokenAvatarUserIds] = useState<Record<number, boolean>>({});

  const [offset, setOffset] = useState(0);
  const limit = 20;

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
      return;
    }

    setLoading(true);
    setMsg(null);
    setBrokenAvatarUserIds({});
    try {
      const data = await api<WorkspaceMemberRow[]>(
        `/workspace/${workspaceId}/members?limit=${limit}&offset=${offset}`,
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
  }, [accessToken, workspaceId, offset]);

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
      // Важно: на бэке есть 2 DELETE роутa.
      // `/workspace/:workspaceId/members/:memberId` использует ParseIntPipe для `:memberId`,
      // поэтому передавать строку `me` туда нельзя (получится numeric string validation error).
      // Поэтому сразу дергаем роут с `members/me`.
      try {
        await api<{ ok: boolean }>(`/workspace/workspace/${workspaceId}/members/me`, {
          method: 'DELETE',
          accessToken,
        });
      } catch (e) {
        const err = e as Partial<ApiError>;
        // Если бэкенд “старый” и нужный роут не найден — пробуем альтернативу.
        if (err?.status !== 404) throw e;
        await api<{ ok: boolean }>(`/workspace/${workspaceId}/members/me`, {
          method: 'DELETE',
          accessToken,
        });
      }

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
            Участники
          </button>
        </nav>
      </aside>

      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Участники</h1>
          </div>
          <div className="jira-topbar-actions">
            <button type="button" className="jira-btn jira-btn-ghost" onClick={() => navigate('/workspaces')}>
              ← К пространствам
            </button>
            <button
              type="button"
              className="jira-btn jira-btn-primary"
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
          <div className="jira-banner jira-banner-warn">
            Войдите на главной странице, чтобы управлять пространствами.
            <button type="button" className="jira-link-btn" onClick={() => navigate('/')}>
              На главную
            </button>
          </div>
        )}

        {(msg && <div className="jira-banner jira-banner-error">{msg}</div>) || null}

        <section className="jira-panel">
          <div className="jira-panel-head">
            <span className="jira-panel-title">Члены пространства</span>
          </div>

          {loading ? (
            <div className="jira-empty">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="jira-empty">Участников пока нет.</div>
          ) : (
            <div className="jira-table-wrap">
              <table className="jira-table">
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
                          <div className="jira-cell-title">
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
                          <span className="jira-pill">{member.role}</span>
                        </td>
                        <td className="jira-cell-meta">{formatDate(member.createdAt)}</td>
                        <td className="jira-row-actions">
                          {isMe ? (
                            <button
                              type="button"
                              className="jira-btn jira-btn-danger-ghost jira-btn-sm"
                              disabled={leaveBusy || currentUserLoadBusy}
                              onClick={() => void leaveWorkspace()}
                            >
                              {leaveBusy ? 'Выход…' : 'Выйти'}
                            </button>
                          ) : deleteAllowed ? (
                            <button
                              type="button"
                              className="jira-btn jira-btn-danger-ghost jira-btn-sm"
                              disabled={deleteBusy}
                              onClick={() => {
                                setDeleteMember(member);
                                setMsg(null);
                              }}
                            >
                              Удалить
                            </button>
                          ) : canManageWorkspace ? (
                            <span className="jira-cell-meta">Нельзя удалить</span>
                          ) : (
                            <span className="jira-cell-meta">Только просмотр</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && rows.length > 0 && (
            <div className="jira-row-actions" style={{ padding: '12px 16px' }}>
              <button
                type="button"
                className="jira-btn jira-btn-ghost jira-btn-sm"
                disabled={offset === 0}
                onClick={() => setOffset((v) => Math.max(v - limit, 0))}
              >
                Назад
              </button>
              <button
                type="button"
                className="jira-btn jira-btn-ghost jira-btn-sm"
                disabled={rows.length < limit}
                onClick={() => setOffset((v) => v + limit)}
              >
                Вперед
              </button>
            </div>
          )}
        </section>

        {createOpen && (
          <div
            className="jira-modal-backdrop"
            role="presentation"
            onClick={() => !createBusy && setCreateOpen(false)}
          >
            <div className="jira-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
              <div className="jira-modal-header">
                <h2 className="jira-modal-title">Отправить приглашение</h2>
                <button
                  type="button"
                  className="jira-icon-btn"
                  onClick={() => !createBusy && setCreateOpen(false)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="jira-modal-body">
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
                <button
                  type="button"
                  className="jira-btn jira-btn-ghost"
                  onClick={() => !createBusy && setCreateOpen(false)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="jira-btn jira-btn-primary"
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
            className="jira-modal-backdrop"
            role="presentation"
            onClick={() => !deleteBusy && setDeleteMember(null)}
          >
            <div className="jira-modal jira-modal-sm" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
              <div className="jira-modal-header">
                <h2 className="jira-modal-title">Удалить участника?</h2>
                <button
                  type="button"
                  className="jira-icon-btn"
                  onClick={() => !deleteBusy && setDeleteMember(null)}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="jira-modal-body">
                <p className="jira-confirm-text">
                  Пользователь <strong>#{deleteMember.userId}</strong> будет удален из пространства #{workspaceId}.
                </p>
              </div>
              <div className="jira-modal-footer">
                <button type="button" className="jira-btn jira-btn-ghost" onClick={() => !deleteBusy && setDeleteMember(null)}>
                  Отмена
                </button>
                <button type="button" className="jira-btn jira-btn-danger" disabled={deleteBusy} onClick={() => void deleteWorkspaceMember()}>
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

