import { useState } from 'react';
import { api, formatApiError } from '@shared/api';
import {
  LIST_COLOR_LABELS,
  LIST_COLOR_PRESET_KEYS,
  listHeaderColor,
} from '@entities/board';
import type { WorkspaceLabelRow } from '@features/board/lib/boardCardFilters';

type Props = {
  open: boolean;
  accessToken: string;
  workspaceId: number;
  labels: WorkspaceLabelRow[];
  canManage: boolean;
  onClose: () => void;
  onLabelsChange: () => void;
};

export function WorkspaceLabelsModal({
  open,
  accessToken,
  workspaceId,
  labels,
  canManage,
  onClose,
  onLabelsChange,
}: Props) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<string>('GREEN');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('GREEN');

  if (!open) return null;

  async function createLabel() {
    const trimmed = name.trim();
    if (trimmed.length < 1) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/workspace/${workspaceId}/labels`, {
        method: 'POST',
        accessToken,
        json: { name: trimmed, colorPreset: color },
      });
      setName('');
      onLabelsChange();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function saveEdit(labelId: number) {
    const trimmed = editName.trim();
    if (trimmed.length < 1) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/workspace/${workspaceId}/labels/${labelId}`, {
        method: 'PATCH',
        accessToken,
        json: { name: trimmed, colorPreset: editColor },
      });
      setEditingId(null);
      onLabelsChange();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function deleteLabel(labelId: number) {
    setBusy(true);
    setError(null);
    try {
      await api(`/workspace/${workspaceId}/labels/${labelId}`, {
        method: 'DELETE',
        accessToken,
      });
      if (editingId === labelId) setEditingId(null);
      onLabelsChange();
    } catch (e) {
      setError(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="trello-modal-backdrop" role="presentation" onClick={() => !busy && onClose()}>
      <div
        className="trello-modal trello-modal--board-form trello-labels-modal"
        role="dialog"
        aria-modal
        aria-label="Метки рабочего пространства"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trello-modal-head">
          <h2 className="trello-modal-title">Метки воркспейса</h2>
          <button type="button" className="trello-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <div className="trello-modal-body">
          {error ? <p className="trello-banner trello-banner-error">{error}</p> : null}

          {canManage && (
            <form
              className="trello-labels-create"
              onSubmit={(e) => {
                e.preventDefault();
                if (!busy && name.trim().length >= 1) void createLabel();
              }}
            >
              <input
                className="trello-input"
                placeholder="Название метки"
                value={name}
                maxLength={24}
                onChange={(e) => setName(e.target.value)}
              />
              <select
                className="trello-input"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                {LIST_COLOR_PRESET_KEYS.map((key) => (
                  <option key={key} value={key}>
                    {LIST_COLOR_LABELS[key]}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                className="trello-btn trello-btn-primary trello-btn-sm"
                disabled={busy || name.trim().length < 1}
              >
                Добавить
              </button>
            </form>
          )}

          {labels.length === 0 ? (
            <p className="trello-settings-card-hint">Меток пока нет.</p>
          ) : (
            <ul className="trello-labels-list">
              {labels.map((l) => (
                <li key={l.id} className="trello-labels-list-item">
                  {editingId === l.id ? (
                    <form
                      className="trello-labels-edit-row"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!busy) void saveEdit(l.id);
                      }}
                    >
                      <input
                        className="trello-input"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        maxLength={24}
                      />
                      <select
                        className="trello-input"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                      >
                        {LIST_COLOR_PRESET_KEYS.map((key) => (
                          <option key={key} value={key}>
                            {LIST_COLOR_LABELS[key]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        className="trello-btn trello-btn-primary trello-btn-sm"
                        disabled={busy}
                      >
                        OK
                      </button>
                      <button
                        type="button"
                        className="trello-btn trello-btn-ghost trello-btn-sm"
                        onClick={() => setEditingId(null)}
                      >
                        Отмена
                      </button>
                    </form>
                  ) : (
                    <>
                      <span
                        className="trello-labels-list-swatch"
                        style={{ backgroundColor: listHeaderColor(l.colorPreset) }}
                      />
                      <span className="trello-labels-list-name">{l.name}</span>
                      {canManage && (
                        <span className="trello-labels-list-actions">
                          <button
                            type="button"
                            className="trello-btn trello-btn-ghost trello-btn-sm"
                            onClick={() => {
                              setEditingId(l.id);
                              setEditName(l.name);
                              setEditColor(l.colorPreset);
                            }}
                          >
                            Изменить
                          </button>
                          <button
                            type="button"
                            className="trello-btn trello-btn-danger-ghost trello-btn-sm"
                            disabled={busy}
                            onClick={() => void deleteLabel(l.id)}
                          >
                            Удалить
                          </button>
                        </span>
                      )}
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="trello-modal-foot">
          <button type="button" className="trello-btn trello-btn-ghost" onClick={onClose}>
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}
