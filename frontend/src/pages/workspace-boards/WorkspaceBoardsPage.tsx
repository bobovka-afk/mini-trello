import { useCallback, useEffect, useState } from 'react';
import { AlertModal } from '@shared/ui/alert-modal/AlertModal';
import { ModalForm } from '@shared/ui/modal-form';
import { api, type ApiError } from '@shared/api';
import {
  SpaLink,
} from '@shared/lib/navigation';
import { handleSpaTileAuxClick, handleSpaTileClick, navigate } from '@shared/lib/navigation-core';
import {
  canArchiveBoards,
  canManageBoards,
  canManageWorkspaceLegacy,
  type WorkspacePermissions,
} from '@entities/workspace';
import { WorkspaceOnboardingBanner } from '@widgets/workspace-onboarding/WorkspaceOnboardingBanner';
import { WorkspaceSearchModal } from '@widgets/workspace-search/WorkspaceSearchModal';
import { useWorkspaceSearchHotkey } from '@shared/lib/useWorkspaceSearchHotkey';

export type BoardRow = {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  position: number;
  archivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  accessToken: string | null;
  workspaceId: number;
};

function formatError(e: unknown) {
  const err = e as Partial<ApiError>;
  if (typeof err?.message === 'string') return err.message;
  return 'Ошибка запроса';
}

function formatWorkspaceNameForUI(name: string) {
  const m = name.match(/^\s*\d+\s*\((.*)\)\s*$/);
  return m ? m[1] : name;
}

function nextBoardPosition(rows: BoardRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((max, row) => (row.position > max ? row.position : max), rows[0].position) + 1;
}

