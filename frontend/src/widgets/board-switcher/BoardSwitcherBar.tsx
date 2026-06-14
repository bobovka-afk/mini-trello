import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { api } from '@shared/api';
import { handleSpaTileAuxClick, navigate } from '@shared/lib/navigation-core';

type BoardRow = {
  id: number;
  workspaceId: number;
  name: string;
};

type Props = {
  accessToken: string;
  workspaceId: number;
  currentBoardId: number;
};

const TILE_VARIANTS = ['trello-board-picker-tile--1', 'trello-board-picker-tile--2', 'trello-board-picker-tile--3'] as const;
const OUTSIDE_CLICK_GUARD_MS = 320;

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function BoardNavIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="1.5" y="2.5" width="3.5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
      <rect x="6.25" y="2.5" width="3.5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
      <rect x="11" y="2.5" width="3.5" height="11" rx="0.75" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

function SwitchBoardsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden>
      <rect x="2" y="3" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.25" />
      <rect x="5" y="7" width="9" height="6" rx="1" stroke="currentColor" strokeWidth="1.25" />
    </svg>
  );
}

export function BoardSwitcherBar({ accessToken, workspaceId, currentBoardId }: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [boards, setBoards] = useState<BoardRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const switchBtnRef = useRef<HTMLButtonElement>(null);
  const ignoreOutsideUntilRef = useRef(0);

  const closePicker = useCallback(() => {
    setPickerOpen(false);
    setQuery('');
  }, []);

  const loadBoards = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) {
      setLoading(true);
    }
    try {
      const data = await api<BoardRow[]>(`/workspace/${workspaceId}/boards`, {
        method: 'GET',
        accessToken,
      });
      setBoards(Array.isArray(data) ? data : []);
    } catch {
      if (!silent) {
        setBoards([]);
      }
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [accessToken, workspaceId]);

  const openPicker = useCallback(() => {
    ignoreOutsideUntilRef.current = performance.now() + OUTSIDE_CLICK_GUARD_MS;
    setPickerOpen(true);
  }, []);

  useEffect(() => {
    void loadBoards({ silent: true });
  }, [loadBoards]);

  useEffect(() => {
    if (!pickerOpen) return;
    void loadBoards({ silent: true });
    const focusId = window.setTimeout(() => searchRef.current?.focus(), 60);
    return () => window.clearTimeout(focusId);
  }, [pickerOpen, loadBoards]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePicker();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [pickerOpen, closePicker]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (performance.now() < ignoreOutsideUntilRef.current) return;
      const target = e.target as Node;
      if (pickerRef.current?.contains(target)) return;
      if (switchBtnRef.current?.contains(target)) return;
      closePicker();
    };
    const id = window.setTimeout(() => {
      document.addEventListener('pointerdown', onPointerDown, true);
    }, 0);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [pickerOpen, closePicker]);

  const filteredBoards = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return boards;
    return boards.filter(b => b.name.toLowerCase().includes(q));
  }, [boards, query]);

  const openBoard = (boardId: number) => {
    if (boardId === currentBoardId) {
      closePicker();
      return;
    }
    closePicker();
    navigate(`/workspaces/${workspaceId}/boards/${boardId}`);
  };

  const handleSwitchClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    if (pickerOpen) {
      closePicker();
      return;
    }
    openPicker();
  };

  const pickerPortal =
    pickerOpen &&
    createPortal(
      <>
        <div className="trello-board-picker-backdrop" aria-hidden />
        <div
          ref={pickerRef}
          className="trello-board-picker"
          role="dialog"
          aria-modal
          aria-label="Выбор доски"
          onPointerDown={e => e.stopPropagation()}
        >
          <div className="trello-board-picker-search-wrap">
            <SearchIcon className="trello-board-picker-search-icon" />
            <input
              ref={searchRef}
              type="search"
              className="trello-board-picker-search"
              placeholder="Поиск досок"
              value={query}
              onChange={e => setQuery(e.target.value)}
              aria-label="Поиск досок"
            />
          </div>
          <div className="trello-board-picker-body">
            <h2 className="trello-board-picker-heading">Мои доски</h2>
            {loading && boards.length === 0 ? (
              <p className="trello-board-picker-status">Загрузка…</p>
            ) : filteredBoards.length === 0 ? (
              <p className="trello-board-picker-status">
                {query.trim() ? 'Ничего не найдено' : 'Нет досок'}
              </p>
            ) : (
              <div className="trello-board-picker-grid">
                {filteredBoards.map((b, i) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`trello-board-picker-tile ${TILE_VARIANTS[i % TILE_VARIANTS.length]}${b.id === currentBoardId ? ' trello-board-picker-tile--current' : ''}`}
                    onClick={() => openBoard(b.id)}
                    onAuxClick={e => {
                      handleSpaTileAuxClick(e, `/workspaces/${workspaceId}/boards/${b.id}`);
                      closePicker();
                    }}
                  >
                    <span className="trello-board-picker-tile-cover" aria-hidden />
                    <span className="trello-board-picker-tile-name">{b.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </>,
      document.body,
    );

  return (
    <>
      {pickerPortal}

      <nav className="trello-board-switcher-bar" aria-label="Навигация по доскам">
        <div className="trello-board-switcher-item trello-board-switcher-item--active">
          <BoardNavIcon className="trello-board-switcher-icon" />
          <span>Доска</span>
          <span className="trello-board-switcher-indicator" aria-hidden />
        </div>
        <div className="trello-board-switcher-sep" aria-hidden />
        <button
          ref={switchBtnRef}
          type="button"
          className={`trello-board-switcher-item${pickerOpen ? ' trello-board-switcher-item--open' : ''}`}
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          onPointerDown={e => e.stopPropagation()}
          onClick={handleSwitchClick}
        >
          <SwitchBoardsIcon className="trello-board-switcher-icon" />
          <span>Выбрать другую доску</span>
        </button>
      </nav>
    </>
  );
}
