import type { WorkspaceRole } from '../../generated/prisma/enums';

export interface WorkspaceInviteListItem {
  id: number;
  email: string;
  role: WorkspaceRole;
  expiresAt: Date;
  createdAt: Date;
  invitedBy: {
    id: number;
    email: string;
  };
}
