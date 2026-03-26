import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { WorkspaceService } from '../workspace/workspace.service';
import { UpdateBoardDto } from './dto/update-board.dto';
 



@Injectable()
export class BoardService {
    constructor(private readonly prisma: PrismaService, private readonly workspaceService: WorkspaceService) {}


    async createBoard(workspaceId: number, dto: CreateBoardDto, userId: number) {
        await this.workspaceService.assertWorkspaceMember(workspaceId, userId);
        const board = await this.prisma.board.create({
            data: {
                name: dto.name,
                description: dto.description,
                position: dto.position,
                workspaceId,
            },
        });
        return board;
    }

    async getBoard(workspaceId: number, boardId: number, userId: number) {
        await this.workspaceService.assertWorkspaceMember(workspaceId, userId);

        const board = await this.prisma.board.findFirst({
            where: { id: boardId, workspaceId },
        });

        if (!board) {
            throw new NotFoundException({
                code: 'BOARD_NOT_FOUND',
                message: 'Board not found',
            });
        }

        return board;
    }

    async getBoards(workspaceId: number, userId: number) {
        await this.workspaceService.assertWorkspaceMember(workspaceId, userId);
        const boards = await this.prisma.board.findMany({
            where: {
                workspaceId: workspaceId,
            },
            orderBy: { position: 'asc' },
        });
        return boards;
    }

    async updateBoard(
        workspaceId: number,
        boardId: number,
        dto: UpdateBoardDto,
        userId: number,
    ) {
        await this.workspaceService.assertWorkspaceMember(workspaceId, userId);

        if (dto.name === undefined && dto.description === undefined) {
            throw new BadRequestException({
                code: 'BOARD_UPDATE_FIELDS_REQUIRED',
                message: 'Provide at least one field: name or description',
            });
        }

        await this.getBoardOrThrow(boardId, workspaceId);

        return this.prisma.board.update({
            where: { id: boardId },
            data: {
              name: dto.name,
              description: dto.description,
            },
          });
    }

    async deleteBoard(
        boardId: number,
        workspaceId: number,
        userId: number,
    ): Promise<{ ok: boolean }> {
        await this.workspaceService.assertWorkspaceMember(workspaceId, userId);

        await this.getBoardOrThrow(boardId, workspaceId);

        await this.prisma.board.delete({
            where: { id: boardId },
        });
        return { ok: true };
    }

    private async getBoardOrThrow(boardId: number, workspaceId: number) {
        const board = await this.prisma.board.findFirst({
            where: { id: boardId, workspaceId },
            select: { id: true },
        });

        if (!board) {
            throw new NotFoundException({
                code: 'BOARD_NOT_FOUND',
                message: 'Board not found',
            });
        }

        return board;
    }

}
