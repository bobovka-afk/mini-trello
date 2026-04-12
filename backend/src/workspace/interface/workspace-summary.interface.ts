import type { WorkspaceRole } from '../../generated/prisma/enums';

export interface WorkspaceSummary {
  id: number;
  name: string;
  description: string | null;
  myRole: WorkspaceRole | null;
}
