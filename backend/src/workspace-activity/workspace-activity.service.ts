import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceActivityType } from '../generated/prisma/enums';
import { Prisma } from '../generated/prisma/client';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import type { WorkspaceActivityListItem } from './interface';

@Injectable()
export class WorkspaceActivityService {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    db: Pick<PrismaService, 'workspaceActivity'>,
    input: {
      workspaceId: number;
      actorUserId: number;
      type: WorkspaceActivityType;
      payload: Prisma.InputJsonValue;
    },
  ): Promise<void> {
    await db.workspaceActivity.create({
      data: {
        workspaceId: input.workspaceId,
        actorUserId: input.actorUserId,
        type: input.type,
        payload: input.payload,
      },
    });
  }

  async listByWorkspace(
    workspaceId: number,
    pagination: PaginationDto,
  ): Promise<WorkspaceActivityListItem[]> {
    return this.prisma.workspaceActivity.findMany({
      where: { workspaceId },
      select: {
        id: true,
        type: true,
        payload: true,
        createdAt: true,
        actor: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: pagination.limit,
      skip: pagination.offset,
    });
  }
}
