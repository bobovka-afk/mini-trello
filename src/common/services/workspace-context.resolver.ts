import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class WorkspaceContextResolver {
  constructor(private readonly prisma: PrismaService) {}

  async byWorkspaceIdOrThrow(workspaceId: number): Promise<number> {
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

    return workspace.id;
  }

  async byBoardIdOrThrow(boardId: number): Promise<number> {
    const board = await this.prisma.board.findUnique({
      where: { id: boardId },
      select: { workspaceId: true },
    });

    if (!board) {
      throw new NotFoundException({
        code: 'BOARD_NOT_FOUND',
        message: 'Board not found',
      });
    }

    return board.workspaceId;
  }

  async byListIdOrThrow(listId: number): Promise<number> {
    const list = await this.prisma.list.findUnique({
      where: { id: listId },
      select: {
        board: {
          select: { workspaceId: true },
        },
      },
    });

    if (!list) {
      throw new NotFoundException({
        code: 'LIST_NOT_FOUND',
        message: 'List not found',
      });
    }

    return list.board.workspaceId;
  }

  async byCardIdOrThrow(cardId: number): Promise<number> {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: {
        list: {
          select: {
            board: { select: { workspaceId: true } },
          },
        },
      },
    });

    if (!card) {
      throw new NotFoundException({
        code: 'CARD_NOT_FOUND',
        message: 'Card not found',
      });
    }

    return card.list.board.workspaceId;
  }
}
