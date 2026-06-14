import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatApiError } from '@shared/api';
import { formatDateTimeRu } from '@shared/lib/formatDateRu';
import { SpaLink } from '@shared/lib';
import { userProfilePath } from '@entities/user';
import {
  acceptFriendRequest,
  cancelFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  fetchMyFriendCode,
  fetchOutgoingFriendRequests,
  parseFriendCodeInput,
  removeFriend,
  sendFriendRequest,
  SocialUserCharacterAvatar,
  socialUserDisplayName,
  type FriendRequestView,
  type FriendView,
  type SocialUserSummary,
  formatFriendCode,
} from '@entities/social';

type Props = {
  accessToken: string;
  onMessagePeer?: (user: SocialUserSummary) => void;
  onInboxChange?: () => void;
};

export function FriendsPanel({ accessToken, onMessagePeer, onInboxChange }: Props) {
  const [myCode, setMyCode] = useState<string | null>(null);
  const [codeInput, setCodeInput] = useState('');
  const [friends, setFriends] = useState<FriendView[]>([]);
  const [incoming, setIncoming] = useState<FriendRequestView[]>([]);
  const [outgoing, setOutgoing] = useState<FriendRequestView[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    userId: number;
    name: string;
  } | null>(null);
  const onInboxChangeRef = useRef(onInboxChange);
  onInboxChangeRef.current = onInboxChange;

  const reload = useCallback(async () => {
    setLoading(true);
    setMsg(null);
    try {
      const [code, friendsList, inList, outList] = await Promise.all([
        fetchMyFriendCode(accessToken),
        fetchFriends(accessToken),
        fetchIncomingFriendRequests(accessToken),
        fetchOutgoingFriendRequests(accessToken),
      ]);
      setMyCode(code.formatted);
      setFriends(friendsList);
      setIncoming(inList);
      setOutgoing(outList);
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function afterMutation() {
    await reload();
    onInboxChangeRef.current?.();
  }

  async function handleCopyCode() {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg('Не удалось скопировать код');
    }
  }

  async function handleSendRequest() {
    const code = parseFriendCodeInput(codeInput);
    if (code == null) {
      setMsg('Введите 4-значный код друга');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await sendFriendRequest(accessToken, code);
      setCodeInput('');
      await afterMutation();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAccept(id: number) {
    setBusy(true);
    try {
      await acceptFriendRequest(accessToken, id);
      await afterMutation();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleDecline(id: number) {
    setBusy(true);
    try {
      await declineFriendRequest(accessToken, id);
      await afterMutation();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel(id: number) {
    setBusy(true);
    try {
      await cancelFriendRequest(accessToken, id);
      await afterMutation();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  async function confirmRemoveFriend() {
    if (!removeTarget) return;
    setBusy(true);
    setMsg(null);
    try {
      await removeFriend(accessToken, removeTarget.userId);
      setRemoveTarget(null);
      await afterMutation();
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <p className="trello-muted trello-social-loading">Загрузка…</p>;
  }

  return (
    <div className="trello-social-panel">
      {msg && <div className="trello-banner trello-banner-error">{msg}</div>}

      <section className="trello-social-section">
        <h3 className="trello-social-section-title">Твой ID</h3>
        <div className="trello-social-my-code-row">
          <span className="trello-social-my-code">{myCode ?? '—'}</span>
          <button
            type="button"
            className="trello-btn trello-btn-ghost trello-btn-sm"
            onClick={() => void handleCopyCode()}
            disabled={!myCode}
          >
            {copied ? 'Скопировано' : 'Копировать'}
          </button>
        </div>
        <p className="trello-muted trello-social-hint">
          Друзья добавляют вас по этому коду в игре.
        </p>
      </section>

      <section className="trello-social-section">
        <h3 className="trello-social-section-title">Добавить друга</h3>
        <form
          className="trello-social-add-row"
          onSubmit={(e) => {
            e.preventDefault();
            if (!busy) void handleSendRequest();
          }}
        >
          <input
            className="trello-input trello-social-code-input"
            placeholder="4 цифры"
            inputMode="numeric"
            maxLength={5}
            value={codeInput}
            onChange={(e) => setCodeInput(e.target.value)}
          />
          <button
            type="submit"
            className="trello-btn trello-btn-primary trello-btn-sm"
            disabled={busy}
          >
            Отправить заявку
          </button>
        </form>
      </section>

      {incoming.length > 0 && (
        <section className="trello-social-section">
          <h3 className="trello-social-section-title">Входящие заявки</h3>
          <ul className="trello-social-list">
            {incoming.map((req) => (
              <li key={req.id} className="trello-social-list-row">
                <span className="trello-social-list-name">
                  {socialUserDisplayName(req.otherUser)}
                  {req.otherUser.friendCode != null && (
                    <span className="trello-social-list-code">
                      {formatFriendCode(req.otherUser.friendCode)}
                    </span>
                  )}
                </span>
                <span className="trello-social-list-actions">
                  <button
                    type="button"
                    className="trello-btn trello-btn-primary trello-btn-sm"
                    disabled={busy}
                    onClick={() => void handleAccept(req.id)}
                  >
                    Принять
                  </button>
                  <button
                    type="button"
                    className="trello-btn trello-btn-ghost trello-btn-sm"
                    disabled={busy}
                    onClick={() => void handleDecline(req.id)}
                  >
                    Отклонить
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="trello-social-section">
          <h3 className="trello-social-section-title">Исходящие заявки</h3>
          <ul className="trello-social-list">
            {outgoing.map((req) => (
              <li key={req.id} className="trello-social-list-row">
                <span className="trello-social-list-name">{socialUserDisplayName(req.otherUser)}</span>
                <span className="trello-social-list-actions">
                  <button
                    type="button"
                    className="trello-btn trello-btn-ghost trello-btn-sm"
                    disabled={busy}
                    onClick={() => void handleCancel(req.id)}
                  >
                    Отменить
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="trello-social-section">
        <h3 className="trello-social-section-title">Друзья</h3>
        {friends.length === 0 ? (
          <p className="trello-muted">Пока нет друзей.</p>
        ) : (
          <ul className="trello-social-friends-grid">
            {friends.map((f) => {
              const label = socialUserDisplayName(f.user);
              const onlineLabel = f.user.isOnline
                ? 'в сети'
                : f.user.lastSeenAt
                  ? `был(а) ${formatDateTimeRu(f.user.lastSeenAt)}`
                  : null;
              return (
                <li key={f.user.userId} className="trello-social-friend-card">
                  <SpaLink
                    className="trello-social-friend-link"
                    to={userProfilePath(f.user.userId)}
                    title={`Профиль: ${label}`}
                  >
                    <SocialUserCharacterAvatar user={f.user} />
                    <span className="trello-social-friend-name">
                      <span className="trello-social-friend-name-text">{label}</span>
                      {onlineLabel ? (
                        <span className="trello-social-friend-presence">{onlineLabel}</span>
                      ) : null}
                    </span>
                  </SpaLink>
                  <span className="trello-social-friend-actions">
                    {onMessagePeer && (
                      <button
                        type="button"
                        className="trello-btn trello-btn-ghost trello-btn-sm"
                        onClick={() => onMessagePeer(f.user)}
                      >
                        Написать
                      </button>
                    )}
                    <button
                      type="button"
                      className="trello-btn trello-btn-ghost trello-btn-sm"
                      disabled={busy}
                      onClick={() => setRemoveTarget({ userId: f.user.userId, name: label })}
                    >
                      Удалить
                    </button>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {removeTarget &&
        createPortal(
          <div
            className="trello-modal-backdrop"
            role="presentation"
            onClick={() => !busy && setRemoveTarget(null)}
          >
            <div
              className="trello-modal trello-modal-narrow"
              role="dialog"
              aria-modal
              aria-labelledby="remove-friend-title"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="trello-modal-head">
                <h2 id="remove-friend-title" className="trello-modal-title">
                  Удалить из друзей?
                </h2>
                <button
                  type="button"
                  className="trello-modal-close"
                  onClick={() => !busy && setRemoveTarget(null)}
                  disabled={busy}
                  aria-label="Закрыть"
                >
                  ×
                </button>
              </div>
              <div className="trello-modal-body">
                <p className="trello-confirm-text">
                  <strong>{removeTarget.name}</strong> будет удалён из списка друзей. Вы сможете
                  отправить заявку снова по игровому ID.
                </p>
              </div>
              <div className="trello-modal-foot">
                <button
                  type="button"
                  className="trello-btn trello-btn-ghost"
                  disabled={busy}
                  onClick={() => setRemoveTarget(null)}
                >
                  Отмена
                </button>
                <button
                  type="button"
                  className="trello-btn trello-btn-danger"
                  disabled={busy}
                  onClick={() => void confirmRemoveFriend()}
                >
                  {busy ? 'Удаление…' : 'Удалить'}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
