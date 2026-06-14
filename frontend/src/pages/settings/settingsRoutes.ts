export type SettingsTab =
  | 'account'
  | 'security'
  | 'sessions'
  | 'notifications'
  | 'gamification'
  | 'privacy';

const TAB_ROUTES: Record<SettingsTab, string> = {
  account: '/settings/account',
  security: '/settings/security',
  sessions: '/settings/sessions',
  notifications: '/settings/notifications',
  gamification: '/settings/gamification',
  privacy: '/settings/privacy',
};

export const SETTINGS_TABS: SettingsTab[] = [
  'account',
  'security',
  'sessions',
  'notifications',
  'gamification',
  'privacy',
];

export function parseSettingsTabFromRoute(route: string): SettingsTab {
  if (route.startsWith('/settings/gamification')) return 'gamification';
  if (route.startsWith('/settings/account') || route.startsWith('/settings/data')) {
    return 'account';
  }
  if (route.startsWith('/settings/security')) return 'security';
  if (route.startsWith('/settings/sessions')) return 'sessions';
  if (route.startsWith('/settings/notifications')) return 'notifications';
  if (route.startsWith('/settings/privacy')) return 'privacy';
  if (route === '/settings' || route.startsWith('/settings/')) return 'account';
  return 'account';
}

export function settingsRouteForTab(tab: SettingsTab): string {
  return TAB_ROUTES[tab];
}

/** Updates the settings sub-route without triggering a full SPA navigation. */
export function replaceSettingsTabInUrl(tab: SettingsTab): void {
  const path = settingsRouteForTab(tab);
  const next = `${path}${window.location.search}${window.location.hash}`;
  if (`${window.location.pathname}${window.location.search}${window.location.hash}` === next) {
    return;
  }
  window.history.replaceState({}, '', next);
}

export const SETTINGS_TAB_LABELS: Record<SettingsTab, string> = {
  account: 'Аккаунт',
  security: 'Безопасность',
  sessions: 'Сессии',
  notifications: 'Уведомления',
  gamification: 'Геймификация',
  privacy: 'Конфиденциальность',
};
