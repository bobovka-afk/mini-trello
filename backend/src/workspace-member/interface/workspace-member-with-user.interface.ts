import type { WorkspaceRole } from '../../generated/prisma/enums';
import type { UserBrief } from '../../common/interface';

export interface WorkspaceMemberWithUser {
  id: number;
  workspaceId: number;
  userId: number;
  role: WorkspaceRole;
  createdAt: Date;
  user: UserBrief;
}
