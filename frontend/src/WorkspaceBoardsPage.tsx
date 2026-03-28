import { useCallback, useEffect, useState } from 'react';
import { AlertModal } from './AlertModal';
import { api, type ApiError } from './lib/api';
import { canManageWorkspace } from './lib/roles';

export type BoardRow = {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  accessToken: string | null;
  workspaceId: number;
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

function formatWorkspaceNameForUI(name: string) {
  const m = name.match(/^\s*\d+\s*\((.*)\)\s*$/);
  return m ? m[1] : name;
}

function nextBoardPosition(rows: BoardRow[]): number {
  if (rows.length === 0) return 0;
  return rows.reduce((max, row) => (row.position > max ? row.position : max), rows[0].position) + 1;
}

const TILE_GRADIENTS = [
  'linear-gradient(135deg, #d29034 0%, #cd5a91 100%)',
  'linear-gradient(135deg, #61bd4f 0%, #2d8a54 100%)',
  'linear-gradient(135deg, #b04632 0%, #89609e 100%)',
  'linear-gradient(135deg, #89609e 0%, #cd5a91 100%)',
  'linear-gradient(135deg, #c3771d 0%, #b04632 100%)',
];

export function WorkspaceBoardsPage({ accessToken, workspaceId }: Props) {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [workspaceTitle, setWorkspaceTitle] = useState<string>('');
  const [myRole, setMyRole] = useState<string | null>(null);
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
      }>(`/workspace/${workspaceId}/summary`, { method: 'GET', accessToken });
      setWorkspaceTitle(formatWorkspaceNameForUI(data.name));
      setMyRole(data.myRole ?? null);
    } catch {
      setWorkspaceTitle(`Workspace ${workspaceId}`);
      setMyRole(null);
    }
  }, [accessToken, workspaceId]);

  const loadBoards = useCallback(async () => {
    if (!accessToken) {
      setBoards([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const data = await api<BoardRow[]>(
        `/board/workspace/${workspaceId}/boards`,
        { method: 'GET', accessToken },
      );
      setBoards(Array.isArray(data) ? data : []);
    } catch (e) {
      setMsg(formatError(e));
      setBoards([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId]);

  useEffect(() => {
    void loadWorkspaceLabel();
  }, [loadWorkspaceLabel]);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  async function submitCreate() {
    if (!accessToken) return;
    const name = createName.trim();
    if (name.length < 3) return;
    const position = nextBoardPosition(boards);
    setCreateBusy(true);
    setMsg(null);
    try {
      await api(`/board/workspace/${workspaceId}/boards`, {
        method: 'POST',
        accessToken,
        json: { name, position },
      });
      setCreateOpen(false);
      setCreateName('');
      await loadBoards();
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
      await api(`/board/workspace/${workspaceId}/boards/${editBoard.id}`, {
        method: 'PATCH',
        accessToken,
        json: { name },
      });
      setEditBoard(null);
      await loadBoards();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setEditBusy(false);
    }
  }

  async function submitDeleteBoard() {
    if (!accessToken || !boardToDelete) return;
    setDeleteBoardBusy(true);
    setMsg(null);
    try {
      await api(`/board/workspace/${workspaceId}/boards/${boardToDelete.id}`, {
        method: 'DELETE',
        accessToken,
      });
      setBoardToDelete(null);
      setEditBoard(null);
      await loadBoards();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setDeleteBoardBusy(false);
    }
  }

  return (
    <div className="trello-app-shell">
      <div className="trello-boards-main">
        <header className="trello-boards-topbar trello-topbar-stripe-3col">
          <div className="trello-topbar-stripe-left trello-topbar-stripe-left--boards-nav">
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
              className="trello-btn trello-btn-topbar-nav trello-topbar-back-btn"
              onClick={() => navigate('/workspaces')}
            >
              ← Рабочие пространства
            </button>
          </div>
          <h1 className="trello-topbar-stripe-center">{workspaceTitle || '…'}</h1>
          <div className="trello-topbar-stripe-spacer" aria-hidden />
        </header>

        {!accessToken && (
          <div className="trello-banner trello-banner-warn">
            Войдите на главной, чтобы видеть доски.
            <button type="button" className="trello-inline-link" onClick={() => navigate('/')}>
              Войти
            </button>
          </div>
        )}

        {msg && <div className="trello-banner trello-banner-error">{msg}</div>}

        {loading ? (
          <div className="trello-empty">Загрузка досок…</div>
        ) : (
          <div className="trello-boards-grid">
            {boards.map((b, i) => (
              <div
                key={b.id}
                className="trello-board-tile"
                style={{ background: TILE_GRADIENTS[i % TILE_GRADIENTS.length] }}
                onClick={() => navigate(`/workspaces/${workspaceId}/boards/${b.id}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/workspaces/${workspaceId}/boards/${b.id}`);
                  }
                }}
              >
                {canManageWorkspace(myRole) ? (
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
                <span className="trello-board-tile-name">{b.name}</span>
              </div>
            ))}
            {accessToken && (
              <button
                type="button"
                className="trello-board-tile trello-board-tile-add"
                onClick={() => {
                  setCreateOpen(true);
                  setMsg(null);
                }}
              >
                <span className="trello-board-tile-add-icon">+</span>
                <span>Создать доску</span>
              </button>
            )}
          </div>
        )}
      </div>

      {createOpen && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !createBusy && setCreateOpen(false)}
        >
          <div
            className="trello-modal"
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
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={createName.trim().length < 3 || createBusy}
                onClick={() => void submitCreate()}
              >
                {createBusy ? 'Создание…' : 'Создать'}
              </button>
            </div>
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
            className="trello-modal"
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
              <div className="trello-modal-foot-actions">
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost"
                  onClick={() => !editBusy && setEditBoard(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="trello-btn trello-btn-primary"
                  disabled={editName.trim().length < 3 || editBusy}
                  onClick={() => void submitEditBoard()}
                >
                  {editBusy ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </div>
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
