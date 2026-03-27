import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { PrismaService } from '../../prisma/prisma.service';
import { WORKSPACE_ROLES_KEY } from '../decorators/workspace-roles.decorator';

@Injectable()
export class WorkspaceRoleGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowedRoles = this.reflector.getAllAndOverride<WorkspaceRole[]>(
      WORKSPACE_ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!allowedRoles || allowedRoles.length === 0) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request & { user?: { id?: number } }>();
    const userId = req.user!.id!;
    const workspaceId = Number((req as any).params.workspaceId);

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { role: true },
    });

    if (!member || !allowedRoles.includes(member.role as WorkspaceRole)) {
      throw new ForbiddenException({
        code: 'WORKSPACE_ACTION_FORBIDDEN',
        message: 'You do not have permission to access this workspace',
      });
    }

    return true;
  }
}