import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { api, formatApiError, type ApiError } from '@shared/api';
import { ModalForm } from '@shared/ui/modal-form';
import {
  CHARACTER_ROLES,
  type CharacterDto,
  type CharacterRole,
  type GenderCharacter,
  characterPortraitUrl,
  presetForRole,
  ROLE_LABEL_RU,
} from '@entities/character';
import { getCharacterXpTowardNext } from '@entities/character/lib/level-curve';
import { CheckinStreakProfileRow } from '@widgets/checkin-streak/profile-row/CheckinStreakProfileRow';
import {
  computeStreakProfileFeedback,
  readCharacterStreakSnapshot,
  snapshotFromCharacter,
  writeCharacterStreakSnapshot,
  type StreakProfileFeedback,
} from '@entities/character/lib/characterStreakSnapshot';
import { CharacterCreateForm } from '@features/character-create/ui/CharacterCreateForm';
import { ProfileCharacterQuestsPanel, type ProfileCharacterTabKey } from '@widgets/profile-character-quests/ProfileCharacterQuestsPanel';
import { FriendsPanel } from '@widgets/social-friends/FriendsPanel';
import { MessagesPanel } from '@widgets/social-messages/MessagesPanel';
import { RaidPanel } from '@widgets/party-raid/RaidPanel';
import { usePartyInviteCount } from '@entities/party';
import { useSocialInboxSummary, type SocialUserSummary } from '@entities/social';
import { CharacterPortraitWithFrame } from '@widgets/character-portrait/CharacterPortraitWithFrame';
import { CharacterStatsPanel } from '@widgets/character-stats/CharacterStatsPanel';

type Props = {
  accessToken: string;
  onCharacterUpdated?: (c: CharacterDto) => void;
};

function roleFromPreset(preset: string): CharacterRole {
  const base = preset.replace(/_MAN$|_WOMAN$/i, '').replace(/^QUEST_/, '').toUpperCase();
  return (CHARACTER_ROLES as readonly string[]).includes(base)
    ? (base as CharacterRole)
    : 'DRUID';
}

type PanelTabKey = ProfileCharacterTabKey | 'friends' | 'messages' | 'raid';

const PANEL_TAB_KEYS: PanelTabKey[] = [
  'quests',
  'friends',
  'messages',
  'raid',
  'inventory',
  'shop',
  'achievements',
  'rules',
];

function isPanelTabKey(value: string): value is PanelTabKey {
  return (PANEL_TAB_KEYS as readonly string[]).includes(value);
}

function readInitialPanelTab(): PanelTabKey {
  if (typeof window === 'undefined') return 'quests';
  const params = new URLSearchParams(window.location.search);
  const withUser = params.get('with');
  if (withUser && /^\d+$/.test(withUser)) return 'messages';
  const partyRaid = params.get('partyRaid');
  if (partyRaid && /^\d+$/.test(partyRaid)) return 'raid';
  const tab = params.get('tab');
  if (tab && isPanelTabKey(tab)) return tab;
  return 'quests';
}

function readInitialMessagePeerUserId(): number | null {
  if (typeof window === 'undefined') return null;
  const withUser = new URLSearchParams(window.location.search).get('with');
  if (withUser && /^\d+$/.test(withUser)) return Number(withUser);
  return null;
}

function syncProfileCharacterTabUrl(tab: PanelTabKey, peerUserId?: number | null) {
  const params = new URLSearchParams(window.location.search);
  params.delete('partyRaid');
  if (tab === 'quests') {
    params.delete('tab');
  } else {
    params.set('tab', tab);
  }
  if (tab === 'messages' && peerUserId != null) {
    params.set('with', String(peerUserId));
  } else {
    params.delete('with');
  }
  const qs = params.toString();
  window.history.replaceState(
    null,
    '',
    `${window.location.pathname}${qs ? `?${qs}` : ''}`,
  );
}

