import { ForbiddenException, Injectable } from '@nestjs/common';
import { WorkspaceRole } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { PaginationDto } from '../workspace/dto/pagination.dto';

@Injectable()
export class WorkspaceMembersService {
  constructor(private readonly prisma: PrismaService) {}

  async getWorkspaceMembers(
    workspaceId: number,
    paginationDto: PaginationDto,
  ) {
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
  ): Promise<{ ok: boolean }> {
    const targetMember = await this.getWorkspaceMemberOrThrow(
      workspaceId,
      memberId,
    );
    if (targetMember.role === WorkspaceRole.OWNER) {
      throw new ForbiddenException({
        code: 'WORKSPACE_OWNER_CANNOT_BE_REMOVED',
        message: 'You cannot remove workspace OWNER. Transfer ownership first.',
      });
    }

    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberId,
        },
      },
    });

    return { ok: true };
  }

  async leaveWorkspace(userId: number, workspaceId: number): Promise<{ ok: boolean }> {
    await this.prisma.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          userId,
          workspaceId,
        },
      },
    });

    return { ok: true };
  }

  private async getWorkspaceMemberOrThrow(
    workspaceId: number,
    userId: number,
  ) {
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
