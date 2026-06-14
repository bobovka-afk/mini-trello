import { useMemo, useState } from 'react';
import { api, formatApiError } from '@shared/api';
import { AlertModal } from '@shared/ui/alert-modal/AlertModal';
import {
  CHARACTER_ROLES,
  type CharacterDto,
  type CharacterRole,
  type GenderCharacter,
  characterPortraitUrl,
  presetForRole,
  ROLE_LABEL_RU,
} from '@entities/character';

type Props = {
  accessToken: string;
  onCreated: (character: CharacterDto) => void;
  submitLabel?: string;
};

export function CharacterCreateForm(props: Props) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderCharacter>('MALE');
  const [role, setRole] = useState<CharacterRole>('DRUID');
  const [busy, setBusy] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState<string | null>(null);

  const avatarPreset = useMemo(() => presetForRole(gender, role), [gender, role]);

  async function submit() {
    setErrorModalMessage(null);
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      setErrorModalMessage('Имя персонажа: от 3 до 40 символов.');
      return;
    }
    setBusy(true);
    try {
      const created = await api<CharacterDto>('/character', {
        method: 'POST',
        accessToken: props.accessToken,
        json: {
          name: trimmed,
          gender,
          avatarPreset,
        },
      });
      props.onCreated(created);
    } catch (e) {
      setErrorModalMessage(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <form
        className="trello-character-setup"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
      >
        <label className="trello-field">
          <span className="trello-label">Имя персонажа</span>
          <input
            className="trello-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoComplete="off"
          />
        </label>

        <div className="trello-character-gender-row">
          <span className="trello-label">Пол</span>
          <div className="trello-character-gender-toggle trello-character-gender-toggle--full">
            <button
              type="button"
              className={
                gender === 'MALE'
                  ? 'trello-btn trello-btn-primary trello-btn-sm'
                  : 'trello-btn trello-btn-ghost trello-btn-sm'
              }
              onClick={() => setGender('MALE')}
            >
              Мужской
            </button>
            <button
              type="button"
              className={
                gender === 'FEMALE'
                  ? 'trello-btn trello-btn-primary trello-btn-sm'
                  : 'trello-btn trello-btn-ghost trello-btn-sm'
              }
              onClick={() => setGender('FEMALE')}
            >
              Женский
            </button>
          </div>
        </div>

        <div className="trello-character-avatar-block trello-character-avatar-block--no-label">
          <div className="trello-character-avatar-grid">
            {CHARACTER_ROLES.map((r) => {
              const p = presetForRole(gender, r);
              const selected = r === role;
              return (
                <button
                  key={r}
                  type="button"
                  className={
                    selected
                      ? 'trello-character-avatar-card trello-character-avatar-card--selected'
                      : 'trello-character-avatar-card'
                  }
                  onClick={() => setRole(r)}
                  aria-pressed={selected}
                >
                  <img
                    src={characterPortraitUrl(p)}
                    alt=""
                    className="trello-character-avatar-img"
                    loading="lazy"
                  />
                  <span className="trello-character-avatar-label">{ROLE_LABEL_RU[r]}</span>
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          className="trello-btn trello-btn-primary trello-character-submit-full"
          disabled={busy}
        >
          {busy ? 'Создаём…' : (props.submitLabel ?? 'Создать персонажа')}
        </button>
      </form>
      <AlertModal
        open={errorModalMessage != null}
        title="Ошибка"
        message={errorModalMessage ?? ''}
        onClose={() => setErrorModalMessage(null)}
      />
    </>
  );
}
