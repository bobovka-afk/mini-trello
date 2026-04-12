import type { WorkspaceRole } from '../../generated/prisma/enums';

export interface MyWorkspaceInviteRow {
  id: number;
  role: WorkspaceRole;
  expiresAt: Date;
  createdAt: Date;
  workspace: {
    name: string;
  };
  invitedBy: {
    name: string;
    email: string;
  };
}
