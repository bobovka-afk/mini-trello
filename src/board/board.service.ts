import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
 

@Injectable()
export class BoardService {
    constructor(private readonly prisma: PrismaService) {}


    async createBoard(workspaceId: number, dto: CreateBoardDto) {
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

    async getBoard(workspaceId: number, boardId: number) {
        const board = await this.prisma.board.findFirst({
            where: { id: boardId, workspaceId },
        });

        if (!board) {
            this.throwBoardNotFound();
        }

        return board;
    }

    async getBoards(workspaceId: number) {
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
    ) {
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
    ): Promise<{ ok: boolean }> {
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
            this.throwBoardNotFound();
        }

        return board;
    }

    private throwBoardNotFound(): never {
        throw new NotFoundException({
            code: 'BOARD_NOT_FOUND',
            message: 'Board not found',
        });
    }

}
