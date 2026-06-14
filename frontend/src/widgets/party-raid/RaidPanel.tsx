import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatApiError } from '@shared/api';
import {
  fetchFriends,
  SocialUserCharacterAvatar,
  socialUserDisplayName,
  type FriendView,
  type SocialUserSummary,
} from '@entities/social';
import { BOSS_ATTACK_MANA_COST, BOSS_MAX_PARTY_SIZE, MANA_MAX } from '@entities/reward/lib/xpRewards';
import {
  acceptPartyInvite,
  attackPartyBoss,
  cancelPartyRaid,
  createPartyKickVote,
  createPartyRaid,
  declinePartyInvite,
  fetchBossCatalog,
  fetchPartyMine,
  kickPartyMember,
  startPartyRaid,
  votePartyKick,
  type BossCatalogItem,
  type PartyMemberView,
  type PartyRaidView,
} from '@entities/party';
import { CHEST_TIER_LABEL_RU, type ChestTier } from '@entities/quest';
import {
  BOSS_ICON_SIZE_PICK,
  BOSS_ICON_SIZE_RAID,
  BOSS_ICON_SIZE_SM,
  bossIconUrl,
} from '@entities/party/lib/bossAssets';

type Props = {
  accessToken: string;
  currentUserId: number;
  leaderUser: SocialUserSummary;
  manaCurrent: number;
  onRefreshCharacter?: () => Promise<void>;
  /** Обновить бейдж вкладки «Рейд» после принятия/отклонения приглашения */
  onPendingInvitesChange?: () => void;
};

const MAX_RAID_FRIENDS = BOSS_MAX_PARTY_SIZE - 1;

function memberLabel(name: string, characterName: string | null): string {
  return characterName?.trim() || name;
}

function bossChestRewardLabel(tier: ChestTier): string {
  return `${CHEST_TIER_LABEL_RU[tier].toLowerCase()} boss-сундук`;
}

function raidStatusLabel(status: PartyRaidView['status']): string | null {
  switch (status) {
    case 'INVITING':
      return null;
    case 'ACTIVE':
      return null;
    case 'DEFEATED':
      return 'Победа';
    case 'EXPIRED':
      return 'Истёк';
    case 'CANCELLED':
      return 'Отменён';
    default:
      return null;
  }
}

function memberToSocialUser(
  member: PartyMemberView,
  ctx: {
    leaderUser: SocialUserSummary;
    currentUserId: number;
    friends: FriendView[];
  },
): SocialUserSummary {
  if (member.userId === ctx.currentUserId) return ctx.leaderUser;
  const friend = ctx.friends.find((f) => f.user.userId === member.userId);
  if (friend) return friend.user;
  return {
    userId: member.userId,
    name: member.name,
    avatarPath: null,
    characterName: member.characterName,
    characterAvatarPreset: null,
    friendCode: null,
  };
}

