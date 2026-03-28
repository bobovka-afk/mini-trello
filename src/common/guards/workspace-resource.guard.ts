import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { WorkspaceContextResolver } from '../services/workspace-context.resolver';

@Injectable()
export class WorkspaceResourceGuard implements CanActivate {
  constructor(private readonly workspaceContextResolver: WorkspaceContextResolver) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<{ params?: Record<string, string>; workspaceId?: number }>();

    const workspaceId = req.workspaceId!;

    const params = req.params ?? {};
    const resolvedWorkspaceId = await this.resolveWorkspaceIdFromParams(params);

    if (resolvedWorkspaceId === null) {
      return true;
    }

    if (resolvedWorkspaceId !== workspaceId) {
      throw new ForbiddenException({
        code: 'RESOURCE_WORKSPACE_MISMATCH',
        message: 'Resource does not belong to this workspace',
      });
    }

    return true;
  }

  private async resolveWorkspaceIdFromParams(params: Record<string, string>): Promise<number | null> {
    if (params.listId !== undefined) {
      const listId = Number(params.listId);
      if (!Number.isInteger(listId)) {
        throw new BadRequestException({
          code: 'LIST_ID_REQUIRED',
          message: 'listId route param is required',
        });
      }
      return this.workspaceContextResolver.byListIdOrThrow(listId);
    }

    if (params.boardId !== undefined) {
      const boardId = Number(params.boardId);
      if (!Number.isInteger(boardId)) {
        throw new BadRequestException({
          code: 'BOARD_ID_REQUIRED',
          message: 'boardId route param is required',
        });
      }
      return this.workspaceContextResolver.byBoardIdOrThrow(boardId);
    }

    if (params.cardId !== undefined) {
      const cardId = Number(params.cardId);
      if (!Number.isInteger(cardId)) {
        throw new BadRequestException({
          code: 'CARD_ID_REQUIRED',
          message: 'cardId route param is required',
        });
      }
      return this.workspaceContextResolver.byCardIdOrThrow(cardId);
    }

    return null;
  }
}
