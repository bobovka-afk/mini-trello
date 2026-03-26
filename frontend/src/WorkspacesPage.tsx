import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';
import { formatWorkspaceRole } from './lib/roles';

type WorkspaceMemberRow = {
  id: number;
  workspaceId: number;
  userId: number;
  role: string;
  createdAt: string;
  workspace: {
    id: number;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
  };
};

type WorkspaceUpdateRes = {
  id: number;
  name: string;
  description: string | null;
};

function navigate(to: string) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

function canManageWorkspace(role: string) {
  return role === 'OWNER' || role === 'ADMIN';
}

function formatWorkspaceNameForUI(name: string) {
  // Sometimes stored name comes like: `12345(Название)`.
  // For UI show only `Название`.
  const m = name.match(/^\s*\d+\s*\((.*)\)\s*$/);
  return m ? m[1] : name;
}

type Props = { accessToken: string | null };

export function WorkspacesPage({ accessToken }: Props) {
  const [rows, setRows] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const [editRow, setEditRow] = useState<WorkspaceMemberRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const [deleteRow, setDeleteRow] = useState<WorkspaceMemberRow | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false);
      setRows([]);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const data = await api<WorkspaceMemberRow[]>('/workspace/get-user-workspaces', {
        method: 'GET',
        accessToken,
      });
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg(formatError(e));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitCreate() {
    if (!accessToken) return;
    setCreateBusy(true);
    setMsg(null);
    try {
      const body: { name: string; description?: string } = { name: createName.trim() };
      const d = createDesc.trim();
      if (d.length >= 3) body.description = d;

      await api('/workspace/create', {
        method: 'POST',
        accessToken,
        json: body,
      });
      setCreateOpen(false);
      setCreateName('');
      setCreateDesc('');
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setCreateBusy(false);
    }
  }

  function openEdit(row: WorkspaceMemberRow) {
    setEditRow(row);
    setEditName(formatWorkspaceNameForUI(row.workspace.name));
    setEditDesc(row.workspace.description ?? '');
    setMsg(null);
  }

  function buildEditPatch(row: WorkspaceMemberRow, name: string, desc: string) {
    const json: { name?: string; description?: string } = {};
    const n = name.trim();
    const d = desc.trim();
    const currentName = formatWorkspaceNameForUI(row.workspace.name);
    if (n && n !== currentName) json.name = n;
    if (d.length >= 3 && d !== (row.workspace.description ?? '')) {
      json.description = d;
    }
    return json;
  }

  async function submitEdit() {
    if (!accessToken || !editRow) return;
    setEditBusy(true);
    setMsg(null);
    try {
      const json = buildEditPatch(editRow, editName, editDesc);
      if (Object.keys(json).length === 0) {
        setMsg('Нет изменений для сохранения.');
        setEditBusy(false);
        return;
      }

      const updated = await api<WorkspaceUpdateRes>(`/workspace/${editRow.workspace.id}`, {
        method: 'PATCH',
        accessToken,
        json,
      });

      setRows((prev) =>
        prev.map((r) =>
          r.workspace.id === updated.id
            ? {
                ...r,
                workspace: {
                  ...r.workspace,
                  name: updated.name,
                  description: updated.description,
                  updatedAt: new Date().toISOString(),
                },
              }
            : r,
        ),
      );
      setEditRow(null);
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function confirmDelete() {
    if (!accessToken || !deleteRow) return;
    setDeleteBusy(true);
    setMsg(null);
    try {
      await api<{ ok: boolean }>(`/workspace/${deleteRow.workspace.id}`, {
        method: 'DELETE',
        accessToken,
      });
      setDeleteRow(null);
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  const canCreate = createName.trim().length >= 3;
  const canEditSave =
    !!editRow &&
    editName.trim().length >= 3 &&
    Object.keys(buildEditPatch(editRow, editName, editDesc)).length > 0;

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar">
          <div>
            <button
              type="button"
              className="trello-top-left-brand"
              onClick={() => navigate('/workspaces')}
            >
              <span className="trello-logo" aria-hidden />
              <span className="trello-top-left-brand-text">mini trello</span>
            </button>
            <h1 className="trello-boards-title">Рабочие пространства</h1>
          </div>
          <div className="trello-topbar-actions">
            {accessToken && rows.length > 0 && (
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                onClick={() => {
                  setCreateOpen(true);
                  setMsg(null);
                }}
              >
                Создать рабочее пространство
              </button>
            )}
          </div>
        </header>

        {!accessToken && (
          <div className="trello-banner trello-banner-warn">
            Войдите на главной, чтобы управлять рабочими пространствами.
            <button type="button" className="trello-inline-link" onClick={() => navigate('/')}>
              На главную
            </button>
          </div>
        )}

        {msg && <div className="trello-banner trello-banner-error">{msg}</div>}

        <section className="trello-panel">
          <div className="trello-panel-head">
            <span className="trello-panel-title">Ваши рабочие пространства</span>
          </div>

          {loading ? (
            <div className="trello-empty">Загрузка…</div>
          ) : rows.length === 0 ? (
            accessToken ? (
              <div className="trello-workspaces-empty-grid">
                <button
                  type="button"
                  className="trello-board-tile trello-board-tile-add"
                  onClick={() => {
                    setCreateOpen(true);
                    setMsg(null);
                  }}
                >
                  <span className="trello-board-tile-add-icon">+</span>
                    <span>Создать рабочее пространство</span>
                </button>
              </div>
            ) : (
              <div className="trello-empty">Пока нет рабочих пространств.</div>
            )
          ) : (
            <div className="trello-table-wrap">
              <table className="trello-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Роль</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(`/workspaces/${row.workspace.id}/boards`)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          navigate(`/workspaces/${row.workspace.id}/boards`);
                        }
                      }}
                    >
                      <td>
                        <div className="trello-cell-title">
                          {formatWorkspaceNameForUI(row.workspace.name)}
                        </div>
                      </td>
                      <td className="trello-cell-desc">
                        {row.workspace.description?.trim()
                          ? row.workspace.description
                          : '—'}
                      </td>
                      <td>
                        <span className="trello-pill">{formatWorkspaceRole(row.role)}</span>
                      </td>
                      <td className="trello-row-actions">
                        <button
                          type="button"
                          className="trello-btn trello-btn-primary trello-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workspaces/${row.workspace.id}/boards`);
                          }}
                        >
                          Доски
                        </button>
                        <button
                          type="button"
                          className="trello-btn trello-btn-ghost trello-btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/workspaces/${row.workspace.id}/members`);
                          }}
                        >
                          Участники
                        </button>
                        {canManageWorkspace(row.role) ? (
                          <>
                            <button
                              type="button"
                              className="trello-btn trello-btn-ghost trello-btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEdit(row);
                              }}
                            >
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="trello-btn trello-btn-danger-ghost trello-btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeleteRow(row);
                                setMsg(null);
                              }}
                            >
                              Удалить
                            </button>
                          </>
                        ) : (
                          <span className="trello-cell-meta">Только просмотр</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      {createOpen && (
        <div className="trello-modal-backdrop" role="presentation" onClick={() => !createBusy && setCreateOpen(false)}>
          <div className="trello-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Создать рабочее пространство</h2>
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
                <span className="trello-label">Название *</span>
                <input
                  className="trello-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={18}
                />
              </label>
              <label className="trello-field">
                <span className="trello-label">Описание</span>
                <textarea
                  className="trello-textarea"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={3}
                  maxLength={255}
                />
              </label>
            </div>
            <div className="trello-modal-foot">
              <button type="button" className="trello-btn trello-btn-ghost" onClick={() => !createBusy && setCreateOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={!canCreate || createBusy}
                onClick={() => void submitCreate()}
              >
                {createBusy ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="trello-modal-backdrop" role="presentation" onClick={() => !editBusy && setEditRow(null)}>
          <div className="trello-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Настройки рабочего пространства</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !editBusy && setEditRow(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <label className="trello-field">
                <span className="trello-label">Название</span>
                <input
                  className="trello-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={18}
                />
              </label>
              <label className="trello-field">
                <span className="trello-label">Описание</span>
                <textarea
                  className="trello-textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  maxLength={255}
                />
              </label>
            </div>
            <div className="trello-modal-foot">
              <button type="button" className="trello-btn trello-btn-ghost" onClick={() => !editBusy && setEditRow(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={!canEditSave || editBusy}
                onClick={() => void submitEdit()}
              >
                {editBusy ? 'Сохранение…' : 'Сохранить'}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteRow && (
        <div className="trello-modal-backdrop" role="presentation" onClick={() => !deleteBusy && setDeleteRow(null)}>
          <div
            className="trello-modal trello-modal-narrow"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Удалить рабочее пространство?</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !deleteBusy && setDeleteRow(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <p className="trello-confirm-text">
                <strong>{formatWorkspaceNameForUI(deleteRow.workspace.name)}</strong> будет удалено безвозвратно (если у вас есть права).
              </p>
            </div>
            <div className="trello-modal-foot">
              <button type="button" className="trello-btn trello-btn-ghost" onClick={() => !deleteBusy && setDeleteRow(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-danger"
                disabled={deleteBusy}
                onClick={() => void confirmDelete()}
              >
                {deleteBusy ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
