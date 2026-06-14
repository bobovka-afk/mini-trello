import { useEffect, useMemo, useState } from 'react';
import {
  fetchPendingEmailChange,
  fetchUserSessions,
  fetchUserSettings,
  patchDisplayTimezone,
  requestEmailChange,
  revokeOtherUserSessions,
  revokeUserSession,
  useGamificationSettings,
  useNotificationSettings,
  usePrivacySettings,
  type PendingEmailChangeDto,
  type UserSessionDto,
} from '@entities/user-settings';
import { api, formatApiError } from '@shared/api';
import { SettingsSwitch } from '@shared/ui/settings-switch/SettingsSwitch';
import { SettingsPasswordPanel } from '@widgets/settings-password/SettingsPasswordPanel';
import { SettingsDeleteAccountPanel } from '@widgets/settings-delete-account/SettingsDeleteAccountPanel';
import { SettingsSecurityLogModal } from '@widgets/settings-security-log/SettingsSecurityLogModal';
import { SettingsSessionsPanel } from '@widgets/settings-sessions/SettingsSessionsPanel';
import { SettingsWebPushPanel } from '@widgets/settings-web-push/SettingsWebPushPanel';
import { ThemedSelect } from '@features/board/ui/ThemedSelect';
import {
  SETTINGS_TAB_LABELS,
  SETTINGS_TABS,
  replaceSettingsTabInUrl,
  type SettingsTab,
} from './settingsRoutes';

type UserSafe = {
  id: number;
  email: string;
  name: string;
  hasPassword: boolean;
};

const DISPLAY_TIMEZONE_SUGGESTIONS = [
  'Europe/Moscow',
  'Europe/Kyiv',
  'Asia/Almaty',
  'UTC',
  'Europe/Berlin',
  'America/New_York',
];

type Props = {
  accessToken: string | null;
  initialTab?: SettingsTab;
  onAccountDeleted?: () => void;
  onCurrentSessionRevoked?: () => void;
};

