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
