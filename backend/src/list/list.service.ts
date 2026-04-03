import {
    BadRequestException,
    Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';

@Injectable()
export class ListService {
    constructor(private readonly prisma: PrismaService) {}



    async getLists(boardId: number) {
        return this.prisma.list.findMany({
            where: { boardId },
            orderBy: { position: 'asc' },
        });
    }

    async createList(boardId: number, dto: CreateListDto) {
        return this.prisma.list.create({
            data: {
                name: dto.name,
                boardId,
                position: dto.position,
            },
        });
    }

    async updateList(listId: number, dto: UpdateListDto) {
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
}
