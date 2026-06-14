import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DragDropContext,
  Draggable,
  Droppable,
  type DropResult,
} from '@hello-pangea/dnd';
import { api, type ApiError } from '@shared/api';
import { ModalForm } from '@shared/ui/modal-form';
import { SpaLink } from '@shared/lib/navigation';
import { formatWorkspaceRole, canManageWorkspace } from '@entities/workspace';
import { WorkspaceSearchModal } from '@widgets/workspace-search/WorkspaceSearchModal';
import {
  WorkspaceQuickActionsPanel,
  WorkspaceQuickActionsPlaceholder,
} from '@widgets/workspaces-quick-actions/WorkspaceQuickActionsPanel';

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
  };
};

type WorkspaceUpdateRes = {
  id: number;
  name: string;
  description: string | null;
};

type WorkspaceStats = {
  boardCount: number | null;
  memberCount: number | null;
  loading: boolean;
};

const WORKSPACE_AVATAR_COLORS = [
  '#6b8c5a',
  '#5a7a9a',
  '#b87840',
  '#9a7a58',
  '#7a5a9a',
  '#4a8a8a',
] as const;

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

function formatWorkspaceNameForUI(name: string) {
  const m = name.match(/^\s*\d+\s*\((.*)\)\s*$/);
  return m ? m[1] : name;
}

function boardWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'доска';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'доски';
  return 'досок';
}

function memberWord(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'участник';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'участника';
  return 'участников';
}

function workspaceAvatarLetter(name: string) {
  const trimmed = formatWorkspaceNameForUI(name).trim();
  return trimmed ? trimmed[0].toUpperCase() : '?';
}

function workspaceAvatarColor(workspaceId: number) {
  return WORKSPACE_AVATAR_COLORS[workspaceId % WORKSPACE_AVATAR_COLORS.length];
}

function workspaceSummaryLine(row: WorkspaceMemberRow, stats?: WorkspaceStats) {
  const parts = [formatWorkspaceRole(row.role)];
  if (stats?.boardCount != null) {
    parts.push(`${stats.boardCount} ${boardWord(stats.boardCount)}`);
  }
  if (stats?.memberCount != null) {
    parts.push(`${stats.memberCount} ${memberWord(stats.memberCount)}`);
  }
  return parts.join(' · ');
}

type Props = { accessToken: string | null };

const WORKSPACES_PAGE_SIZE = 10;
const WORKSPACES_DROPPABLE_ID = 'user-workspaces';

