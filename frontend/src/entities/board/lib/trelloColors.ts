/** Matches backend `ListColorPreset` — saturated header bar on neutral column (dark theme) */
export const LIST_PRESET_HEX: Record<string, string> = {
  GREEN: '#226D43',
  YELLOW: '#9A7903',
  ORANGE: '#AC541A',
  RED: '#B1302A',
  PURPLE: '#8341A8',
  BLUE: '#1A65D1',
  TEAL: '#237188',
  OLIVE: '#526D20',
  BROWN: '#994474',
  GRAY: '#676A6C',
};

/** Lighter list chrome for light theme — slightly darker than Trello default so columns aren’t washed out on cream boards */
export const LIST_PRESET_HEX_LIGHT: Record<string, string> = {
  GRAY: '#C5CAD3',
};

/** Preset keys in backend enum order for selects */
export const LIST_COLOR_PRESET_KEYS = [
  'GRAY',
  'GREEN',
  'YELLOW',
  'ORANGE',
  'RED',
  'PURPLE',
  'BLUE',
  'TEAL',
  'OLIVE',
  'BROWN',
] as const;

export type ListColorPresetKey = (typeof LIST_COLOR_PRESET_KEYS)[number];

export const LIST_COLOR_LABELS: Record<string, string> = {
  GRAY: 'Серый',
  GREEN: 'Зелёный',
  YELLOW: 'Жёлтый',
  ORANGE: 'Оранжевый',
  RED: 'Красный',
  PURPLE: 'Фиолетовый',
  BLUE: 'Синий',
  TEAL: 'Бирюзовый',
  OLIVE: 'Оливковый',
  BROWN: 'Коричневый',
};

function normalizePreset(preset: string | null | undefined): string {
  return (preset || 'GRAY').toUpperCase();
}

export function isDarkTheme(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.classList.contains('theme-dark');
}

/** Gray columns use pale chrome in light theme (CSS override), dark hex inline otherwise. */
export function listUsesLightChrome(
  preset: string | null | undefined,
  isDark: boolean = isDarkTheme(),
): boolean {
  return !isDark && normalizePreset(preset) === 'GRAY';
}

export function listHeaderColor(preset: string | null | undefined): string {
  const key = normalizePreset(preset);
  return LIST_PRESET_HEX[key] ?? LIST_PRESET_HEX.GRAY;
}

/** Column body chrome (fades, gray columns in light theme). */
export function listColumnChromeColor(
  preset: string | null | undefined,
  isDark: boolean = isDarkTheme(),
): string {
  const key = normalizePreset(preset);
  if (!isDark && key === 'GRAY') {
    return LIST_PRESET_HEX_LIGHT.GRAY;
  }
  return LIST_PRESET_HEX[key] ?? LIST_PRESET_HEX.GRAY;
}
