import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCardDto } from './dto/create-card.dto';
import { MoveCardDto } from './dto/move-card.dto';
import { SetCardCompletionDto } from './dto/set-card-completion.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import type { Card } from '../generated/prisma/client';

@Injectable()
export class CardService {
  constructor(private readonly prisma: PrismaService) {}

  async getCards(listId: number): Promise<Card[]> {
    return this.prisma.card.findMany({
      where: { listId },
      orderBy: { position: 'asc' },
    });
  }

  async createCard(listId: number, dto: CreateCardDto): Promise<Card> {
    return this.prisma.card.create({
      data: {
        listId,
        title: dto.title,
        description: dto.description,
        position: dto.position,
        dueDate: dto.dueDate,
        assigneeId: dto.assigneeId,
      },
    });
  }

  async updateCard(cardId: number, dto: UpdateCardDto): Promise<Card> {
    if (
      dto.title === undefined &&
      dto.description === undefined &&
      dto.position === undefined &&
      dto.dueDate === undefined &&
      dto.assigneeId === undefined
    ) {
      throw new BadRequestException({
        code: 'CARD_UPDATE_FIELDS_REQUIRED',
        message: 'Provide at least one field to update',
      });
    }

    return this.prisma.card.update({
      where: { id: cardId },
      data: {
        title: dto.title,
        description: dto.description,
        position: dto.position,
        dueDate: dto.dueDate,
        assigneeId: dto.assigneeId,
      },
    });
  }

  async deleteCard(cardId: number): Promise<{ ok: boolean }> {
    await this.prisma.card.delete({
      where: { id: cardId },
    });
    return { ok: true };
  }

  async setCardCompletion(
    cardId: number,
    dto: SetCardCompletionDto,
  ): Promise<{ ok: boolean }> {
    await this.prisma.card.update({
      where: { id: cardId },
      data: { isCompleted: dto.isCompleted },
    });
    return { ok: true };
  }

  async moveCard(cardId: number, dto: MoveCardDto): Promise<Card | null> {
    return this.prisma.$transaction(async (tx) => {
      const card = await tx.card.findUnique({
        where: { id: cardId },
        select: {
          id: true,
          listId: true,
          list: { select: { boardId: true } },
        },
      });

      if (!card) {
        throw new NotFoundException({
          code: 'CARD_NOT_FOUND',
          message: 'Card not found',
        });
      }

      const targetList = await tx.list.findUnique({
        where: { id: dto.toListId },
        select: { id: true, boardId: true },
      });

      if (!targetList) {
        throw new NotFoundException({
          code: 'LIST_NOT_FOUND',
          message: 'Target list not found',
        });
      }

      if (targetList.boardId !== card.list.boardId) {
        throw new BadRequestException({
          code: 'CARD_MOVE_CROSS_BOARD',
          message: 'Cannot move card to a list on another board',
        });
      }

      const sourceListId = card.listId;
      const toListId = dto.toListId;

      const sourceCards = await tx.card.findMany({
        where: { listId: sourceListId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });

      const targetCards = await tx.card.findMany({
        where: { listId: toListId },
        orderBy: { position: 'asc' },
        select: { id: true },
      });

      if (sourceListId === toListId) {
        const withoutMoved = sourceCards
          .map((c) => c.id)
          .filter((id) => id !== cardId);
        const insertAt = Math.min(
          Math.max(0, dto.position),
          withoutMoved.length,
        );
        const newOrder = [
          ...withoutMoved.slice(0, insertAt),
          cardId,
          ...withoutMoved.slice(insertAt),
        ];
        for (let i = 0; i < newOrder.length; i++) {
          await tx.card.update({
            where: { id: newOrder[i] },
            data: { position: i, listId: toListId },
          });
        }
      } else {
        const sourceIds = sourceCards
          .map((c) => c.id)
          .filter((id) => id !== cardId);
        for (let i = 0; i < sourceIds.length; i++) {
          await tx.card.update({
            where: { id: sourceIds[i] },
            data: { position: i },
          });
        }

        const targetIds = targetCards
          .map((c) => c.id)
          .filter((id) => id !== cardId);
        const insertAt = Math.min(
          Math.max(0, dto.position),
          targetIds.length,
        );
        const newTargetOrder = [
          ...targetIds.slice(0, insertAt),
          cardId,
          ...targetIds.slice(insertAt),
        ];
        for (let i = 0; i < newTargetOrder.length; i++) {
          await tx.card.update({
            where: { id: newTargetOrder[i] },
            data: { position: i, listId: toListId },
          });
        }
      }

      return tx.card.findUnique({ where: { id: cardId } });
    });
  }
}
