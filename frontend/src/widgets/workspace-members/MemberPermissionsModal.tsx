import { useState } from 'react';
import { ModalForm } from '@shared/ui/modal-form';
import type { WorkspacePermissions } from '@entities/workspace/lib/permissions';

const LABELS: { key: keyof WorkspacePermissions; label: string; hint: string }[] = [
  { key: 'inviteMembers', label: 'Приглашать участников', hint: 'Отправка invite по email' },
  { key: 'manageBoards', label: 'Управление досками', hint: 'Создание, переименование, удаление' },
  { key: 'archiveBoards', label: 'Архив', hint: 'Архивирование досок и списков' },
  { key: 'manageLabels', label: 'Метки', hint: 'Создание меток воркспейса' },
  { key: 'manageMembers', label: 'Участники', hint: 'Права других участников' },
];

type Props = {
  memberName: string;
  permissions: WorkspacePermissions;
  saving: boolean;
  onClose: () => void;
  onSave: (next: WorkspacePermissions) => void;
};

export function MemberPermissionsModal({
  memberName,
  permissions,
  saving,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(permissions);

  return (
    <div className="trello-modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div
        className="trello-modal trello-modal--board-form"
        role="dialog"
        aria-modal
        onClick={(e) => e.stopPropagation()}
      >
        <div className="trello-modal-head">
          <h2 className="trello-modal-title">Права — {memberName}</h2>
          <button type="button" className="trello-modal-close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </div>
        <ModalForm onSubmit={() => onSave(draft)} disabled={saving}>
          <div className="trello-modal-body">
            {LABELS.map(({ key, label, hint }) => (
              <label key={key} className="trello-settings-switch">
                <span>
                  <span className="trello-label">{label}</span>
                  <span className="trello-settings-card-hint">{hint}</span>
                </span>
                <input
                  type="checkbox"
                  checked={draft[key]}
                  disabled={saving}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, [key]: e.target.checked }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="trello-modal-foot">
            <button type="button" className="trello-btn trello-btn-ghost" onClick={onClose} disabled={saving}>
              Отмена
            </button>
            <button
              type="submit"
              className="trello-btn trello-btn-primary"
              disabled={saving}
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </ModalForm>
      </div>
    </div>
  );
}
