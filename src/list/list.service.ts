import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';

@Injectable()
export class ListService {
    constructor(private readonly prisma: PrismaService) {}

    private async assertBoardInWorkspace(boardId: number, workspaceId: number) {
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
    }

    private async getListOrThrow(
        listId: number,
        boardId: number,
        workspaceId: number,
    ) {
        const list = await this.prisma.list.findFirst({
            where: {
                id: listId,
                boardId,
                board: { workspaceId },
            },
        });
        if (!list) {
            throw new NotFoundException({
                code: 'LIST_NOT_FOUND',
                message: 'List not found',
            });
        }
        return list;
    }

    async getLists(workspaceId: number, boardId: number) {
        await this.assertBoardInWorkspace(boardId, workspaceId);

        return this.prisma.list.findMany({
            where: { boardId },
            orderBy: { position: 'asc' },
        });
    }

    async createList(
        workspaceId: number,
        boardId: number,
        dto: CreateListDto,
    ) {
        await this.assertBoardInWorkspace(boardId, workspaceId);

        const position =
            dto.position !== undefined
                ? dto.position
                : (
                      (await this.prisma.list.aggregate({
                          where: { boardId },
                          _max: { position: true },
                      }))._max.position ?? -1
                  ) + 1;

        return this.prisma.list.create({
            data: {
                name: dto.name,
                boardId,
                position,
                ...(dto.colorPreset !== undefined
                    ? { colorPreset: dto.colorPreset }
                    : {}),
            },
        });
    }

    async updateList(
        workspaceId: number,
        boardId: number,
        listId: number,
        dto: UpdateListDto,
    ) {
        await this.assertBoardInWorkspace(boardId, workspaceId);

        if (dto.name === undefined && dto.colorPreset === undefined) {
            throw new BadRequestException({
                code: 'LIST_UPDATE_FIELDS_REQUIRED',
                message: 'Provide at least one field: name or colorPreset',
            });
        }

        await this.getListOrThrow(listId, boardId, workspaceId);

        return this.prisma.list.update({
            where: { id: listId },
            data: {
                name: dto.name,
                colorPreset: dto.colorPreset,
            },
        });
    }
}
