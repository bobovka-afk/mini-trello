import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: { id?: number } }>();
    const userId = req.user?.id;

    if (!userId) {
      throw new UnauthorizedException('Unauthorized');
    }

    const rawWorkspaceId = (req as any).params?.workspaceId;
    const workspaceId = Number(rawWorkspaceId);

    if (!Number.isInteger(workspaceId)) {
      throw new BadRequestException({
        code: 'WORKSPACE_ID_REQUIRED',
        message: 'workspaceId route param is required',
      });
    }

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true },
    });

    if (!workspace) {
      throw new NotFoundException({
        code: 'WORKSPACE_NOT_FOUND',
        message: 'Workspace not found',
      });
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { userId: true },
    });

    if (!member) {
      throw new ForbiddenException({
        code: 'WORKSPACE_MEMBER_REQUIRED',
        message: 'You are not a member of this workspace',
      });
    }

    return true;
  }
}
