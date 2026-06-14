import type { ReactNode } from 'react';
import type { CharacterDto } from '@entities/character';
import { CHARACTER_HEALTH_MAX, MANA_MAX } from '@entities/reward';
import { healthStatIconUrl, levelStatIconUrl, manaStatIconUrl, xpToastIconUrl } from '@shared/assets/uiAssets';
import { DustIcon } from '@widgets/dust/icon/DustIcon';

type XpToward = {
  atMaxLevel: boolean;
  into?: number;
  needed?: number;
  pct: number;
};

type Props = {
  character: CharacterDto;
  xpToward: XpToward;
  /** full — уровень, опыт, здоровье, мана; sidebar — HP; detail — 2×2; compact — 4 в ряд; dashboard — 2×2, короткие подписи */
  variant?: 'full' | 'sidebar' | 'detail' | 'compact' | 'dashboard';
};

function statVisible(
  variant: 'full' | 'sidebar' | 'detail' | 'compact' | 'dashboard',
  stat: 'level' | 'xp' | 'health' | 'mana' | 'dust',
): boolean {
  if (variant === 'full') return stat !== 'dust';
  if (variant === 'sidebar') return stat === 'health';
  if (variant === 'compact' || variant === 'dashboard') return stat !== 'dust';
  return stat === 'level' || stat === 'xp' || stat === 'health' || stat === 'mana';
}

function useCompactLabels(variant: Props['variant']): boolean {
  return variant === 'compact' || variant === 'dashboard';
}
function StatLabel({
  compact,
  iconUrl,
  icon,
  label,
}: {
  compact: boolean;
  iconUrl?: string;
  icon?: ReactNode;
  label: string;
}) {
  if (compact) {
    return <span className="trello-character-stat-label">{label}</span>;
  }
  return (
    <div className="trello-character-stat-label-row">
      <span className="trello-character-stat-icon-wrap" aria-hidden>
        {icon ?? (
          <img src={iconUrl} alt="" className="trello-character-stat-icon" loading="lazy" />
        )}
      </span>
      <span className="trello-character-stat-label">{label}</span>
    </div>
  );
}

export function CharacterStatsPanel({ character, xpToward, variant = 'full' }: Props) {
  const exhausted = character.health <= 0;
  const compact = useCompactLabels(variant);
  const rowClass =
    variant === 'sidebar'
      ? 'trello-character-stat-row trello-character-stat-row--sidebar'
      : variant === 'detail' || variant === 'dashboard'
        ? 'trello-character-stat-row trello-character-stat-row--detail'
        : variant === 'compact'
          ? 'trello-character-stat-row trello-character-stat-row--compact'
          : 'trello-character-stat-row';

  return (
    <div
      className={
        exhausted
          ? 'trello-character-stats-panel trello-character-stats-panel--exhausted'
          : 'trello-character-stats-panel'
      }
    >
      <div className={rowClass}>
        {statVisible(variant, 'level') ? (
        <div className="trello-character-stat-pill trello-character-stat-pill--level">
          <StatLabel compact={compact} iconUrl={levelStatIconUrl()} label={compact ? 'Уровень' : 'УРОВЕНЬ'} />
          <div
            className="trello-character-stat-meter"
            role="img"
            aria-label={`Уровень ${character.level}`}
          >
            <div
              className="trello-character-stat-bar-fill trello-character-stat-bar-fill--level"
              style={{ width: '100%' }}
              aria-hidden
            />
            <span className="trello-character-stat-meter-value">{character.level}</span>
          </div>
        </div>
        ) : null}
        {statVisible(variant, 'xp') ? (
        <div className="trello-character-stat-pill trello-character-stat-pill--xp">
          <StatLabel compact={compact} iconUrl={xpToastIconUrl()} label={compact ? 'Опыт' : 'ОПЫТ'} />
          <div
            className="trello-character-stat-meter"
            role="img"
            aria-label={
              xpToward.atMaxLevel
                ? 'Опыт: максимальный уровень'
                : `Опыт ${xpToward.into ?? 0} из ${xpToward.needed ?? 0}`
            }
          >
            <div
              className="trello-character-stat-bar-fill trello-character-stat-bar-fill--xp"
              style={{ width: `${xpToward.pct}%` }}
              aria-hidden
            />
            <span className="trello-character-stat-meter-value trello-character-stat-meter-value--xp">
              {xpToward.atMaxLevel ? (
                <>Макс. уровень</>
              ) : compact ? (
                <>
                  {xpToward.into ?? 0}/{xpToward.needed ?? 0}
                </>
              ) : (
                <>
                  {xpToward.into ?? 0} / {xpToward.needed ?? 0}
                </>
              )}
            </span>
          </div>
        </div>
        ) : null}
        {statVisible(variant, 'health') ? (
        <div
          className={
            exhausted
              ? 'trello-character-stat-pill trello-character-stat-pill--health trello-character-stat-pill--health-exhausted'
              : 'trello-character-stat-pill trello-character-stat-pill--health'
          }
        >
          <StatLabel compact={compact} iconUrl={healthStatIconUrl()} label={compact ? 'Здоровье' : 'ЗДОРОВЬЕ'} />
          <div
            className="trello-character-stat-meter"
            role="img"
            aria-label={`Здоровье ${character.health}`}
          >
            <div
              className="trello-character-stat-bar-fill trello-character-stat-bar-fill--health"
              style={{
                width: `${Math.min(100, Math.round((character.health / CHARACTER_HEALTH_MAX) * 100))}%`,
              }}
              aria-hidden
            />
            <span className="trello-character-stat-meter-value">{character.health}</span>
          </div>
        </div>
        ) : null}
        {statVisible(variant, 'mana') ? (
        <div className="trello-character-stat-pill trello-character-stat-pill--mana">
          <StatLabel compact={compact} iconUrl={manaStatIconUrl()} label={compact ? 'Мана' : 'МАНА'} />
          <div
            className="trello-character-stat-meter"
            role="img"
            aria-label={`Мана ${character.manaCurrent ?? 0} из ${MANA_MAX}`}
          >
            <div
              className="trello-character-stat-bar-fill trello-character-stat-bar-fill--mana"
              style={{
                width: `${Math.min(100, Math.round(((character.manaCurrent ?? 0) / MANA_MAX) * 100))}%`,
              }}
              aria-hidden
            />
            <span className="trello-character-stat-meter-value">
              {character.manaCurrent ?? 0}/{MANA_MAX}
            </span>
          </div>
        </div>
        ) : null}
        {statVisible(variant, 'dust') ? (
        <div className="trello-character-stat-pill trello-character-stat-pill--dust">
          <div className="trello-character-stat-label-row">
            <span className="trello-character-stat-icon-wrap" aria-hidden>
              <DustIcon className="trello-character-stat-icon" />
            </span>
            <span className="trello-character-stat-label">ПЫЛЬ</span>
          </div>
          <div
            className="trello-character-stat-meter trello-character-stat-meter--dust"
            role="img"
            aria-label={`Пыль ${character.dust}`}
          >
            <span className="trello-character-stat-meter-value trello-character-stat-meter-value--dust">
              {character.dust}
            </span>
          </div>
        </div>
        ) : null}
      </div>
    </div>
  );
}