import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import type { Board } from '../generated/prisma/client';

@Injectable()
export class BoardService {
    constructor(private readonly prisma: PrismaService) {}


    async createBoard(
        workspaceId: number,
        dto: CreateBoardDto,
    ): Promise<Board> {
        return this.prisma.board.create({
            data: {
                name: dto.name,
                description: dto.description,
                position: dto.position,
                workspaceId,
            },
        });
    }

    async getBoard(boardId: number): Promise<Board> {
        const board = await this.prisma.board.findUnique({
            where: { id: boardId },
        });

        if (!board) {
            throw new NotFoundException({
                code: 'BOARD_NOT_FOUND',
                message: 'Board not found',
            });
        }

        return board;
    }

    async getBoards(workspaceId: number): Promise<Board[]> {
        return this.prisma.board.findMany({
            where: {
                workspaceId: workspaceId,
            },
            orderBy: { position: 'asc' },
        });
    }

    async updateBoard(
        boardId: number,
        dto: UpdateBoardDto,
    ): Promise<Board> {
        if (dto.name === undefined && dto.description === undefined) {
            throw new BadRequestException({
                code: 'BOARD_UPDATE_FIELDS_REQUIRED',
                message: 'Provide at least one field: name or description',
            });
        }

        return this.prisma.board.update({
            where: { id: boardId },
            data: {
              name: dto.name,
              description: dto.description,
            },
          });
    }

    async deleteBoard(boardId: number): Promise<{ ok: boolean }> {
        await this.prisma.board.delete({
            where: { id: boardId },
        });
        return { ok: true };
    }
}
