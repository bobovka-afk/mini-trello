import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { MoveListDto } from './dto/move-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import type { List } from '../generated/prisma/client';

@Injectable()
export class ListService {
    constructor(private readonly prisma: PrismaService) {}



    async getLists(boardId: number): Promise<List[]> {
        return this.prisma.list.findMany({
            where: { boardId },
            orderBy: { position: 'asc' },
        });
    }

    async createList(boardId: number, dto: CreateListDto): Promise<List> {
        return this.prisma.list.create({
            data: {
                name: dto.name,
                boardId,
                position: dto.position,
            },
        });
    }

    async updateList(listId: number, dto: UpdateListDto): Promise<List> {
        if (dto.name === undefined && dto.colorPreset === undefined) {
            throw new BadRequestException({
                code: 'LIST_UPDATE_FIELDS_REQUIRED',
                message: 'Provide at least one field: name or colorPreset',
            });
        }

        return this.prisma.list.update({
            where: { id: listId },
            data: {
                name: dto.name,
                colorPreset: dto.colorPreset,
            },
        });
    }

    async deleteList(listId: number): Promise<{ ok: boolean }> {
        await this.prisma.list.delete({
            where: { id: listId },
        });
        return { ok: true };
    }

    async moveList(listId: number, dto: MoveListDto): Promise<List | null> {
        return this.prisma.$transaction(async (tx) => {
            const list = await tx.list.findUnique({
                where: { id: listId },
                select: { id: true, boardId: true },
            });

            if (!list) {
                throw new NotFoundException({
                    code: 'LIST_NOT_FOUND',
                    message: 'List not found',
                });
            }

            const boardLists = await tx.list.findMany({
                where: { boardId: list.boardId },
                orderBy: { position: 'asc' },
                select: { id: true },
            });

            const ids = boardLists.map((l) => l.id);
            const withoutMoved = ids.filter((id) => id !== listId);
            const insertAt = Math.min(
                Math.max(0, dto.position),
                withoutMoved.length,
            );
            const newOrder = [
                ...withoutMoved.slice(0, insertAt),
                listId,
                ...withoutMoved.slice(insertAt),
            ];

            for (let i = 0; i < newOrder.length; i++) {
                await tx.list.update({
                    where: { id: newOrder[i] },
                    data: { position: i },
                });
            }

            return tx.list.findUnique({ where: { id: listId } });
        });
    }
}