function buildPanelTabs(
  activePanelTab: PanelTabKey,
  inboxSummary: { incomingFriendRequests: number; unreadMessages: number },
  pendingRaidInvites: number,
): { key: PanelTabKey; label: string; badge: number }[] {
  return [
    { key: 'quests', label: 'Задания', badge: 0 },
    {
      key: 'friends',
      label: 'Друзья',
      badge: activePanelTab === 'friends' ? 0 : inboxSummary.incomingFriendRequests,
    },
    {
      key: 'messages',
      label: 'Сообщения',
      badge: inboxSummary.unreadMessages,
    },
    { key: 'raid', label: 'Рейд', badge: pendingRaidInvites },
    { key: 'inventory', label: 'Хранилище', badge: 0 },
    { key: 'shop', label: 'Магазин', badge: 0 },
    { key: 'achievements', label: 'Достижения', badge: 0 },
    { key: 'rules', label: 'Правила', badge: 0 },
  ];
}

function CharacterPageHeader() {
  return (
    <header className="px-topbar">
      <div className="px-topbar-left">
        <h1 className="px-topbar-title">Персонаж</h1>
      </div>
    </header>
  );
}

export function ProfileCharacterPage(props: Props) {
  const [character, setCharacter] = useState<CharacterDto | null>(null);
  const [loadPhase, setLoadPhase] = useState<'loading' | 'ready' | 'missing' | 'error'>(
    'loading',
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<GenderCharacter>('MALE');
  const [role, setRole] = useState<CharacterRole>('DRUID');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saveCheckVisible, setSaveCheckVisible] = useState(false);
  const [streakAnimateFrom, setStreakAnimateFrom] = useState<number | null>(null);
  const [streakCelebrate, setStreakCelebrate] = useState(false);
  const [streakLostNotice, setStreakLostNotice] = useState<Extract<
    StreakProfileFeedback,
    { kind: 'lost' }
  > | null>(null);

  const [loadKey, setLoadKey] = useState(0);
  const [activePanelTab, setActivePanelTab] = useState<PanelTabKey>(readInitialPanelTab);
  const [tabOpenSignal, setTabOpenSignal] = useState(0);
  const [messagePeerUserId, setMessagePeerUserId] = useState<number | null>(
    readInitialMessagePeerUserId,
  );
  const [messagePeerHint, setMessagePeerHint] = useState<SocialUserSummary | null>(null);

  const { summary: inboxSummary, refresh: refreshInbox } = useSocialInboxSummary(
    props.accessToken,
    loadPhase === 'ready',
  );

  const { count: pendingRaidInvites, refresh: refreshPartyInvites } = usePartyInviteCount(
    props.accessToken,
    loadPhase === 'ready',
  );

  const [partyInviteToast, setPartyInviteToast] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const partyRaid = params.get('partyRaid');
    if (partyRaid && /^\d+$/.test(partyRaid)) {
      setPartyInviteToast('Приглашение в рейд — откройте вкладку «Рейд» и примите или отклоните.');
      void refreshPartyInvites();
      params.delete('partyRaid');
      if (!params.get('tab')) {
        params.set('tab', 'raid');
      }
      const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState(null, '', next);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoadPhase('loading');
      setLoadError(null);
      try {
        const c = await api<CharacterDto>('/character/me', {
          method: 'GET',
          accessToken: props.accessToken,
        });
        if (cancelled) return;
        setCharacter(c);
        setName(c.name);
        setGender(c.gender);
        setRole(roleFromPreset(c.avatarPreset));
        setLoadPhase('ready');
      } catch (e) {
        if (cancelled) return;
        const err = e as ApiError;
        if (
          err.status === 404 &&
          (!err.code || err.code === 'CHARACTER_NOT_FOUND')
        ) {
          setCharacter(null);
          setLoadPhase('missing');
          return;
        }
        setLoadPhase('error');
        setLoadError(formatApiError(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [props.accessToken, loadKey]);

  useEffect(() => {
    if (!saveCheckVisible) return;
    const id = window.setTimeout(() => setSaveCheckVisible(false), 1000);
    return () => window.clearTimeout(id);
  }, [saveCheckVisible]);

  useEffect(() => {
    if (!character) return;

    const current = snapshotFromCharacter(character);
    const previous = readCharacterStreakSnapshot(character.userId);
    const feedback = computeStreakProfileFeedback(previous, current);

    setStreakLostNotice(null);
    setStreakAnimateFrom(null);
    setStreakCelebrate(false);

    if (feedback?.kind === 'increased') {
      setStreakAnimateFrom(feedback.from);
      setStreakCelebrate(true);
      const timer = window.setTimeout(() => setStreakCelebrate(false), 720);
      writeCharacterStreakSnapshot(character.userId, current);
      return () => window.clearTimeout(timer);
    }

    if (feedback?.kind === 'lost') {
      setStreakLostNotice(feedback);
    }

    writeCharacterStreakSnapshot(character.userId, current);
  }, [character, character?.userId, character?.checkinStreak, character?.lastCheckinDayKey]);

  useEffect(() => {
    if (!character) return;
    setName(character.name);
    setGender(character.gender);
    setRole(roleFromPreset(character.avatarPreset));
  }, [character]);

  const avatarPreset = useMemo(() => presetForRole(gender, role), [gender, role]);

  const xpToward = useMemo(() => {
    if (!character) {
      return { atMaxLevel: false, into: 0, needed: 0, pct: 0 } as const;
    }
    return getCharacterXpTowardNext(character.level, character.currentXp);
  }, [character]);

  const panelTabs = useMemo(
    () => buildPanelTabs(activePanelTab, inboxSummary, pendingRaidInvites),
    [activePanelTab, inboxSummary, pendingRaidInvites],
  );

  const onCharacterUpdatedRef = useRef(props.onCharacterUpdated);
  onCharacterUpdatedRef.current = props.onCharacterUpdated;

  const refreshCharacter = useCallback(async () => {
    const c = await api<CharacterDto>('/character/me', {
      method: 'GET',
      accessToken: props.accessToken,
    });
    setCharacter(c);
    onCharacterUpdatedRef.current?.(c);
  }, [props.accessToken]);

  const characterPortrait = useMemo(
    () =>
      character
        ? {
            avatarPreset: character.avatarPreset,
            frameKey: character.equippedPortraitFrameKey,
            profileBackgroundKey: character.equippedProfileBackgroundKey,
          }
        : undefined,
    [
      character?.avatarPreset,
      character?.equippedPortraitFrameKey,
      character?.equippedProfileBackgroundKey,
    ],
  );

  function selectPanelTab(nextTab: PanelTabKey) {
    if (activePanelTab === nextTab) {
      setTabOpenSignal((prev) => prev + 1);
      return;
    }
    setActivePanelTab(nextTab);
    setTabOpenSignal((prev) => prev + 1);
    syncProfileCharacterTabUrl(nextTab, nextTab === 'messages' ? messagePeerUserId : null);
    void refreshInbox();
    if (nextTab === 'raid') {
      void refreshPartyInvites();
    }
  }

  function renderPanelContent() {
    if (!character) return null;
    if (activePanelTab === 'friends') {
      return (
        <FriendsPanel
          accessToken={props.accessToken}
          onInboxChange={refreshInbox}
          onMessagePeer={(user) => {
            setMessagePeerUserId(user.userId);
            setMessagePeerHint(user);
            setActivePanelTab('messages');
            syncProfileCharacterTabUrl('messages', user.userId);
            refreshInbox();
          }}
        />
      );
    }
    if (activePanelTab === 'messages') {
      return (
        <MessagesPanel
          accessToken={props.accessToken}
          currentUserId={character.userId}
          initialPeerUserId={messagePeerUserId}
          initialPeer={messagePeerHint}
          visible={activePanelTab === 'messages'}
          onInboxChange={refreshInbox}
        />
      );
    }
    if (activePanelTab === 'raid') {
      return (
        <RaidPanel
          accessToken={props.accessToken}
          currentUserId={character.userId}
          leaderUser={{
            userId: character.userId,
            name: character.name,
            avatarPath: null,
            characterName: character.name,
            characterAvatarPreset: character.avatarPreset,
            friendCode: character.friendCode ?? null,
          }}
          manaCurrent={character.manaCurrent ?? 0}
          onRefreshCharacter={refreshCharacter}
          onPendingInvitesChange={refreshPartyInvites}
        />
      );
    }
    return (
      <ProfileCharacterQuestsPanel
        accessToken={props.accessToken}
        characterPortrait={characterPortrait}
        activeTab={activePanelTab as ProfileCharacterTabKey}
        tabOpenSignal={tabOpenSignal}
        onCharacterRefresh={refreshCharacter}
      />
    );
  }

  function openEdit() {
    if (!character) return;
    setName(character.name);
    setGender(character.gender);
    setRole(roleFromPreset(character.avatarPreset));
    setMsg(null);
    setEditOpen(true);
  }

  function closeEdit() {
    setEditOpen(false);
    setMsg(null);
    if (character) {
      setName(character.name);
      setGender(character.gender);
      setRole(roleFromPreset(character.avatarPreset));
    }
  }

  async function save() {
    if (!character) return;
    setMsg(null);
    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      setMsg('Имя: от 3 до 40 символов.');
      return;
    }
    const patch: { name?: string; gender?: GenderCharacter; avatarPreset?: string } = {};
    if (trimmed !== character.name) patch.name = trimmed;
    if (gender !== character.gender) patch.gender = gender;
    const nextPreset = avatarPreset;
    if (nextPreset !== character.avatarPreset) patch.avatarPreset = nextPreset;
    if (Object.keys(patch).length === 0) {
      closeEdit();
      return;
    }
    setBusy(true);
    try {
      const updated = await api<CharacterDto>('/character/me', {
        method: 'PATCH',
        accessToken: props.accessToken,
        json: patch,
      });
      setCharacter(updated);
      props.onCharacterUpdated?.(updated);
      setEditOpen(false);
      setMsg(null);
      setSaveCheckVisible(true);
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function handleCharacterCreated(c: CharacterDto) {
    setCharacter(c);
    setName(c.name);
    setGender(c.gender);
    setRole(roleFromPreset(c.avatarPreset));
    setLoadPhase('ready');
    props.onCharacterUpdated?.(c);
  }

  if (loadPhase === 'missing') {
    return (
      <div className="px-page profile-character-page">
        <CharacterPageHeader />
        <div className="px-content profile-character-page-content">
          <CharacterCreateForm
            accessToken={props.accessToken}
            onCreated={handleCharacterCreated}
            submitLabel="Создать персонажа"
          />
        </div>
      </div>
    );
  }

  if (loadPhase === 'error' && loadError) {
    return (
      <div className="px-page profile-character-page">
        <CharacterPageHeader />
        <div className="px-content profile-character-page-content">
          <div className="trello-banner trello-banner-error">{loadError}</div>
          <div className="trello-panel" style={{ maxWidth: 480, margin: '16px auto 0' }}>
            <button
              type="button"
              className="trello-btn trello-btn-primary"
              onClick={() => setLoadKey((k) => k + 1)}
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loadPhase === 'loading' || !character) {
    return (
      <div className="px-page profile-character-page">
        <CharacterPageHeader />
        <div className="px-content profile-character-page-content trello-character-loading">
          Загрузка персонажа…
        </div>
      </div>
    );
  }

  return (
    <div className="px-page profile-character-page">
      <CharacterPageHeader />
      <div className="px-content profile-character-page-content">
        {msg ? <div className="trello-banner trello-banner-error">{msg}</div> : null}
        <section className="trello-character-profile trello-character-profile--rpg trello-character-profile--rpg-modern">
          <div className="trello-character-rpg-shell trello-character-rpg-shell--modern">
            {partyInviteToast ? (
              <p className="trello-character-party-invite-toast" role="status">
                {partyInviteToast}
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost trello-btn-sm"
                  onClick={() => setPartyInviteToast(null)}
                >
                  Закрыть
                </button>
              </p>
            ) : null}

            <div className="trello-character-rpg-layout-jrpg">
              <aside className="trello-character-rpg-hero-col" aria-label="Персонаж">
                <div className="trello-character-profile-portrait-wrap trello-character-profile-portrait-wrap--square">
                  <CharacterPortraitWithFrame
                    avatarPreset={character.avatarPreset}
                    frameKey={character.equippedPortraitFrameKey}
                    profileBackgroundKey={character.equippedProfileBackgroundKey}
                  />
                </div>
                <button
                  type="button"
                  className="trello-btn trello-btn-primary trello-character-edit-trigger"
                  onClick={openEdit}
                >
                  Редактировать
                </button>
                <CheckinStreakProfileRow
                  streak={character.checkinStreak ?? 0}
                  animateFrom={streakAnimateFrom}
                  celebrate={streakCelebrate}
                  lostNotice={streakLostNotice}
                  onDismissLost={() => setStreakLostNotice(null)}
                />
                <CharacterStatsPanel
                  character={character}
                  xpToward={xpToward}
                  variant="full"
                />
              </aside>

              <div className="trello-character-rpg-workspace trello-character-rpg-workspace--jrpg">
                <nav
                  className="trello-character-rpg-tabs trello-character-rpg-tabs--horizontal"
                  role="tablist"
                  aria-label="Разделы персонажа"
                >
                  {panelTabs.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      id={`character-tab-${tab.key}`}
                      aria-selected={activePanelTab === tab.key}
                      aria-controls={`character-tabpanel-${tab.key}`}
                      className={
                        activePanelTab === tab.key
                          ? 'trello-character-rpg-tab trello-character-rpg-tab--active'
                          : 'trello-character-rpg-tab'
                      }
                      onClick={() => selectPanelTab(tab.key)}
                    >
                      <span>{tab.label}</span>
                      {tab.badge > 0 && (
                        <span
                          className="trello-character-rpg-tab-badge"
                          aria-label={`${tab.badge} новых`}
                        >
                          {tab.badge > 99 ? '99+' : tab.badge}
                        </span>
                      )}
                    </button>
                  ))}
                </nav>

                <div
                  className="trello-character-rpg-inline-panel"
                  role="tabpanel"
                  id={`character-tabpanel-${activePanelTab}`}
                  aria-labelledby={`character-tab-${activePanelTab}`}
                >
                  {renderPanelContent()}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {editOpen && (
        <div
          className="trello-modal-backdrop trello-character-edit-modal-backdrop"
          role="presentation"
          onClick={() => !busy && closeEdit()}
        >
          <div
            className="trello-modal trello-character-edit-modal"
            role="dialog"
            aria-modal
            aria-labelledby="character-edit-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="trello-modal-head">
              <h2 id="character-edit-title" className="trello-modal-title">
                Редактирование персонажа
              </h2>
              <button
                type="button"
                className="trello-modal-close"
                onClick={() => !busy && closeEdit()}
                disabled={busy}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>
            <ModalForm onSubmit={save} disabled={busy}>
              <div className="trello-modal-body trello-character-edit-modal-body">
                {msg && editOpen && (
                  <div className="trello-banner trello-banner-error" style={{ marginBottom: 12 }}>
                    {msg}
                  </div>
                )}
                <label className="trello-field">
                  <span className="trello-label">Имя персонажа</span>
                  <input
                    className="trello-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    maxLength={40}
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
              </div>
              <div className="trello-modal-foot trello-character-edit-modal-foot">
                <button type="button" className="trello-btn trello-btn-ghost" disabled={busy} onClick={closeEdit}>
                  Отмена
                </button>
                <button type="submit" className="trello-btn trello-btn-primary" disabled={busy}>
                  {busy ? 'Сохранение…' : 'Сохранить'}
                </button>
              </div>
            </ModalForm>
          </div>
        </div>
      )}

      {saveCheckVisible &&
        createPortal(
          <div className="trello-character-save-check-root" aria-live="polite">
            <div className="trello-character-save-check-mark" aria-hidden>
              ✓
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
