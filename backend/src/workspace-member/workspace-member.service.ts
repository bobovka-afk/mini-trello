import { ForbiddenException, Injectable } from '@nestjs/common';
import type { WorkspaceMember } from '../generated/prisma/client';
import { WorkspaceActivityType, WorkspaceRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceActivityService } from '../workspace-activity/workspace-activity.service';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import type { WorkspaceMemberWithUser } from './interface';

@Injectable()
export class WorkspaceMemberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workspaceActivityService: WorkspaceActivityService,
  ) {}

  async getWorkspaceMembers(
    workspaceId: number,
    paginationDto: PaginationDto,
  ): Promise<WorkspaceMemberWithUser[]> {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            avatarPath: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: paginationDto.limit,
      skip: paginationDto.offset,
    });
  }

  async deleteWorkspaceMember(
    workspaceId: number,
    memberId: number,
    actorUserId: number,
  ): Promise<{ ok: boolean }> {
    await this.prisma.$transaction(async (tx) => {
      const targetMember = await tx.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: memberId,
          },
        },
        include: {
          user: { select: { email: true, name: true } },
        },
      });

      if (!targetMember) {
        throw new ForbiddenException({
          code: 'WORKSPACE_MEMBER_REQUIRED',
          message: 'You are not a member of this workspace',
        });
      }

      if (targetMember.role === WorkspaceRole.OWNER) {
        throw new ForbiddenException({
          code: 'WORKSPACE_OWNER_CANNOT_BE_REMOVED',
          message:
            'You cannot remove workspace OWNER. Transfer ownership first.',
        });
      }

      await tx.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: memberId,
          },
        },
      });

      await this.workspaceActivityService.record(tx, {
        workspaceId,
        actorUserId,
        type: WorkspaceActivityType.MEMBER_REMOVED,
        payload: {
          removedUserId: memberId,
          removedUserEmail: targetMember.user.email,
          removedUserName: targetMember.user.name,
        },
      });
    });

    return { ok: true };
  }

  async leaveWorkspace(
    userId: number,
    workspaceId: number,
  ): Promise<{ ok: boolean }> {
    await this.prisma.$transaction(async (tx) => {
      await this.workspaceActivityService.record(tx, {
        workspaceId,
        actorUserId: userId,
        type: WorkspaceActivityType.MEMBER_LEFT,
        payload: {},
      });

      await tx.workspaceMember.delete({
        where: {
          workspaceId_userId: {
            userId,
            workspaceId,
          },
        },
      });
    });

    return { ok: true };
  }

  private async getWorkspaceMemberOrThrow(
    workspaceId: number,
    userId: number,
  ): Promise<WorkspaceMember> {
    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });
    if (!member) {
      throw new ForbiddenException({
        code: 'WORKSPACE_MEMBER_REQUIRED',
        message: 'You are not a member of this workspace',
      });
    }
    return member;
  }
}
