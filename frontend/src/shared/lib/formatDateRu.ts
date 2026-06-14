const MONTH_SHORT_RU = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'ноя',
  'дек',
] as const;

const MONTH_GENITIVE_RU = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
] as const;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseDate(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function localParts(date: Date): { day: number; month: number; year: number; hour: number; minute: number } {
  return {
    day: date.getDate(),
    month: date.getMonth(),
    year: date.getFullYear(),
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
}

function partsInTimeZone(
  iso: string,
  timeZone: string,
): { day: number; month: number; year: number; hour: number; minute: number } | null {
  const date = parseDate(iso);
  if (!date) return null;

  try {
    const formatted = new Intl.DateTimeFormat('ru-RU', {
      timeZone,
      day: 'numeric',
      month: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);

    const read = (type: Intl.DateTimeFormatPartTypes): number => {
      const value = formatted.find((part) => part.type === type)?.value ?? '';
      return Number.parseInt(value, 10);
    };

    return {
      day: read('day'),
      month: read('month') - 1,
      year: read('year'),
      hour: read('hour'),
      minute: read('minute'),
    };
  } catch {
    return localParts(date);
  }
}

/** 8 июн 01:09 */
export function formatDateTimeRu(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  const { day, month, hour, minute } = localParts(date);
  return `${day} ${MONTH_SHORT_RU[month]} ${pad2(hour)}:${pad2(minute)}`;
}

/** 08.06.2026, 19:52 — settings / sessions */
export function formatDateTimeRuSettings(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  const { day, month, year, hour, minute } = localParts(date);
  return `${pad2(day)}.${pad2(month + 1)}.${year}, ${pad2(hour)}:${pad2(minute)}`;
}

/** 08.06.2026, 19:52:03 — session signed-on */
export function formatDateTimeRuSettingsWithSeconds(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  const { day, month, year, hour, minute } = localParts(date);
  const seconds = date.getSeconds();
  return `${pad2(day)}.${pad2(month + 1)}.${year}, ${pad2(hour)}:${pad2(minute)}:${pad2(seconds)}`;
}

/** 8 июн 2026 01:09 */
export function formatDateTimeRuWithYear(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  const { day, month, year, hour, minute } = localParts(date);
  return `${day} ${MONTH_SHORT_RU[month]} ${year} ${pad2(hour)}:${pad2(minute)}`;
}

/** 8 июня 2026 01:09 */
export function formatDateRuLong(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  const { day, month, year, hour, minute } = localParts(date);
  return `${day} ${MONTH_GENITIVE_RU[month]} ${year} ${pad2(hour)}:${pad2(minute)}`;
}

/** 8 июня 2026 */
export function formatRegisteredRu(iso: string): string {
  const date = parseDate(iso);
  if (!date) return iso;
  const { day, month, year } = localParts(date);
  return `${day} ${MONTH_GENITIVE_RU[month]} ${year}`;
}

/** Сброс игровых суток в заданном часовом поясе: 8 июн 01:09 */
export function formatDateTimeRuInTimeZone(iso: string, timeZone: string): string {
  const parts = partsInTimeZone(iso, timeZone);
  if (!parts) return iso;
  return `${parts.day} ${MONTH_SHORT_RU[parts.month]} ${pad2(parts.hour)}:${pad2(parts.minute)}`;
}