const TILE_VARIANTS = ['px-tile--1', 'px-tile--2', 'px-tile--3'] as const;

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function WorkspaceBoardsPage({ accessToken, workspaceId }: Props) {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [workspaceTitle, setWorkspaceTitle] = useState<string>('');
  const [myRole, setMyRole] = useState<string | null>(null);
  const [myPermissions, setMyPermissions] = useState<WorkspacePermissions | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [archivedBoards, setArchivedBoards] = useState<BoardRow[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);

  useWorkspaceSearchHotkey(() => setSearchOpen(true), Boolean(accessToken));
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertText, setAlertText] = useState('');

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [editBoard, setEditBoard] = useState<BoardRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editBusy, setEditBusy] = useState(false);
  const [boardToDelete, setBoardToDelete] = useState<BoardRow | null>(null);
  const [deleteBoardBusy, setDeleteBoardBusy] = useState(false);

  const loadWorkspaceLabel = useCallback(async () => {
    if (!accessToken) {
      setMyRole(null);
      return;
    }
    try {
      const data = await api<{
        id: number;
        name: string;
        description: string | null;
        myRole: string | null;
        myPermissions: WorkspacePermissions | null;
      }>(`/workspace/${workspaceId}/summary`, { method: 'GET', accessToken });
      setWorkspaceTitle(formatWorkspaceNameForUI(data.name));
      setMyRole(data.myRole ?? null);
      setMyPermissions(data.myPermissions ?? null);
    } catch {
      setWorkspaceTitle(`Workspace ${workspaceId}`);
      setMyRole(null);
      setMyPermissions(null);
    }
  }, [accessToken, workspaceId]);

  const loadArchivedBoards = useCallback(async () => {
    if (!accessToken || !canArchiveBoards(myPermissions) && !canManageWorkspaceLegacy(myRole)) return;
    try {
      const data = await api<BoardRow[]>(
        `/workspace/${workspaceId}/boards/archived/list`,
        { method: 'GET', accessToken },
      );
      setArchivedBoards(Array.isArray(data) ? data : []);
    } catch {
      setArchivedBoards([]);
    }
  }, [accessToken, workspaceId, myPermissions, myRole]);

  const loadBoards = useCallback(async (options?: { silent?: boolean }) => {
    if (!accessToken) {
      setBoards([]);
      setLoading(false);
      return;
    }
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
      setMsg(null);
    }
    try {
      const data = await api<BoardRow[]>(
        `/workspace/${workspaceId}/boards`,
        { method: 'GET', accessToken },
      );
      setBoards(Array.isArray(data) ? data : []);
    } catch (e) {
      if (!silent) {
        setMsg(formatError(e));
      }
      setBoards([]);
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [accessToken, workspaceId]);

  useEffect(() => {
    void loadWorkspaceLabel();
  }, [loadWorkspaceLabel]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  useEffect(() => {
    if (archiveOpen) void loadArchivedBoards();
  }, [archiveOpen, loadArchivedBoards]);

  async function submitCreate() {
    if (!accessToken) return;
    const name = createName.trim();
    if (name.length < 3) return;
    const position = nextBoardPosition(boards);
    setCreateBusy(true);
    setMsg(null);
    try {
      const created = await api<BoardRow>(`/workspace/${workspaceId}/boards`, {
        method: 'POST',
        accessToken,
        json: { name, position },
      });
      setCreateOpen(false);
      setCreateName('');
      setBoards((prev) =>
        [...prev, created].sort((a, b) => a.position - b.position || a.id - b.id),
      );
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    } finally {
      setCreateBusy(false);
    }
  }

  async function submitEditBoard() {
    if (!accessToken || !editBoard) return;
    const name = editName.trim();
    if (name.length < 3) return;
    setEditBusy(true);
    setMsg(null);
    try {
      const updated = await api<BoardRow>(`/workspace/${workspaceId}/boards/${editBoard.id}`, {
        method: 'PATCH',
        accessToken,
        json: { name },
      });
      setEditBoard(null);
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setEditBusy(false);
    }
  }

  const canManage = canManageBoards(myPermissions) || canManageWorkspaceLegacy(myRole);
  const canArchive = canArchiveBoards(myPermissions) || canManageWorkspaceLegacy(myRole);

  async function archiveBoardFromEdit() {
    if (!accessToken || !editBoard) return;
    await archiveBoardRow(editBoard);
    setEditBoard(null);
  }

  async function archiveBoardRow(b: BoardRow) {
    if (!accessToken) return;
    try {
      await api(`/workspace/${workspaceId}/boards/${b.id}/archive`, {
        method: 'PATCH',
        accessToken,
      });
      setBoards((prev) => prev.filter((row) => row.id !== b.id));
      setArchivedBoards((prev) => [...prev, { ...b, archivedAt: new Date().toISOString() }]);
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    }
  }

  async function restoreBoardRow(b: BoardRow) {
    if (!accessToken) return;
    try {
      await api(`/workspace/${workspaceId}/boards/${b.id}/unarchive`, {
        method: 'PATCH',
        accessToken,
      });
      setArchivedBoards((prev) => prev.filter((row) => row.id !== b.id));
      setBoards((prev) =>
        [...prev, { ...b, archivedAt: null }].sort(
          (a, b) => a.position - b.position || a.id - b.id,
        ),
      );
    } catch (e) {
      setAlertText(formatError(e));
      setAlertOpen(true);
    }
  }

  async function submitDeleteBoard() {
    if (!accessToken || !boardToDelete) return;
    setDeleteBoardBusy(true);
    setMsg(null);
    try {
      await api(`/workspace/${workspaceId}/boards/${boardToDelete.id}`, {
        method: 'DELETE',
        accessToken,
      });
      const deletedId = boardToDelete.id;
      setBoardToDelete(null);
      setEditBoard(null);
      setBoards((prev) => prev.filter((b) => b.id !== deletedId));
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setDeleteBoardBusy(false);
    }
  }

  return (
    <div className="px-page">
      <header className="px-topbar">
        <div className="px-topbar-left">
          <SpaLink className="px-btn px-btn--ghost" to="/workspaces">
            ← Назад
          </SpaLink>
          <span className="px-breadcrumb">Пространства /</span>
          <h1 className="px-topbar-title">{workspaceTitle || '…'}</h1>
        </div>
      </header>

      {accessToken ? (
        <div className="px-toolbar">
          <button
            type="button"
            className="px-btn px-btn--primary"
            onClick={() => {
              setCreateOpen(true);
              setMsg(null);
            }}
          >
            + Доска
          </button>
          <button
            type="button"
            className="px-btn px-btn--ghost px-btn--with-icon"
            onClick={() => setSearchOpen(true)}
            title="Поиск (⌘K / Ctrl+K)"
          >
            <SearchIcon className="px-btn__ico" />
            Поиск
          </button>
          {canArchive ? (
            <button
              type="button"
              className="px-btn px-btn--ghost"
              onClick={() => setArchiveOpen((o) => !o)}
            >
              Архив
            </button>
          ) : null}
        </div>
      ) : null}

      {!accessToken && (
        <div className="px-content">
          <div className="trello-banner trello-banner-warn">
            Войдите на главной, чтобы видеть доски.
            <SpaLink className="trello-inline-link" to="/">
              Войти
            </SpaLink>
          </div>
        </div>
      )}

      {msg && (
        <div className="px-content">
          <div className="trello-banner trello-banner-error">{msg}</div>
        </div>
      )}

      <div className="px-content">
        {loading ? (
          <p className="px-empty">Загрузка досок…</p>
        ) : boards.length === 0 && accessToken ? (
          <WorkspaceOnboardingBanner onCreateBoard={() => setCreateOpen(true)} />
        ) : (
          <div className="px-tile-grid">
            {boards.map((b, i) => (
              <div
                key={b.id}
                className={`px-tile ${TILE_VARIANTS[i % TILE_VARIANTS.length]}`}
                onClick={(e) =>
                  handleSpaTileClick(e, `/workspaces/${workspaceId}/boards/${b.id}`)
                }
                onAuxClick={(e) =>
                  handleSpaTileAuxClick(e, `/workspaces/${workspaceId}/boards/${b.id}`)
                }
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/workspaces/${workspaceId}/boards/${b.id}`);
                  }
                }}
              >
                {canManage ? (
                  <button
                    type="button"
                    className="trello-board-tile-menu"
                    aria-label="Редактировать доску"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditBoard(b);
                      setEditName(b.name);
                      setMsg(null);
                    }}
                  >
                    ✎
                  </button>
                ) : null}
                <span className="px-tile-name">{b.name}</span>
              </div>
            ))}
            {accessToken && (
              <button
                type="button"
                className="px-tile px-tile-add"
                onClick={() => {
                  setCreateOpen(true);
                  setMsg(null);
                }}
              >
                <span className="px-tile-add-icon">+</span>
                <span>Новая доска</span>
              </button>
            )}
          </div>
        )}

        {archiveOpen && canArchive && (
          <section className="trello-ws-archived" aria-live="polite">
            <h2 className="trello-ws-archived-title">Архив досок</h2>
            {archivedBoards.length === 0 ? (
              <p className="trello-settings-card-hint">Архив пуст.</p>
            ) : null}
            {archivedBoards.length > 0 ? (
              <ul className="trello-ws-archived-list">
                {archivedBoards.map((b) => (
                  <li key={b.id}>
                    <span>{b.name}</span>
                    <button
                      type="button"
                      className="trello-btn trello-btn-sm trello-btn-ghost"
                      onClick={() => void restoreBoardRow(b)}
                    >
                      Восстановить
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        )}
      </div>

      {accessToken && (
        <WorkspaceSearchModal
          accessToken={accessToken}
          workspaceId={workspaceId}
          open={searchOpen}
          onClose={() => setSearchOpen(false)}
        />
      )}

      {createOpen && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !createBusy && setCreateOpen(false)}
        >
          <div
            className="trello-modal trello-modal--board-form"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Новая доска</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !createBusy && setCreateOpen(false)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <ModalForm
              onSubmit={submitCreate}
              disabled={createName.trim().length < 3 || createBusy}
            >
              <div className="trello-modal-body">
                <label className="trello-field">
                  <span className="trello-label">Название</span>
                  <input
                    className="trello-input"
                    value={createName}
                    onChange={(e) => setCreateName(e.target.value)}
                    maxLength={50}
                    autoFocus
                  />
                </label>
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
                  type="submit"
                  className="trello-btn trello-btn-primary"
                  disabled={createName.trim().length < 3 || createBusy}
                >
                  {createBusy ? 'Создание…' : 'Создать'}
                </button>
              </div>
            </ModalForm>
          </div>
        </div>
      )}
      {editBoard && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !editBusy && setEditBoard(null)}
        >
          <div
            className="trello-modal trello-modal--board-form"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Редактировать доску</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !editBusy && setEditBoard(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <ModalForm
              onSubmit={submitEditBoard}
              disabled={editName.trim().length < 3 || editBusy}
            >
              <div className="trello-modal-body">
                <label className="trello-field">
                  <span className="trello-label">Название</span>
                  <input
                    className="trello-input"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={50}
                    autoFocus
                  />
                </label>
              </div>
              <div className="trello-modal-foot trello-modal-foot-split">
                <div className="trello-modal-foot-danger-group">
                  {canArchive && (
                    <button
                      type="button"
                      className="trello-btn trello-btn-ghost"
                      disabled={editBusy || deleteBoardBusy}
                      onClick={() => void archiveBoardFromEdit()}
                    >
                      В архив
                    </button>
                  )}
                  <button
                    type="button"
                    className="trello-btn trello-btn-danger"
                    disabled={editBusy || deleteBoardBusy}
                    onClick={() => {
                      if (!editBoard || editBusy) return;
                      setBoardToDelete(editBoard);
                      setEditBoard(null);
                    }}
                  >
                    Удалить
                  </button>
                </div>
                <div className="trello-modal-foot-actions">
                  <button
                    type="button"
                    className="trello-btn trello-btn-ghost"
                    onClick={() => !editBusy && setEditBoard(null)}
                  >
                    Отмена
                  </button>
                  <button
                    type="submit"
                    className="trello-btn trello-btn-primary"
                    disabled={editName.trim().length < 3 || editBusy}
                  >
                    {editBusy ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </div>
              </div>
            </ModalForm>
          </div>
        </div>
      )}
      <AlertModal
        open={alertOpen}
        message={alertText}
        onClose={() => setAlertOpen(false)}
      />

      {boardToDelete && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !deleteBoardBusy && setBoardToDelete(null)}
        >
          <div
            className="trello-modal trello-modal-narrow"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Удалить доску?</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !deleteBoardBusy && setBoardToDelete(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <div className="trello-modal-body">
              <p className="trello-confirm-text">
                Доска «<strong>{boardToDelete.name}</strong>» будет удалена без возможности восстановления.
              </p>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !deleteBoardBusy && setBoardToDelete(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-danger"
                disabled={deleteBoardBusy}
                onClick={() => void submitDeleteBoard()}
              >
                {deleteBoardBusy ? 'Удаление…' : 'Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
