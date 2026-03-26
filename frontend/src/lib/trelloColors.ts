/** Matches backend `ListColorPreset` — for column headers */
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

export function listHeaderColor(preset: string | null | undefined): string {
  if (!preset) return LIST_PRESET_HEX.GRAY;
  return LIST_PRESET_HEX[preset] ?? LIST_PRESET_HEX.GRAY;
}
