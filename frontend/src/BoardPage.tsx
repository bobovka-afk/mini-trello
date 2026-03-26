import { useCallback, useEffect, useState } from 'react';
import { api, type ApiError } from './lib/api';
import type { BoardRow } from './WorkspaceBoardsPage';
import { LIST_COLOR_PRESET_KEYS, listHeaderColor } from './lib/trelloColors';

type ListRow = {
  id: number;
  boardId: number;
  name: string;
  position: number;
  colorPreset: string;
  createdAt: string;
  updatedAt: string;
};

type Props = {
  accessToken: string | null;
  workspaceId: number;
  boardId: number;
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

export function BoardPage({ accessToken, workspaceId, boardId }: Props) {
  const [board, setBoard] = useState<BoardRow | null>(null);
  const [lists, setLists] = useState<ListRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<string | null>(null);

  const [addListOpen, setAddListOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [addBusy, setAddBusy] = useState(false);

  const [editList, setEditList] = useState<ListRow | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState<string>('GRAY');
  const [editBusy, setEditBusy] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) {
      setBoard(null);
      setLists([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const [b, ls] = await Promise.all([
        api<BoardRow>(`/board/workspace/${workspaceId}/boards/${boardId}`, {
          method: 'GET',
          accessToken,
        }),
        api<ListRow[]>(
          `/list/workspace/${workspaceId}/board/${boardId}/lists`,
          { method: 'GET', accessToken },
        ),
      ]);
      setBoard(b);
      setLists(Array.isArray(ls) ? ls : []);
    } catch (e) {
      setMsg(formatError(e));
      setBoard(null);
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, workspaceId, boardId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function submitAddList() {
    if (!accessToken) return;
    const name = newListName.trim();
    if (name.length < 3) return;
    setAddBusy(true);
    setMsg(null);
    try {
      await api(`/list/workspace/${workspaceId}/board/${boardId}/lists`, {
        method: 'POST',
        accessToken,
        json: { name },
      });
      setNewListName('');
      setAddListOpen(false);
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setAddBusy(false);
    }
  }

  function openEditList(list: ListRow) {
    setEditList(list);
    setEditName(list.name);
    setEditColor(list.colorPreset || 'GRAY');
    setMsg(null);
  }

  async function submitEditList() {
    if (!accessToken || !editList) return;
    const name = editName.trim();
    if (name.length < 3) return;
    setEditBusy(true);
    setMsg(null);
    try {
      await api(
        `/list/workspace/${workspaceId}/board/${boardId}/lists/${editList.id}`,
        {
          method: 'PATCH',
          accessToken,
          json: {
            name,
            colorPreset: editColor,
          },
        },
      );
      setEditList(null);
      await load();
    } catch (e) {
      setMsg(formatError(e));
    } finally {
      setEditBusy(false);
    }
  }

  return (
    <div className="trello-board-viewport">
      <header className="trello-board-topbar">
        <button type="button" className="trello-top-left-brand" onClick={() => navigate('/workspaces')}>
          <span className="trello-logo" aria-hidden />
          <span className="trello-top-left-brand-text">mini trello</span>
        </button>
        <button
          type="button"
          className="trello-board-topbar-back"
          onClick={() => navigate(`/workspaces/${workspaceId}/boards`)}
        >
          ← Назад
        </button>
        <h1 className="trello-board-topbar-title">
          {loading ? '…' : board?.name ?? 'Доска'}
        </h1>
        <div className="trello-board-topbar-spacer" />
      </header>

      {!accessToken && (
        <div className="trello-board-banner">
          Нужен вход.{' '}
          <button type="button" className="trello-board-banner-link" onClick={() => navigate('/')}>
            На главную
          </button>
        </div>
      )}

      {msg && <div className="trello-board-banner trello-board-banner-error">{msg}</div>}

      <div className="trello-board-lists-scroll">
        {loading ? (
          <div className="trello-board-loading">Загрузка…</div>
        ) : (
          <>
            {lists.map((list) => (
              <div key={list.id} className="trello-list-wrap">
                <div
                  className="trello-list-header"
                  style={{ backgroundColor: listHeaderColor(list.colorPreset) }}
                >
                  <div className="trello-list-header-row">
                    <span className="trello-list-header-title">{list.name}</span>
                    {accessToken && (
                      <button
                        type="button"
                        className="trello-list-header-edit"
                        title="Редактировать колонку"
                        onClick={() => openEditList(list)}
                      >
                        ⋯
                      </button>
                    )}
                  </div>
                </div>
                <div className="trello-list-body">
                  <div className="trello-list-placeholder">Перетаскивание карточек — позже</div>
                </div>
              </div>
            ))}

            {accessToken && (
              <div className="trello-list-wrap trello-add-list-wrap">
                {!addListOpen ? (
                  <button
                    type="button"
                    className="trello-add-list-btn"
                    onClick={() => setAddListOpen(true)}
                  >
                    + Добавить колонку
                  </button>
                ) : (
                  <div className="trello-add-list-form">
                    <input
                      className="trello-input trello-input-dark"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      maxLength={50}
                      autoFocus
                    />
                    <div className="trello-add-list-actions">
                      <button
                        type="button"
                        className="trello-btn trello-btn-primary trello-btn-sm"
                        disabled={newListName.trim().length < 3 || addBusy}
                        onClick={() => void submitAddList()}
                      >
                        {addBusy ? '…' : 'Добавить'}
                      </button>
                      <button
                        type="button"
                        className="trello-btn trello-btn-ghost trello-btn-sm"
                        disabled={addBusy}
                        onClick={() => {
                          setAddListOpen(false);
                          setNewListName('');
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {editList && (
        <div
          className="trello-modal-backdrop"
          role="presentation"
          onClick={() => !editBusy && setEditList(null)}
        >
          <div
            className="trello-modal"
            role="dialog"
            aria-modal
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 className="trello-modal-title">Колонка</h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !editBusy && setEditList(null)}
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
                />
              </label>
              <label className="trello-field">
                <span className="trello-label">Цвет</span>
                <div className="trello-color-grid" role="listbox" aria-label="Цвет колонки">
                  {LIST_COLOR_PRESET_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={
                        key === editColor
                          ? 'trello-color-swatch trello-color-swatch-active'
                          : 'trello-color-swatch'
                      }
                      style={{ backgroundColor: listHeaderColor(key) }}
                      aria-label={key}
                      aria-selected={key === editColor}
                      onClick={() => setEditColor(key)}
                    />
                  ))}
                </div>
              </label>
            </div>
            <div className="trello-modal-foot">
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                onClick={() => !editBusy && setEditList(null)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-primary"
                disabled={editName.trim().length < 3 || editBusy}
                onClick={() => void submitEditList()}
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
