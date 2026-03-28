export function formatWorkspaceRole(role: string): string {
  switch (role) {
    case 'OWNER':
      return 'Владелец';
    case 'ADMIN':
      return 'Администратор';
    case 'MEMBER':
      return 'Участник';
    default:
      return role;
  }
}

/** Создание досок, колонок и правка — только владелец и администратор. */
export function canManageWorkspace(role: string | null | undefined): boolean {
  return role === 'OWNER' || role === 'ADMIN';
}
