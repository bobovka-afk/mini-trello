import { useEffect, useRef, useState } from 'react';
import type { BoardCardFilter, WorkspaceLabelRow } from '@features/board/lib/boardCardFilters';
import { MoreHorizontalIcon } from '@shared/ui/icons/MoreHorizontalIcon';

const FILTER_OPTIONS: { key: BoardCardFilter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'mine', label: 'Мои' },
  { key: 'overdue', label: 'Просрочено' },
  { key: 'unassigned', label: 'Без исполнителя' },
];

type Props = {
  boardFilter: BoardCardFilter;
  onBoardFilterChange: (filter: BoardCardFilter) => void;
  wsLabels: WorkspaceLabelRow[];
  labelFilterId: number | null;
  onLabelFilterChange: (labelId: number | null) => void;
  onSearch: () => void;
  onLabels: () => void;
  onArchivedLists: () => void;
  canArchiveLists: boolean;
};
export function BoardTopbarMenu({
  boardFilter,
  onBoardFilterChange,
  wsLabels,
  labelFilterId,
  onLabelFilterChange,
  onSearch,
  onLabels,
  onArchivedLists,
  canArchiveLists,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function runAction(fn: () => void) {
    setOpen(false);
    fn();
  }

  return (
    <div className="trello-board-topbar-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="trello-board-topbar-menu-btn"
        aria-label="Меню доски"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(v => !v)}
      >
        <MoreHorizontalIcon className="trello-board-topbar-menu-icon" />
      </button>
      {open ? (
        <div className="trello-board-topbar-menu" role="menu" aria-label="Фильтры и действия доски">
          <p className="trello-board-topbar-menu-heading">Фильтр карточек</p>
          {FILTER_OPTIONS.map(opt => (
            <button
              key={opt.key}
              type="button"
              role="menuitemradio"
              aria-checked={boardFilter === opt.key}
              className={
                boardFilter === opt.key
                  ? 'trello-board-topbar-menu-item trello-board-topbar-menu-item--active'
                  : 'trello-board-topbar-menu-item'
              }
              onClick={() => {
                onBoardFilterChange(opt.key);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
          {wsLabels.length > 0 ? (
            <div className="trello-board-topbar-menu-select-wrap">
              <label className="trello-board-topbar-menu-select-label" htmlFor="board-menu-label-filter">
                Метка
              </label>
              <select
                id="board-menu-label-filter"
                className="trello-input trello-board-topbar-menu-select"
                value={labelFilterId ?? ''}
                onChange={e =>
                  onLabelFilterChange(e.target.value === '' ? null : Number(e.target.value))
                }
              >
                <option value="">Все метки</option>
                {wsLabels.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="trello-board-topbar-menu-divider" role="separator" />
          <button
            type="button"
            role="menuitem"
            className="trello-board-topbar-menu-item"
            onClick={() => runAction(onSearch)}
          >
            Поиск
          </button>
          <button
            type="button"
            role="menuitem"
            className="trello-board-topbar-menu-item"
            onClick={() => runAction(onLabels)}
          >
            Метки
          </button>
          {canArchiveLists ? (
            <button
              type="button"
              role="menuitem"
              className="trello-board-topbar-menu-item"
              onClick={() => runAction(onArchivedLists)}
            >
              Архив колонок
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