export function SettingsPage(props: Props) {
  const [user, setUser] = useState<UserSafe | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<SettingsTab>(props.initialTab ?? 'account');
  const [gamificationSettings, setGamificationSettings, gamificationMeta] =
    useGamificationSettings(props.accessToken);
  const [privacySettings, setPrivacySettings, privacyMeta] = usePrivacySettings(
    props.accessToken,
  );
  const [notificationSettings, setNotificationSettings, notificationMeta] =
    useNotificationSettings(props.accessToken);
  const [sessions, setSessions] = useState<UserSessionDto[]>([]);
  const [pendingEmail, setPendingEmail] = useState<PendingEmailChangeDto>(null);
  const [newEmail, setNewEmail] = useState('');
  const [emailChangePassword, setEmailChangePassword] = useState('');
  const [emailChangeBusy, setEmailChangeBusy] = useState(false);
  const [emailChangeMsg, setEmailChangeMsg] = useState<string | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [sessionBusyId, setSessionBusyId] = useState<string | null>(null);
  const [revokeOthersBusy, setRevokeOthersBusy] = useState(false);
  const [securityLogOpen, setSecurityLogOpen] = useState(false);
  const [displayTimezone, setDisplayTimezone] = useState('');
  const [timezoneBusy, setTimezoneBusy] = useState(false);
  const [timezoneMsg, setTimezoneMsg] = useState<string | null>(null);
  const timezoneOptions = useMemo(() => {
    const zones =
      displayTimezone && !DISPLAY_TIMEZONE_SUGGESTIONS.includes(displayTimezone)
        ? [displayTimezone, ...DISPLAY_TIMEZONE_SUGGESTIONS]
        : DISPLAY_TIMEZONE_SUGGESTIONS;
    return zones.map((z) => ({ value: z, label: z }));
  }, [displayTimezone]);
  useEffect(() => {
    setTab(props.initialTab ?? 'account');
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'auto' });
    });
  }, [props.initialTab]);

  function selectTab(key: SettingsTab) {
    if (tab === key) return;
    setTab(key);
    replaceSettingsTabInUrl(key);
  }

  useEffect(() => {
    async function load() {
      setMsg(null);
      if (!props.accessToken) {
        setMsg('Пожалуйста, сначала выполните вход.');
        return;
      }
      try {
        const res = await api<UserSafe>('/user/me', {
          method: 'GET',
          accessToken: props.accessToken,
        });
        setUser(res);
      } catch (e) {
        setMsg(formatApiError(e));
      }
    }
    void load();
  }, [props.accessToken]);

  useEffect(() => {
    if (!props.accessToken) return;
    let cancelled = false;
    setSecurityLoading(true);
    void (async () => {
      try {
        const [settings, nextSessions, pending] = await Promise.all([
          fetchUserSettings(props.accessToken!),
          fetchUserSessions(props.accessToken!),
          fetchPendingEmailChange(props.accessToken!),
        ]);
        if (cancelled) return;
        const tz =
          typeof settings.displayTimezone === 'string' ? settings.displayTimezone : '';
        setDisplayTimezone(tz);
        setSessions(nextSessions);
        setPendingEmail(pending);
      } catch (e) {
        if (!cancelled) setMsg(formatApiError(e));
      } finally {
        if (!cancelled) setSecurityLoading(false);
      }
    })();

    const params = new URLSearchParams(window.location.search);
    const status = params.get('emailChange');
    if (status === 'success') {
      setEmailChangeMsg('Email обновлён. Подтверждения с обоих адресов получены.');
      void loadUser();
    } else if (status === 'pending') {
      setEmailChangeMsg('Подтверждение получено. Дождитесь второго письма.');
    } else if (status === 'invalid') {
      setEmailChangeMsg('Ссылка недействительна или устарела.');
    }

    return () => {
      cancelled = true;
    };
  }, [props.accessToken]);

  async function loadUser() {
    if (!props.accessToken) return;
    try {
      const res = await api<UserSafe>('/user/me', {
        method: 'GET',
        accessToken: props.accessToken,
      });
      setUser(res);
    } catch (e) {
      setMsg(formatApiError(e));
    }
  }

  async function handleRequestEmailChange() {
    if (!props.accessToken) return;
    setEmailChangeBusy(true);
    setEmailChangeMsg(null);
    try {
      await requestEmailChange(props.accessToken, {
        newEmail,
        currentPassword: emailChangePassword || undefined,
      });
      setEmailChangeMsg('Письма отправлены на старый и новый адрес. Подтвердите оба.');
      const pending = await fetchPendingEmailChange(props.accessToken);
      setPendingEmail(pending);
      setNewEmail('');
      setEmailChangePassword('');
    } catch (e) {
      setEmailChangeMsg(formatApiError(e));
    } finally {
      setEmailChangeBusy(false);
    }
  }

  async function handleRevokeSession(sessionId: string, isCurrent = false) {
    if (!props.accessToken) return;
    setSessionBusyId(sessionId);
    setMsg(null);
    try {
      await revokeUserSession(props.accessToken, sessionId);
      if (isCurrent) {
        props.onCurrentSessionRevoked?.();
        return;
      }
      setSessions((rows) => rows.filter((row) => row.id !== sessionId));
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setSessionBusyId(null);
    }
  }

  async function handleSaveTimezone() {
    if (!props.accessToken) return;
    const tz = displayTimezone.trim();
    if (!tz) {
      setTimezoneMsg('Укажите часовой пояс, например Europe/Moscow.');
      return;
    }
    setTimezoneBusy(true);
    setTimezoneMsg(null);
    try {
      const res = await patchDisplayTimezone(props.accessToken, tz);
      setDisplayTimezone(res.displayTimezone ?? tz);
      setTimezoneMsg('Часовой пояс сохранён.');
    } catch (e) {
      setTimezoneMsg(formatApiError(e));
    } finally {
      setTimezoneBusy(false);
    }
  }

  async function handleRevokeOtherSessions() {
    if (!props.accessToken) return;
    setRevokeOthersBusy(true);
    setMsg(null);
    try {
      await revokeOtherUserSessions(props.accessToken);
      const nextSessions = await fetchUserSessions(props.accessToken);
      setSessions(nextSessions);
    } catch (e) {
      setMsg(formatApiError(e));
    } finally {
      setRevokeOthersBusy(false);
    }
  }

  function renderTabContent(activeTab: SettingsTab) {
    switch (activeTab) {
      case 'account':
        return (
          <div className="trello-settings-section">
            <div className="trello-settings-cards">
            {emailChangeMsg ? (
              <p className="trello-settings-inline-msg">{emailChangeMsg}</p>
            ) : null}
            <article className="trello-settings-card">
              <h2 className="trello-settings-card-title">Текущая почта</h2>
              <p className="trello-settings-card-value">{user?.email ?? '—'}</p>
            </article>
            {pendingEmail ? (
              <article className="trello-settings-card trello-settings-card--muted">
                <h2 className="trello-settings-card-title">Смена в процессе</h2>
                <p className="trello-settings-card-hint">
                  Новый адрес: <strong>{pendingEmail.newEmail}</strong>
                </p>
                <p className="trello-settings-card-hint">
                  Старый: {pendingEmail.oldConfirmed ? 'подтверждён' : 'ожидает'} · Новый:{' '}
                  {pendingEmail.newConfirmed ? 'подтверждён' : 'ожидает'}
                </p>
              </article>
            ) : null}
            <article className="trello-settings-card">
              <h2 className="trello-settings-card-title">Сменить email</h2>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!emailChangeBusy && newEmail.trim()) void handleRequestEmailChange();
                }}
              >
                <label className="trello-field">
                  <span className="trello-label">Новый email</span>
                  <input
                    className="trello-input"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    disabled={emailChangeBusy}
                  />
                </label>
                {user?.hasPassword ? (
                  <label className="trello-field">
                    <span className="trello-label">Текущий пароль</span>
                    <input
                      className="trello-input"
                      type="password"
                      value={emailChangePassword}
                      onChange={(e) => setEmailChangePassword(e.target.value)}
                      disabled={emailChangeBusy}
                    />
                  </label>
                ) : null}
                <div className="trello-settings-card-actions">
                  <button
                    type="submit"
                    className="trello-btn trello-btn-primary trello-btn-sm"
                    disabled={emailChangeBusy || !newEmail.trim()}
                  >
                    {emailChangeBusy ? '…' : 'Отправить подтверждения'}
                  </button>
                </div>
              </form>
            </article>
            <article className="trello-settings-card">
              <h2 className="trello-settings-card-title">Часовой пояс отображения</h2>
              <p className="trello-settings-card-hint">
                Для дедлайнов и подписей времени в интерфейсе. Сброс игровых суток на сервере
                не меняется.
              </p>
              {timezoneMsg ? (
                <p className="trello-settings-card-hint">{timezoneMsg}</p>
              ) : null}
              <div className="trello-field trello-settings-timezone-field">
                <ThemedSelect
                  className="trello-settings-timezone-select"
                  value={displayTimezone}
                  options={timezoneOptions}
                  includeEmptyOption={!displayTimezone}
                  emptyOption={{ value: '', label: 'Выберите часовой пояс' }}
                  disabled={timezoneBusy}
                  aria-label="Часовой пояс отображения"
                  onChange={setDisplayTimezone}
                />
              </div>
              <div className="trello-settings-card-actions">
                <button
                  type="button"
                  className="trello-btn trello-btn-primary trello-btn-sm"
                  disabled={timezoneBusy || !displayTimezone.trim()}
                  onClick={() => void handleSaveTimezone()}
                >
                  {timezoneBusy ? '…' : 'Сохранить часовой пояс'}
                </button>
              </div>
            </article>
            {props.accessToken && props.onAccountDeleted ? (
              <SettingsDeleteAccountPanel
                accessToken={props.accessToken}
                hasPassword={Boolean(user?.hasPassword)}
                onDeleted={props.onAccountDeleted}
              />
            ) : null}
            </div>
          </div>
        );

      case 'security':
        return (
          <div className="trello-settings-section">
            {props.accessToken ? (
              <SettingsPasswordPanel
                accessToken={props.accessToken}
                user={user}
                onUserUpdated={() => void loadUser()}
              />
            ) : null}

            <article className="trello-settings-card">
              <div className="trello-settings-card-head-row">
                <h2 className="trello-settings-card-title">Журнал безопасности</h2>
                <div className="trello-settings-card-head-actions">
                  <button
                    type="button"
                    className="trello-btn trello-btn-ghost trello-btn-sm"
                    onClick={() => setSecurityLogOpen(true)}
                  >
                    Открыть журнал
                  </button>
                </div>
              </div>
              <p className="trello-settings-card-hint">
                Смена пароля, входы, сессии и почта — с IP и устройством.
              </p>
            </article>

            <SettingsSecurityLogModal
              accessToken={props.accessToken}
              open={securityLogOpen}
              onClose={() => setSecurityLogOpen(false)}
            />
          </div>
        );

      case 'sessions':
        return (
          <>
            {props.accessToken ? (
              <SettingsSessionsPanel
                sessions={sessions}
                loading={securityLoading}
                sessionBusyId={sessionBusyId}
                revokeOthersBusy={revokeOthersBusy}
                onRevokeSession={(sessionId, isCurrent) =>
                  void handleRevokeSession(sessionId, isCurrent)
                }
                onRevokeOthers={() => void handleRevokeOtherSessions()}
                onOpenSecurityLog={() => setSecurityLogOpen(true)}
              />
            ) : null}
            <SettingsSecurityLogModal
              accessToken={props.accessToken}
              open={securityLogOpen}
              onClose={() => setSecurityLogOpen(false)}
            />
          </>
        );

      case 'notifications':
        return (
          <div className="trello-settings-section">
            <div className="trello-settings-cards">
            <article className="trello-settings-card">
            <div
              className="trello-settings-switches"
              aria-busy={notificationMeta.loading || undefined}
            >
              <SettingsSwitch
                label="Письма о безопасности"
                description="Смена пароля, вход с нового устройства, смена email."
                checked={notificationSettings.emailSecurity}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ emailSecurity: checked })}
              />
              <SettingsSwitch
                label="Приглашения в команду"
                description="Письма с приглашением в рабочее пространство."
                checked={notificationSettings.emailWorkspaceInvites}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) =>
                  setNotificationSettings({ emailWorkspaceInvites: checked })
                }
              />
              <SettingsSwitch
                label="Квесты, сундуки и достижения"
                description="Колокол в шапке."
                checked={notificationSettings.inAppGamification}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) =>
                  setNotificationSettings({ inAppGamification: checked })
                }
              />
              <SettingsSwitch
                label="Упоминания (@)"
                description="Колокол в шапке."
                checked={notificationSettings.inAppMentions}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ inAppMentions: checked })}
              />
              <SettingsSwitch
                label="Дедлайны карточек"
                description="Колокол в шапке."
                checked={notificationSettings.inAppDeadlines}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ inAppDeadlines: checked })}
              />
              <SettingsSwitch
                label="Назначение на карточку"
                description="Колокол в шапке."
                checked={notificationSettings.inAppAssign}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ inAppAssign: checked })}
              />
              <SettingsSwitch
                label="Друзья и рейды"
                description="Колокол в шапке."
                checked={notificationSettings.inAppSocial}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ inAppSocial: checked })}
              />
              <p className="trello-settings-card-hint">
                Всплывающие XP на доске — вкладка «Геймификация» (не дублируют колокол).
              </p>
              <p className="trello-settings-card-hint">
                Всплывающие уведомления браузера (нужна подписка ниже):
              </p>
              <SettingsSwitch
                label="Назначение на карточку"
                description="Всплывающее уведомление браузера."
                checked={notificationSettings.pushAssign}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ pushAssign: checked })}
              />
              <SettingsSwitch
                label="Упоминания (@)"
                description="Всплывающее уведомление браузера."
                checked={notificationSettings.pushMention}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) => setNotificationSettings({ pushMention: checked })}
              />
              <SettingsSwitch
                label="Заявки в друзья"
                description="Всплывающее уведомление браузера."
                checked={notificationSettings.pushFriendRequest}
                disabled={notificationMeta.saving || notificationMeta.loading}
                onChange={(checked) =>
                  setNotificationSettings({ pushFriendRequest: checked })
                }
              />
            </div>
            </article>
            {props.accessToken ? (
              <SettingsWebPushPanel accessToken={props.accessToken} />
            ) : null}
            </div>
          </div>
        );

      case 'gamification':
        return (
          <div className="trello-settings-section">
            <div className="trello-settings-cards">
              <article className="trello-settings-card">
                <div
                  className="trello-settings-switches"
                  aria-busy={gamificationMeta.loading || undefined}
                >
              <SettingsSwitch
                label="Анимация чекина при закрытии карточки"
                description="Счётчик серии 🔥 с прокруткой в уведомлении о чекине за день."
                checked={gamificationSettings.checkinAnimationOnCardClose}
                disabled={gamificationMeta.saving || gamificationMeta.loading}
                onChange={(checked) =>
                  setGamificationSettings({ checkinAnimationOnCardClose: checked })
                }
              />
              <SettingsSwitch
                label="Уведомления о получении опыта"
                description="Всплывающие сообщения с XP и HP после закрытия карточки."
                checked={gamificationSettings.xpGainNotifications}
                disabled={gamificationMeta.saving || gamificationMeta.loading}
                onChange={(checked) =>
                  setGamificationSettings({ xpGainNotifications: checked })
                }
              />
                </div>
              </article>
            </div>
          </div>
        );

      case 'privacy':
        return (
          <div className="trello-settings-section">
            <div className="trello-settings-cards">
              <article className="trello-settings-card">
                <div
                  className="trello-settings-switches"
                  aria-busy={privacyMeta.loading || undefined}
                >
              <SettingsSwitch
                label="Показывать персонажа другим"
                description="Если выключено, коллеги не откроют страницу персонажа и не увидят кнопку «Персонаж»."
                checked={privacySettings.allowCharacterView}
                disabled={privacyMeta.saving || privacyMeta.loading}
                onChange={(checked) => setPrivacySettings({ allowCharacterView: checked })}
              />
              <SettingsSwitch
                label="Показывать аватар аккаунта в профиле"
                description="Фото аккаунта на странице участника; при выключении — инициалы."
                checked={privacySettings.showAccountAvatarOnPublicProfile}
                disabled={privacyMeta.saving || privacyMeta.loading}
                onChange={(checked) =>
                  setPrivacySettings({ showAccountAvatarOnPublicProfile: checked })
                }
              />
              <SettingsSwitch
                label="Статус «в сети» для друзей"
                description="Друзья видят онлайн и время последней активности в списке."
                checked={privacySettings.showOnlineStatusToFriends}
                disabled={privacyMeta.saving || privacyMeta.loading}
                onChange={(checked) =>
                  setPrivacySettings({ showOnlineStatusToFriends: checked })
                }
              />
                </div>
              </article>
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  return (
    <div className="px-page settings-page">
      <header className="px-topbar">
        <div className="px-topbar-left">
          <h1 className="px-topbar-title">Настройки</h1>
        </div>
      </header>

      <div className="px-content settings-page-content">
        {msg ? <div className="trello-banner trello-banner-warn">{msg}</div> : null}

        <div className="trello-settings-layout">
          <nav
            className="trello-settings-nav-panel"
            aria-label="Разделы настроек"
            role="tablist"
          >
            {SETTINGS_TABS.map((key) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  id={`settings-tab-${key}`}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`settings-tabpanel-${key}`}
                  className={[
                    'trello-settings-tab',
                    isActive ? 'trello-settings-tab--active' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => selectTab(key)}
                >
                  {SETTINGS_TAB_LABELS[key]}
                </button>
              );
            })}
          </nav>

          <div
            className="trello-settings-content-panel"
            id={`settings-tabpanel-${tab}`}
            role="tabpanel"
            aria-labelledby={`settings-tab-${tab}`}
          >
            {renderTabContent(tab)}
          </div>
        </div>
      </div>
    </div>
  );
}
