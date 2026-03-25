import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';

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
          <button type="button" className="jira-nav-item jira-nav-item-active">
            Рабочие пространства
          </button>
        </nav>
      </aside>

      <div className="jira-main">
        <header className="jira-topbar">
          <div>
            <h1 className="jira-page-title">Рабочие пространства</h1>
            <p className="jira-page-desc">
              Создавайте команды, редактируйте настройки и удаляйте пространства (owner/admin).
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
              Создать пространство
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

        {msg && <div className="jira-banner jira-banner-error">{msg}</div>}

        <section className="jira-panel">
          <div className="jira-panel-head">
            <span className="jira-panel-title">Ваши пространства</span>
          </div>

          {loading ? (
            <div className="jira-empty">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="jira-empty">
              Пока нет пространств. Создайте первое — кнопка справа вверху.
            </div>
          ) : (
            <div className="jira-table-wrap">
              <table className="jira-table">
                <thead>
                  <tr>
                    <th>Название</th>
                    <th>Описание</th>
                    <th>Роль</th>
                    <th>Обновлено</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="jira-cell-title">
                          {formatWorkspaceNameForUI(row.workspace.name)}
                        </div>
                      </td>
                      <td className="jira-cell-desc">
                        {row.workspace.description?.trim()
                          ? row.workspace.description
                          : '—'}
                      </td>
                      <td>
                        <span className="jira-pill">{row.role}</span>
                      </td>
                      <td className="jira-cell-meta">{formatDate(row.workspace.updatedAt)}</td>
                      <td className="jira-row-actions">
                        <button
                          type="button"
                          className="jira-btn jira-btn-ghost jira-btn-sm"
                          onClick={() => navigate(`/workspaces/${row.workspace.id}/members`)}
                        >
                          Участники
                        </button>
                        {canManageWorkspace(row.role) ? (
                          <>
                            <button type="button" className="jira-btn jira-btn-ghost jira-btn-sm" onClick={() => openEdit(row)}>
                              Изменить
                            </button>
                            <button
                              type="button"
                              className="jira-btn jira-btn-danger-ghost jira-btn-sm"
                              onClick={() => {
                                setDeleteRow(row);
                                setMsg(null);
                              }}
                            >
                              Удалить
                            </button>
                          </>
                        ) : (
                          <span className="jira-cell-meta">Только просмотр</span>
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
        <div className="jira-modal-backdrop" role="presentation" onClick={() => !createBusy && setCreateOpen(false)}>
          <div className="jira-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="jira-modal-header">
              <h2 className="jira-modal-title">Создать пространство</h2>
              <button type="button" className="jira-icon-btn" onClick={() => !createBusy && setCreateOpen(false)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="jira-modal-body">
              <label className="jira-field">
                <span className="jira-label">Название *</span>
                <input
                  className="jira-input"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  maxLength={18}
                />
              </label>
              <label className="jira-field">
                <span className="jira-label">Описание</span>
                <textarea
                  className="jira-textarea"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  rows={3}
                  maxLength={255}
                />
              </label>
            </div>
            <div className="jira-modal-footer">
              <button type="button" className="jira-btn jira-btn-ghost" onClick={() => !createBusy && setCreateOpen(false)}>
                Отмена
              </button>
              <button type="button" className="jira-btn jira-btn-primary" disabled={!canCreate || createBusy} onClick={() => void submitCreate()}>
                {createBusy ? 'Создание…' : 'Создать'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editRow && (
        <div className="jira-modal-backdrop" role="presentation" onClick={() => !editBusy && setEditRow(null)}>
          <div className="jira-modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="jira-modal-header">
              <h2 className="jira-modal-title">Настройки пространства</h2>
              <button type="button" className="jira-icon-btn" onClick={() => !editBusy && setEditRow(null)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="jira-modal-body">
              <label className="jira-field">
                <span className="jira-label">Название</span>
                <input
                  className="jira-input"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  maxLength={18}
                />
              </label>
              <label className="jira-field">
                <span className="jira-label">Описание</span>
                <textarea
                  className="jira-textarea"
                  value={editDesc}
                  onChange={(e) => setEditDesc(e.target.value)}
                  rows={3}
                  maxLength={255}
                />
              </label>
            </div>
            <div className="jira-modal-footer">
              <button type="button" className="jira-btn jira-btn-ghost" onClick={() => !editBusy && setEditRow(null)}>
                Отмена
              </button>
              <button
                type="button"
                className="jira-btn jira-btn-primary"
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
        <div className="jira-modal-backdrop" role="presentation" onClick={() => !deleteBusy && setDeleteRow(null)}>
          <div className="jira-modal jira-modal-sm" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
            <div className="jira-modal-header">
              <h2 className="jira-modal-title">Удалить пространство?</h2>
              <button type="button" className="jira-icon-btn" onClick={() => !deleteBusy && setDeleteRow(null)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="jira-modal-body">
              <p className="jira-confirm-text">
                <strong>{formatWorkspaceNameForUI(deleteRow.workspace.name)}</strong> будет удалено безвозвратно (если у вас есть права).
              </p>
            </div>
            <div className="jira-modal-footer">
              <button type="button" className="jira-btn jira-btn-ghost" onClick={() => !deleteBusy && setDeleteRow(null)}>
                Отмена
              </button>
              <button type="button" className="jira-btn jira-btn-danger" disabled={deleteBusy} onClick={() => void confirmDelete()}>
                {deleteBusy ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
