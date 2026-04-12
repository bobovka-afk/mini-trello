import type { WorkspaceRole } from '../../generated/prisma/enums';

export interface UserWorkspaceRow {
  id: number;
  workspaceId: number;
  userId: number;
  role: WorkspaceRole;
  createdAt: Date;
  workspace: {
    id: number;
    name: string;
    description: string | null;
  };
}
