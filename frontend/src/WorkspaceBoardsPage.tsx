import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';

export type BoardRow = {
  id: number;
  workspaceId: number;
  name: string;
  description: string | null;
  position: number;
  createdAt: string;
  updatedAt: string;
};

type WorkspaceMemberRow = {
  id: number;
  workspaceId: number;
  workspace: { id: number; name: string };
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

const TILE_GRADIENTS = [
  'linear-gradient(135deg, #0079bf 0%, #5067c5 100%)',
  'linear-gradient(135deg, #d29034 0%, #cd5a91 100%)',
  'linear-gradient(135deg, #61bd4f 0%, #0079bf 100%)',
  'linear-gradient(135deg, #b04632 0%, #89609e 100%)',
  'linear-gradient(135deg, #89609e 0%, #cd5a91 100%)',
];

export function WorkspaceBoardsPage({ accessToken, workspaceId }: Props) {
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [workspaceTitle, setWorkspaceTitle] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);
  const [editBoard, setEditBoard] = useState<BoardRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const loadWorkspaceLabel = useCallback(async () => {
    if (!accessToken) return;
    try {
      const rows = await api<WorkspaceMemberRow[]>('/workspace/get-user-workspaces', {
        method: 'GET',
        accessToken,
      });
      const row = Array.isArray(rows)
        ? rows.find((r) => r.workspace.id === workspaceId)
        : undefined;
      if (row) {
        setWorkspaceTitle(formatWorkspaceNameForUI(row.workspace.name));
      } else {
        setWorkspaceTitle(`Workspace ${workspaceId}`);
      }
    } catch {
      setWorkspaceTitle(`Workspace ${workspaceId}`);
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
    setCreateBusy(true);
    setMsg(null);
    try {
      await api(`/board/workspace/${workspaceId}/boards`, {
        method: 'POST',
        accessToken,
        json: { name },
      });
      setCreateOpen(false);
      setCreateName('');
      await loadBoards();
    } catch (e) {
      setMsg(formatError(e));
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
            <button
              type="button"
              className="trello-btn trello-btn-primary trello-btn-sm"
              onClick={() => navigate('/workspaces')}
            >
              ← Рабочие пространства
            </button>
            <h1 className="trello-boards-title trello-boards-title-offset">{workspaceTitle || '…'}</h1>
            <p className="trello-boards-sub trello-boards-sub-hero">Ваши доски в этом рабочем пространстве</p>
          </div>
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
            <div className="trello-modal-foot">
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
      )}
    </div>
  );
}
