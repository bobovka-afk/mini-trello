import { parseSessionUserAgent, type UserSessionDto } from '@entities/user-settings';
import { formatDateTimeRuSettingsWithSeconds } from '@shared/lib/formatDateRu';

type Props = {
  sessions: UserSessionDto[];
  loading: boolean;
  sessionBusyId: string | null;
  revokeOthersBusy: boolean;
  onRevokeSession: (sessionId: string, isCurrent: boolean) => void;
  onRevokeOthers: () => void;
  onOpenSecurityLog?: () => void;
};

function SessionDeviceIcon() {
  return (
    <span className="trello-settings-session-icon" aria-hidden>
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
        <rect
          x="3"
          y="5"
          width="18"
          height="12"
          rx="2"
          stroke="currentColor"
          strokeWidth="1.75"
        />
        <path d="M8 20h8" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
        <path d="M10 17h4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export function SettingsSessionsPanel({
  sessions,
  loading,
  sessionBusyId,
  revokeOthersBusy,
  onRevokeSession,
  onRevokeOthers,
  onOpenSecurityLog,
}: Props) {
  const otherActiveCount = sessions.filter((s) => !s.isCurrent).length;

  return (
    <div className="trello-settings-section trello-settings-section--sessions">
      <div className="trello-settings-card-head-row">
        <h2 className="trello-settings-content-title">Активные сессии</h2>
        <div className="trello-settings-card-head-actions">
          {onOpenSecurityLog ? (
            <button
              type="button"
              className="trello-btn trello-btn-ghost trello-btn-sm"
              onClick={onOpenSecurityLog}
            >
              Журнал безопасности
            </button>
          ) : null}
          <button
            type="button"
            className="trello-btn trello-btn-ghost trello-btn-sm"
            disabled={revokeOthersBusy || loading || otherActiveCount === 0}
            onClick={onRevokeOthers}
          >
            {revokeOthersBusy ? '…' : 'Завершить все другие'}
          </button>
        </div>
      </div>

      {loading && sessions.length === 0 ? (
        <p className="trello-settings-card-hint trello-settings-session-placeholder">Загрузка…</p>
      ) : sessions.length === 0 ? (
        <p className="trello-settings-card-hint">Активных сессий пока нет.</p>
      ) : (
        <ul className="trello-settings-session-list trello-settings-session-list--detailed">
          {sessions.map((session) => {
            const { os, browser } = parseSessionUserAgent(session.userAgent, session.deviceLabel);
            const busy = sessionBusyId === session.id;

            return (
              <li key={session.id} className="trello-settings-session-item">
                <div className="trello-settings-session-row">
                  <SessionDeviceIcon />
                  <div className="trello-settings-session-platform">
                    <span className="trello-settings-session-os">{os}</span>
                    <span className="trello-settings-session-divider" aria-hidden />
                    <span className="trello-settings-session-browser">{browser}</span>
                    {session.isCurrent ? (
                      <span className="trello-settings-session-current">· текущая</span>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className="trello-settings-session-signout"
                    disabled={busy}
                    onClick={() => onRevokeSession(session.id, session.isCurrent)}
                  >
                    {busy ? '…' : 'Выйти'}
                  </button>
                </div>
                <p className="trello-settings-session-signed-on">
                  Вход: {formatDateTimeRuSettingsWithSeconds(session.createdAt)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
