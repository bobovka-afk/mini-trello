import type {
  WorkspaceInviteStatus,
  WorkspaceRole,
} from '../../generated/prisma/enums';

export interface InviteForEmailAccess {
  id: number;
  email: string;
  workspaceId: number;
  role: WorkspaceRole;
  status: WorkspaceInviteStatus;
  expiresAt: Date;
}