export function WorkspacesPage({ accessToken }: Props) {
  const [rows, setRows] = useState<WorkspaceMemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [loadMoreBusy, setLoadMoreBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [expandedWorkspaceId, setExpandedWorkspaceId] = useState<number | null>(null);
  const [statsByWorkspaceId, setStatsByWorkspaceId] = useState<
    Record<number, WorkspaceStats>
  >({});

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
  const [searchOpen, setSearchOpen] = useState(false);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [editingWorkspaceNameId, setEditingWorkspaceNameId] = useState<number | null>(null);
  const [editingWorkspaceName, setEditingWorkspaceName] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const workspaceNameInputRef = useRef<HTMLInputElement>(null);

  const expandedRow = useMemo(
    () => rows.find((row) => row.workspace.id === expandedWorkspaceId) ?? null,
    [rows, expandedWorkspaceId],
  );

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!accessToken) {
      setLoading(false);
      setRows([]);
      setHasMore(false);
      return;
    }
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setMsg(null);
    }
    try {
      const data = await api<WorkspaceMemberRow[]>(
        `/workspace/get-user-workspaces?limit=${WORKSPACES_PAGE_SIZE}&offset=0`,
        {
          method: 'GET',
          accessToken,
        },
      );
      const list = Array.isArray(data) ? data : [];
      setRows(list);
      setHasMore(list.length === WORKSPACES_PAGE_SIZE);
    } catch (e) {
      if (!silent) {
        setMsg(formatError(e));
      }
      setRows([]);
      setHasMore(false);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [accessToken]);

  const loadMore = useCallback(async () => {
    if (!accessToken || loadMoreBusy || !hasMore) return;
    setLoadMoreBusy(true);
    setMsg(null);
    try {
      const data = await api<WorkspaceMemberRow[]>(
        `/workspace/get-user-workspaces?limit=${WORKSPACES_PAGE_SIZE}&offset=${rows.length}`,
        {
          method: 'GET',
          accessToken,
        },
      );
      const chunk = Array.isArray(data) ? data : [];
      setRows((prev) => [...prev, ...chunk]);
      setHasMore(chunk.length === WORKSPACES_PAGE_SIZE);
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setLoadMoreBusy(false);
    }
  }, [accessToken, loadMoreBusy, hasMore, rows.length]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (rows.length === 0) {
      setExpandedWorkspaceId(null);
      return;
    }
    setExpandedWorkspaceId((current) => {
      if (current != null && rows.some((row) => row.workspace.id === current)) {
        return current;
      }
      return rows[0].workspace.id;
    });
  }, [rows]);

  useEffect(() => {
    if (!accessToken || expandedWorkspaceId == null) return;

    const workspaceId = expandedWorkspaceId;
    let cancelled = false;

    setStatsByWorkspaceId((prev) => ({
      ...prev,
      [workspaceId]: {
        boardCount: prev[workspaceId]?.boardCount ?? null,
        memberCount: prev[workspaceId]?.memberCount ?? null,
        loading: true,
      },
    }));

    void (async () => {
      try {
        const [boards, members] = await Promise.all([
          api<unknown[]>(`/workspace/${workspaceId}/boards`, {
            method: 'GET',
            accessToken,
          }),
          api<unknown[]>(
            `/workspace/${workspaceId}/members?limit=100&offset=0`,
            { method: 'GET', accessToken },
          ),
        ]);
        if (cancelled) return;
        setStatsByWorkspaceId((prev) => ({
          ...prev,
          [workspaceId]: {
            boardCount: Array.isArray(boards) ? boards.length : 0,
            memberCount: Array.isArray(members) ? members.length : 0,
            loading: false,
          },
        }));
      } catch {
        if (!cancelled) {
          setStatsByWorkspaceId((prev) => ({
            ...prev,
            [workspaceId]: {
              boardCount: null,
              memberCount: null,
              loading: false,
            },
          }));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, expandedWorkspaceId]);

  function toggleWorkspaceExpanded(workspaceId: number) {
    setExpandedWorkspaceId((current) => (current === workspaceId ? null : workspaceId));
  }

  async function handleDragEnd(result: DropResult) {
    if (!accessToken || reorderBusy) return;
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (
      destination.droppableId !== WORKSPACES_DROPPABLE_ID ||
      source.droppableId !== WORKSPACES_DROPPABLE_ID
    ) {
      return;
    }
    if (destination.index === source.index) return;

    const memberId = Number(draggableId);
    if (!Number.isInteger(memberId)) return;

    setReorderBusy(true);
    setRows((prev) => {
      const next = [...prev];
      const [removed] = next.splice(source.index, 1);
      if (!removed) return prev;
      next.splice(destination.index, 0, removed);
      return next;
    });

    try {
      await api('/workspace/reorder-user-workspace', {
        method: 'PATCH',
        accessToken,
        json: { memberId, position: destination.index },
      });
    } catch (e) {
      setMsg(formatError(e));
      await load({ silent: true });
    } finally {
      setReorderBusy(false);
    }
  }

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
      await load({ silent: true });
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

  function applyWorkspaceUpdate(updated: WorkspaceUpdateRes) {
    setRows((prev) =>
      prev.map((r) =>
        r.workspace.id === updated.id
          ? {
              ...r,
              workspace: {
                ...r.workspace,
                name: updated.name,
                description: updated.description,
              },
            }
          : r,
      ),
    );
  }

  function startInlineWorkspaceRename(row: WorkspaceMemberRow) {
    if (!canManageWorkspace(row.role) || renameBusy) return;
    setEditingWorkspaceNameId(row.workspace.id);
    setEditingWorkspaceName(formatWorkspaceNameForUI(row.workspace.name));
    setMsg(null);
  }

  function cancelInlineWorkspaceRename() {
    setEditingWorkspaceNameId(null);
    setEditingWorkspaceName('');
  }

  async function saveInlineWorkspaceRename() {
    if (!accessToken || renameBusy || editingWorkspaceNameId == null) return;
    const row = rows.find((r) => r.workspace.id === editingWorkspaceNameId);
    if (!row) {
      cancelInlineWorkspaceRename();
      return;
    }

    const nextName = editingWorkspaceName.trim();
    const currentName = formatWorkspaceNameForUI(row.workspace.name);
    if (nextName.length < 3 || nextName === currentName) {
      cancelInlineWorkspaceRename();
      return;
    }

    setRenameBusy(true);
    setMsg(null);
    try {
      const updated = await api<WorkspaceUpdateRes>(`/workspace/${row.workspace.id}`, {
        method: 'PATCH',
        accessToken,
        json: { name: nextName },
      });
      applyWorkspaceUpdate(updated);
      cancelInlineWorkspaceRename();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setRenameBusy(false);
    }
  }

  useEffect(() => {
    if (editingWorkspaceNameId == null) return;
    workspaceNameInputRef.current?.focus();
    workspaceNameInputRef.current?.select();
  }, [editingWorkspaceNameId]);

  useEffect(() => {
    setEditingWorkspaceNameId(null);
    setEditingWorkspaceName('');
  }, [expandedWorkspaceId]);

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

      applyWorkspaceUpdate(updated);
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
      const deletedId = deleteRow.workspace.id;
      setDeleteRow(null);
      setRows((prev) => prev.filter((row) => row.workspace.id !== deletedId));
      setExpandedWorkspaceId((current) => (current === deletedId ? null : current));
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
    <div className="px-page">
      <header className="px-topbar">
        <div className="px-topbar-left">
          <h1 className="px-topbar-title">Рабочие пространства</h1>
        </div>
        <div className="px-topbar-actions">
          {accessToken ? (
            <button
              type="button"
              className="px-btn px-btn--primary"
              onClick={() => {
                setCreateOpen(true);
                setMsg(null);
              }}
            >
              + Пространство
            </button>
          ) : null}
        </div>
      </header>

      <div className="px-content">
        {!accessToken && (
          <div className="trello-banner trello-banner-warn">
            Войдите на главной, чтобы управлять рабочими пространствами.
            <SpaLink className="trello-inline-link" to="/">
              На главную
            </SpaLink>
          </div>
        )}

        {msg && <div className="trello-banner trello-banner-error">{msg}</div>}

        {loading ? (
          <p className="px-empty">Загрузка…</p>
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
            <p className="px-empty">Пока нет рабочих пространств.</p>
          )
        ) : (
          <div className="px-ws-layout">
            <DragDropContext onDragEnd={(result) => void handleDragEnd(result)}>
              <Droppable droppableId={WORKSPACES_DROPPABLE_ID}>
                {(droppableProvided) => (
                  <div className="px-ws-feed-wrap">
                    <div
                      ref={droppableProvided.innerRef}
                      {...droppableProvided.droppableProps}
                      className="px-ws-feed"
                    >
                    {rows.map((row, index) => {
                      const workspaceId = row.workspace.id;
                      const isExpanded = workspaceId === expandedWorkspaceId;
                      const stats = statsByWorkspaceId[workspaceId];
                      const displayName = formatWorkspaceNameForUI(row.workspace.name);
                      const panelId = `workspace-panel-${workspaceId}`;
                      const canDrag = rows.length > 1 && !reorderBusy;

                      return (
                        <Draggable
                          key={row.id}
                          draggableId={String(row.id)}
                          index={index}
                          isDragDisabled={!canDrag}
                        >
                          {(dragProvided, dragSnapshot) => (
                            <article
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              className={
                                dragSnapshot.isDragging
                                  ? 'px-ws-acc-row px-ws-acc-row--dragging'
                                  : 'px-ws-acc-row'
                              }
                              style={dragProvided.draggableProps.style}
                            >
                              <div className="px-ws-acc-head">
                                <div
                                  className={
                                    canDrag
                                      ? 'px-ws-acc-drag px-ws-acc-drag--active'
                                      : 'px-ws-acc-drag px-ws-acc-drag--disabled'
                                  }
                                  aria-label={
                                    canDrag ? `Перетащить «${displayName}»` : undefined
                                  }
                                  title={canDrag ? 'Перетащить' : undefined}
                                  {...(canDrag ? dragProvided.dragHandleProps : {})}
                                >
                                  <span className="px-ws-acc-drag-icon" aria-hidden />
                                </div>
                                <div
                                  className="px-ws-acc-hit"
                                  role="button"
                                  tabIndex={0}
                                  aria-expanded={isExpanded}
                                  aria-controls={panelId}
                                  aria-label={
                                    isExpanded
                                      ? `Свернуть «${displayName}»`
                                      : `Развернуть «${displayName}»`
                                  }
                                  onClick={() => toggleWorkspaceExpanded(workspaceId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                      e.preventDefault();
                                      toggleWorkspaceExpanded(workspaceId);
                                    }
                                  }}
                                >
                                  <div
                                    className="px-ws-acc-avatar"
                                    style={{ background: workspaceAvatarColor(workspaceId) }}
                                    aria-hidden
                                  >
                                    {workspaceAvatarLetter(row.workspace.name)}
                                  </div>
                                  <div className="px-ws-acc-meta">
                                    <SpaLink
                                      className="px-ws-acc-name"
                                      to={`/workspaces/${workspaceId}/boards`}
                                      title="Открыть доски"
                                      onClick={(e) => e.stopPropagation()}
                                      onAuxClick={(e) => e.stopPropagation()}
                                    >
                                      {displayName}
                                    </SpaLink>
                                    <span className="px-ws-acc-sub">
                                      {workspaceSummaryLine(row, stats)}
                                    </span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  className={
                                    isExpanded
                                      ? 'px-ws-acc-toggle px-ws-acc-toggle--expanded'
                                      : 'px-ws-acc-toggle'
                                  }
                                  aria-expanded={isExpanded}
                                  aria-controls={panelId}
                                  aria-label={
                                    isExpanded
                                      ? `Свернуть «${displayName}»`
                                      : `Развернуть «${displayName}»`
                                  }
                                  onClick={() => toggleWorkspaceExpanded(workspaceId)}
                                >
                                  {isExpanded ? '▼' : '▶'}
                                </button>
                              </div>
                              {isExpanded ? (
                                <div className="px-ws-acc-body" id={panelId}>
                                  <p className="px-ws-detail-desc">
                                    {row.workspace.description?.trim()
                                      ? row.workspace.description
                                      : 'Описание не задано.'}
                                  </p>
                                  <div className="px-ws-stats">
                                    <div className="px-ws-stat">
                                      {stats?.loading || stats?.boardCount == null ? (
                                        'Загрузка…'
                                      ) : (
                                        <>
                                          <strong>{stats.boardCount}</strong>{' '}
                                          {boardWord(stats.boardCount)}
                                        </>
                                      )}
                                    </div>
                                    <div className="px-ws-stat">
                                      {stats?.loading || stats?.memberCount == null ? (
                                        'Загрузка…'
                                      ) : (
                                        <>
                                          <strong>{stats.memberCount}</strong>{' '}
                                          {memberWord(stats.memberCount)}
                                        </>
                                      )}
                                    </div>
                                    <div className="px-ws-stat">
                                      Роль: <strong>{formatWorkspaceRole(row.role)}</strong>
                                    </div>
                                  </div>
                                </div>
                              ) : null}
                            </article>
                          )}
                        </Draggable>
                      );
                    })}
                    {droppableProvided.placeholder}
                    </div>
                    {hasMore ? (
                      <div className="px-ws-feed-foot">
                        <button
                          type="button"
                          className="px-btn px-btn--ghost"
                          disabled={loadMoreBusy || reorderBusy}
                          onClick={() => void loadMore()}
                        >
                          {loadMoreBusy ? 'Загрузка…' : 'Загрузить ещё'}
                        </button>
                      </div>
                    ) : null}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
            {expandedRow && accessToken ? (
              <WorkspaceQuickActionsPanel
                row={expandedRow}
                displayName={formatWorkspaceNameForUI(expandedRow.workspace.name)}
                canRename={canManageWorkspace(expandedRow.role)}
                nameEditing={editingWorkspaceNameId === expandedRow.workspace.id}
                editName={editingWorkspaceName}
                renameBusy={renameBusy}
                titleInputRef={workspaceNameInputRef}
                onStartRename={() => startInlineWorkspaceRename(expandedRow)}
                onEditNameChange={setEditingWorkspaceName}
                onSaveRename={() => saveInlineWorkspaceRename()}
                onCancelRename={cancelInlineWorkspaceRename}
                onEdit={() => openEdit(expandedRow)}
                onDelete={() => {
                  setDeleteRow(expandedRow);
                  setMsg(null);
                }}
                onSearchOpen={() => setSearchOpen(true)}
              />
            ) : (
              <WorkspaceQuickActionsPlaceholder />
            )}
          </div>
        )}
      </div>

      {accessToken && expandedWorkspaceId != null ? (
        <WorkspaceSearchModal
          accessToken={accessToken}
          workspaceId={expandedWorkspaceId}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}

      {createOpen && (
        <div className="trello-modal-backdrop" role="presentation" onClick={() => !createBusy && setCreateOpen(false)}>
          <div className="trello-modal trello-modal--board-form" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
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
            <ModalForm onSubmit={submitCreate} disabled={!canCreate || createBusy}>
              <div className="trello-modal-body">
                <label className="trello-field">
                  <span className="trello-label">Название</span>
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
                    rows={2}
                    maxLength={255}
                  />
                </label>
              </div>
              <div className="trello-modal-foot">
                <button type="button" className="trello-btn trello-btn-ghost" onClick={() => !createBusy && setCreateOpen(false)}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="trello-btn trello-btn-ghost"
                  disabled={!canCreate || createBusy}
                >
                  {createBusy ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </ModalForm>
          </div>
        </div>
      )}

      {editRow && (
        <div className="trello-modal-backdrop" role="presentation" onClick={() => !editBusy && setEditRow(null)}>
          <div className="trello-modal trello-modal--board-form" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
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
            <ModalForm onSubmit={submitEdit} disabled={!canEditSave || editBusy}>
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
                    rows={2}
                    maxLength={255}
                  />
                </label>
              </div>
              <div className="trello-modal-foot">
                <button type="button" className="trello-btn trello-btn-ghost" onClick={() => !editBusy && setEditRow(null)}>
                  Отмена
                </button>
                <button
                  type="submit"
                  className="trello-btn trello-btn-primary"
                  disabled={!canEditSave || editBusy}
                >
                  {editBusy ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </ModalForm>
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
                Рабочее пространство «<strong>{formatWorkspaceNameForUI(deleteRow.workspace.name)}</strong>» будет удалено без возможности восстановления.
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
