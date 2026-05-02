import { WorkspaceActivityType } from '../../generated/prisma/enums';
import { Prisma } from '../../generated/prisma/client';

export interface WorkspaceActivityListItem {
  id: number;
  type: WorkspaceActivityType;
  payload: Prisma.JsonValue;
  createdAt: Date;
  actor: {
    id: number;
    name: string;
    email: string;
  };
}