export function RaidPanel({
  accessToken,
  currentUserId,
  leaderUser,
  manaCurrent,
  onRefreshCharacter,
  onPendingInvitesChange,
}: Props) {
  const [bosses, setBosses] = useState<BossCatalogItem[]>([]);
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [raid, setRaid] = useState<PartyRaidView | null>(null);
  const [invites, setInvites] = useState<PartyRaidView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedBoss, setSelectedBoss] = useState<string | null>(null);
  const [selectedFriends, setSelectedFriends] = useState<number[]>([]);
  const [friendSearch, setFriendSearch] = useState('');
  const [kickConfirm, setKickConfirm] = useState<{ raidId: number; userId: number } | null>(null);

  const filteredFriends = useMemo(() => {
    const query = friendSearch.trim().toLowerCase();
    if (!query) return friends;
    return friends.filter((f) => socialUserDisplayName(f.user).toLowerCase().includes(query));
  }, [friendSearch, friends]);

  const reload = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [bossList, mine, friendsList] = await Promise.all([
        fetchBossCatalog(accessToken),
        fetchPartyMine(accessToken),
        fetchFriends(accessToken),
      ]);
      setBosses(bossList);
      setRaid(mine.raid);
      setInvites(mine.pendingInvites);
      setFriends(friendsList);
      setSelectedBoss((prev) => prev ?? bossList[0]?.key ?? null);
      onPendingInvitesChange?.();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken, onPendingInvitesChange]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function afterAction(update: PartyRaidView | null = raid) {
    if (update) setRaid(update);
    await reload();
    await onRefreshCharacter?.();
  }

  function toggleFriend(userId: number) {
    setSelectedFriends((prev) => {
      if (prev.includes(userId)) return prev.filter((id) => id !== userId);
      if (prev.length >= MAX_RAID_FRIENDS) {
        setMsg(`Максимум ${BOSS_MAX_PARTY_SIZE} участников в рейде`);
        return prev;
      }
      return [...prev, userId];
    });
  }

  function openTeamModal() {
    if (!selectedBoss) {
      setMsg('Выберите босса');
      return;
    }
    setMsg(null);
    setFriendSearch('');
    setTeamModalOpen(true);
  }

  function closeTeamModal() {
    if (busy) return;
    setTeamModalOpen(false);
    setSelectedFriends([]);
    setFriendSearch('');
  }

  async function handleCreate() {
    if (!selectedBoss || selectedFriends.length === 0) {
      setMsg('Выберите хотя бы одного друга');
      return;
    }
    setBusy(true);
    try {
      const created = await createPartyRaid(accessToken, selectedBoss, selectedFriends);
      setTeamModalOpen(false);
      setSelectedFriends([]);
      setRaid(created);
      await reload();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function runRaidAction(fn: () => Promise<PartyRaidView>) {
    setBusy(true);
    setMsg(null);
    try {
      const updated = await fn();
      setKickConfirm(null);
      await afterAction(updated);
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  function renderBossPicker() {
    const activeBoss = bosses.find((b) => b.key === selectedBoss) ?? bosses[0];

    return (
      <div className="trello-party-boss-picker">
        <div className="trello-party-boss-tabs" role="tablist" aria-label="Выбор босса">
          {bosses.map((b) => (
            <button
              key={b.key}
              type="button"
              role="tab"
              aria-selected={selectedBoss === b.key}
              className={
                selectedBoss === b.key
                  ? 'trello-party-boss-tab trello-party-boss-tab--active'
                  : 'trello-party-boss-tab'
              }
              data-boss-tier={b.chestTier.toLowerCase()}
              onClick={() => setSelectedBoss(b.key)}
            >
              {b.nameRu}
            </button>
          ))}
        </div>
        {activeBoss ? (
          <div
            className="trello-party-boss-preview"
            data-boss-tier={activeBoss.chestTier.toLowerCase()}
            role="tabpanel"
            aria-label={activeBoss.nameRu}
          >
            <div className="trello-party-boss-preview-art">
              <img
                src={bossIconUrl(activeBoss.key)}
                alt=""
                width={BOSS_ICON_SIZE_PICK}
                height={BOSS_ICON_SIZE_PICK}
                className="trello-party-boss-icon trello-party-boss-icon--preview"
                loading="lazy"
                draggable={false}
              />
            </div>
            <div className="trello-party-boss-preview-copy">
              <h4 className="trello-party-boss-preview-title">
                {activeBoss.nameRu}
                <span
                  className="trello-party-boss-tier-badge"
                  data-boss-tier={activeBoss.chestTier.toLowerCase()}
                >
                  {CHEST_TIER_LABEL_RU[activeBoss.chestTier]}
                </span>
              </h4>
              <p className="trello-party-boss-preview-desc">
                Выполняйте различные активности и получайте ману. Атакуйте босса вместе с друзьями
                и забирайте награду.
              </p>
              <p className="trello-party-boss-loot">
                Награда: {bossChestRewardLabel(activeBoss.chestTier)}
              </p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  function memberSocialContext() {
    return { leaderUser, currentUserId, friends };
  }

  function renderDashboardPartyBar(r: PartyRaidView, isLeader: boolean) {
    return (
      <div
        className="trello-party-raid-party-bar trello-party-raid-party-bar--dashboard"
        aria-label="Состав отряда"
      >
        {r.members.map((m) => {
          const label = memberLabel(m.name, m.characterName);
          const isSelf = m.userId === currentUserId;
          const socialUser = memberToSocialUser(m, memberSocialContext());
          const canKick =
            isLeader &&
            m.role !== 'LEADER' &&
            r.status === 'ACTIVE' &&
            m.status === 'ACTIVE' &&
            !isSelf;
          const canVoteKick =
            !isLeader &&
            r.status === 'ACTIVE' &&
            m.status === 'ACTIVE' &&
            m.userId !== currentUserId &&
            m.userId !== r.leaderId &&
            r.myStatus === 'ACTIVE';
          const isConfirming =
            kickConfirm?.raidId === r.id && kickConfirm?.userId === m.userId;

          return (
            <div
              key={m.userId}
              className={[
                'trello-party-raid-party-column',
                m.role === 'LEADER' ? 'trello-party-raid-party-column--leader' : '',
                m.status === 'INVITED' ? 'trello-party-raid-party-column--invited' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              <div
                className={[
                  'trello-party-raid-avatar-wrap',
                  isConfirming ? 'trello-party-raid-avatar-wrap--confirm' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <SocialUserCharacterAvatar
                  user={socialUser}
                  className="trello-party-raid-party-avatar"
                />
                {canKick && !kickConfirm ? (
                  <button
                    type="button"
                    className="trello-party-raid-avatar-kick"
                    disabled={busy}
                    aria-label={`Исключить ${label}`}
                    onClick={() => setKickConfirm({ raidId: r.id, userId: m.userId })}
                  >
                    ×
                  </button>
                ) : null}
              </div>
              <div className="trello-party-raid-party-labels">
                <span className="trello-party-raid-party-name">{isSelf ? 'Вы' : label}</span>
                {m.role === 'LEADER' ? (
                  <span className="trello-party-raid-party-tag">лидер</span>
                ) : null}
                {m.status === 'INVITED' ? (
                  <span className="trello-party-raid-party-tag">приглашён</span>
                ) : null}
                {m.contributionPct > 0 ? (
                  <span className="trello-party-raid-party-dmg">{m.contributionPct.toFixed(1)}%</span>
                ) : null}
                {canVoteKick ? (
                  <button
                    type="button"
                    className="trello-party-raid-party-vote"
                    disabled={busy}
                    onClick={() =>
                      void runRaidAction(() => createPartyKickVote(accessToken, r.id, m.userId))
                    }
                  >
                    Голосовать
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderInviteRaidCard(r: PartyRaidView) {
    const statusLabel = raidStatusLabel(r.status);

    return (
      <div key={r.id} className="trello-party-raid-card">
        <div className="trello-party-raid-head">
          <img
            src={bossIconUrl(r.bossKey)}
            alt=""
            width={BOSS_ICON_SIZE_SM}
            height={BOSS_ICON_SIZE_SM}
            className="trello-party-boss-icon"
            loading="lazy"
            draggable={false}
          />
          <h3 className="trello-party-raid-title">{r.bossNameRu}</h3>
          {statusLabel ? (
            <span className="trello-party-raid-status">{statusLabel}</span>
          ) : null}
        </div>
        <p className="trello-party-raid-desc">{r.bossDescriptionRu}</p>
        <ul className="trello-party-member-list">
          {r.members.map((m) => (
            <li key={m.userId} className="trello-party-member-item">
              <span>
                {memberLabel(m.name, m.characterName)}
                {m.role === 'LEADER' ? ' · лидер' : ''}
              </span>
            </li>
          ))}
        </ul>
        <div className="trello-party-raid-actions">
          <button
            type="button"
            className="trello-btn trello-btn-primary"
            disabled={busy}
            onClick={() => void runRaidAction(() => acceptPartyInvite(accessToken, r.id))}
          >
            Принять
          </button>
          <button
            type="button"
            className="trello-btn trello-btn-ghost"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await declinePartyInvite(accessToken, r.id);
                await reload();
              } catch (e) {
                setMsg(formatApiError(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Отклонить
          </button>
        </div>
      </div>
    );
  }

  function renderDashboardRaidCard(r: PartyRaidView) {
    const isLeader = r.leaderId === currentUserId;
    const hpPct = Math.max(0, Math.min(100, r.remainingPct));
    const canAttack =
      r.status === 'ACTIVE' &&
      r.myStatus === 'ACTIVE' &&
      manaCurrent >= BOSS_ATTACK_MANA_COST;
    const statusLabel = raidStatusLabel(r.status);

    return (
      <div key={r.id} className="trello-party-raid-card trello-party-raid-card--dashboard">
        <div className="trello-party-raid-dash-hero">
          <img
            src={bossIconUrl(r.bossKey)}
            alt=""
            width={BOSS_ICON_SIZE_RAID}
            height={BOSS_ICON_SIZE_RAID}
            className="trello-party-boss-icon trello-party-boss-icon--raid-hero"
            loading="lazy"
            draggable={false}
          />
          <h3 className="trello-party-raid-title">{r.bossNameRu}</h3>
          {statusLabel ? (
            <span className="trello-party-raid-status">{statusLabel}</span>
          ) : null}
          <p className="trello-party-raid-dash-reward">
            <span className="trello-party-raid-dash-reward-label">Награда:</span>{' '}
            {bossChestRewardLabel(r.chestTier)}
          </p>
        </div>

        {r.status === 'ACTIVE' || r.status === 'DEFEATED' ? (
          <div className="trello-party-raid-stats" aria-label="Показатели рейда">
            <div className="trello-party-raid-stat trello-party-raid-stat--hp">
              <span className="trello-party-raid-stat-val">{hpPct.toFixed(0)}%</span>
              <span className="trello-party-raid-stat-label">HP босса</span>
            </div>
            <div className="trello-party-raid-stat">
              <span className="trello-party-raid-stat-val">
                {r.status === 'ACTIVE' ? `${r.damagePerAttack.toFixed(0)}%` : '—'}
              </span>
              <span className="trello-party-raid-stat-label">Урон/удар</span>
            </div>
            <div className="trello-party-raid-stat trello-party-raid-stat--mana">
              <span className="trello-party-raid-stat-val">
                {r.status === 'ACTIVE' ? `${manaCurrent}/${MANA_MAX}` : '—'}
              </span>
              <span className="trello-party-raid-stat-label">Мана</span>
            </div>
          </div>
        ) : (
          <p className="trello-party-raid-dash-invite-meta">
            Участников: {r.members.filter((m) => m.status !== 'DECLINED').length} · готовы:{' '}
            {r.activeMemberCount}
          </p>
        )}

        {renderDashboardPartyBar(r, isLeader)}

        {r.openKickVote ? (
          <div className="trello-party-kick-vote">
            Голосование за исключение: {r.openKickVote.approveCount}/
            {r.openKickVote.requiredCount}
            {r.openKickVote.targetUserId !== currentUserId ? (
              <button
                type="button"
                className="trello-btn trello-btn-ghost trello-btn-sm"
                disabled={busy}
                onClick={() =>
                  void runRaidAction(() =>
                    votePartyKick(accessToken, r.id, r.openKickVote!.id),
                  )
                }
              >
                Поддержать
              </button>
            ) : null}
          </div>
        ) : null}

        {r.recentHits.length > 0 ? (
          <ul className="trello-party-hit-log">
            {r.recentHits.slice(0, 8).map((h) => (
              <li key={h.id}>
                {h.userName} −{h.damagePct.toFixed(2)}%
              </li>
            ))}
          </ul>
        ) : null}

        <div className="trello-party-raid-actions trello-party-raid-actions--dashboard">
          {r.status === 'INVITING' && isLeader ? (
            <>
              <button
                type="button"
                className="trello-btn trello-btn-primary trello-party-raid-attack-btn"
                disabled={busy || r.activeMemberCount < 2}
                onClick={() => void runRaidAction(() => startPartyRaid(accessToken, r.id))}
              >
                Начать рейд
              </button>
              <button
                type="button"
                className="trello-btn trello-btn-ghost"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    await cancelPartyRaid(accessToken, r.id);
                    setRaid(null);
                    setKickConfirm(null);
                    await reload();
                  } catch (e) {
                    setMsg(formatApiError(e));
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Отменить
              </button>
            </>
          ) : null}
          {r.status === 'ACTIVE' && r.myStatus === 'ACTIVE' ? (
            <button
              type="button"
              className="trello-btn trello-btn-primary trello-party-raid-attack-btn"
              disabled={busy || !canAttack}
              onClick={() => void runRaidAction(() => attackPartyBoss(accessToken, r.id))}
            >
              Атака (−{BOSS_ATTACK_MANA_COST} маны)
            </button>
          ) : null}
        </div>
      </div>
    );
  }

  function renderRaidCard(r: PartyRaidView, options?: { invite?: boolean }) {
    if (options?.invite) return renderInviteRaidCard(r);
    return renderDashboardRaidCard(r);
  }

  const kickTarget = useMemo(() => {
    if (!kickConfirm || !raid || raid.id !== kickConfirm.raidId) return null;
    const member = raid.members.find((m) => m.userId === kickConfirm.userId);
    if (!member) return null;
    return {
      member,
      label: memberLabel(member.name, member.characterName),
      socialUser: memberToSocialUser(member, { leaderUser, currentUserId, friends }),
    };
  }, [kickConfirm, raid, leaderUser, currentUserId, friends]);

  function renderKickConfirmModal() {
    if (!kickConfirm || !kickTarget) return null;

    return createPortal(
      <div
        className="trello-modal-backdrop"
        role="presentation"
        onClick={busy ? undefined : () => setKickConfirm(null)}
      >
        <div
          className="trello-modal trello-party-kick-modal"
          role="alertdialog"
          aria-modal
          aria-labelledby="party-kick-modal-title"
          aria-describedby="party-kick-modal-desc"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="trello-modal-body trello-party-kick-modal-body">
            <SocialUserCharacterAvatar
              user={kickTarget.socialUser}
              className="trello-party-kick-modal-avatar"
            />
            <h2 id="party-kick-modal-title" className="trello-party-kick-modal-title">
              Исключить из рейда?
            </h2>
            <p id="party-kick-modal-desc" className="trello-party-kick-modal-desc">
              <strong>{kickTarget.label}</strong> будет удалён из отряда и не получит награду за
              этого босса.
            </p>
          </div>
          <div className="trello-modal-foot trello-modal-foot-center trello-party-kick-modal-foot">
            <button
              type="button"
              className="trello-btn trello-btn-ghost"
              disabled={busy}
              onClick={() => setKickConfirm(null)}
            >
              Отмена
            </button>
            <button
              type="button"
              className="trello-btn trello-btn-danger trello-party-kick-modal-confirm"
              disabled={busy}
              onClick={() =>
                void runRaidAction(() =>
                  kickPartyMember(accessToken, kickConfirm.raidId, kickConfirm.userId),
                )
              }
            >
              {busy ? 'Исключение…' : 'Исключить'}
            </button>
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const selectedBossItem = bosses.find((b) => b.key === selectedBoss);

  if (loading) {
    return <div className="trello-party-loading">Загрузка рейда…</div>;
  }

  return (
    <div className={`trello-party-panel${raid ? ' trello-party-panel--active-raid' : ''}`}>
      {msg && !teamModalOpen ? <div className="trello-banner trello-banner-error">{msg}</div> : null}

      {invites.length > 0 ? (
        <section className="trello-party-section">
          <h2 className="trello-party-section-title">Приглашения в рейд</h2>
          {invites.map((inv) => renderRaidCard(inv, { invite: true }))}
        </section>
      ) : null}

      {raid ? (
        <section className="trello-party-section trello-party-section--fill">
          <h2 className="trello-party-section-title">Текущий рейд</h2>
          {renderRaidCard(raid)}
        </section>
      ) : (
        <section className="trello-party-section">
          <h2 className="trello-party-section-title">Рейд с друзьями</h2>
          <h3 className="trello-party-create-subtitle">Выберите босса</h3>
          {renderBossPicker()}
          <div className="trello-party-gather-row trello-party-gather-row--centered">
            <button
              type="button"
              className="trello-btn trello-btn-primary"
              disabled={friends.length === 0 || !selectedBoss}
              onClick={openTeamModal}
            >
              Собрать команду
            </button>
            {friends.length === 0 ? (
              <p className="trello-muted trello-party-gather-hint">
                Добавьте друзей, чтобы собрать команду.
              </p>
            ) : null}
          </div>
        </section>
      )}

      {teamModalOpen &&
        createPortal(
          <div
            className="trello-modal-backdrop"
            role="presentation"
            onClick={closeTeamModal}
          >
            <div
              className="trello-modal trello-party-team-modal trello-party-team-modal--slots"
              role="dialog"
              aria-modal
              aria-labelledby="party-team-modal-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="trello-modal-head">
                <h2 id="party-team-modal-title" className="trello-modal-title">
                  Собрать команду
                </h2>
                <button
                  type="button"
                  className="trello-modal-close"
                  onClick={closeTeamModal}
                  disabled={busy}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="trello-modal-body">
                {msg ? <div className="trello-banner trello-banner-error">{msg}</div> : null}
                {selectedBossItem ? (
                  <p className="trello-party-team-boss">
                    Босс: <strong>{selectedBossItem.nameRu}</strong>
                  </p>
                ) : null}
                <div className="trello-party-team-slots" aria-label="Состав отряда">
                  <div className="trello-party-team-slot trello-party-team-slot--leader">
                    <SocialUserCharacterAvatar
                      user={leaderUser}
                      className="trello-party-team-slot-avatar"
                    />
                    <span className="trello-party-team-slot-label">Вы</span>
                  </div>
                  {Array.from({ length: MAX_RAID_FRIENDS }, (_, index) => {
                    const friendId = selectedFriends[index];
                    const friend = friendId
                      ? friends.find((f) => f.user.userId === friendId)
                      : undefined;
                    return (
                      <div
                        key={index}
                        className={
                          friend
                            ? 'trello-party-team-slot trello-party-team-slot--filled'
                            : 'trello-party-team-slot'
                        }
                      >
                        {friend ? (
                          <>
                            <SocialUserCharacterAvatar
                              user={friend.user}
                              className="trello-party-team-slot-avatar"
                            />
                            <span className="trello-party-team-slot-label">
                              {socialUserDisplayName(friend.user)}
                            </span>
                          </>
                        ) : (
                          <span className="trello-party-team-slot-label">+ друг</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div className="trello-party-team-divider" aria-hidden />
                {friends.length === 0 ? (
                  <p className="trello-muted">Сначала добавьте друзей на вкладке «Друзья».</p>
                ) : (
                  <>
                    <input
                      type="search"
                      className="trello-party-team-search"
                      placeholder="Поиск друга…"
                      value={friendSearch}
                      onChange={(e) => setFriendSearch(e.target.value)}
                      aria-label="Поиск друга"
                    />
                    <ul className="trello-party-friend-pick trello-party-friend-pick--slots">
                      {filteredFriends.length === 0 ? (
                        <li className="trello-party-friend-pick-empty">Никого не найдено</li>
                      ) : (
                        filteredFriends.map((f) => {
                          const selected = selectedFriends.includes(f.user.userId);
                          return (
                            <li
                              key={f.user.userId}
                              className={
                                selected ? 'trello-party-friend-pick-item--selected' : undefined
                              }
                            >
                              <button
                                type="button"
                                className="trello-party-friend-pick-row"
                                disabled={busy}
                                onClick={() => toggleFriend(f.user.userId)}
                              >
                                <SocialUserCharacterAvatar user={f.user} />
                                <span className="trello-party-friend-pick-name">
                                  {socialUserDisplayName(f.user)}
                                </span>
                                <span className="trello-party-team-add-btn" aria-hidden="true">
                                  {selected ? '✓' : '+'}
                                </span>
                              </button>
                            </li>
                          );
                        })
                      )}
                    </ul>
                  </>
                )}
              </div>
              <div className="trello-modal-foot trello-party-team-foot">
                <p className="trello-party-team-foot-note">
                  Максимум {BOSS_MAX_PARTY_SIZE} участников · {selectedFriends.length}{' '}
                  {selectedFriends.length === 1 ? 'выбран' : 'выбрано'}
                </p>
                <div className="trello-party-team-foot-actions">
                  <button
                    type="button"
                    className="trello-btn trello-btn-ghost"
                    disabled={busy}
                    onClick={closeTeamModal}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    className="trello-btn trello-btn-primary"
                    disabled={busy || friends.length === 0 || selectedFriends.length === 0}
                    onClick={() => void handleCreate()}
                  >
                    {busy ? 'Отправка…' : 'Отправить приглашения'}
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )}
      {renderKickConfirmModal()}
    </div>
  );
}
