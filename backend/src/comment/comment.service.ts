import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WorkspaceRole } from '../generated/prisma/enums';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment-dto';
import type { CommentWithUser } from './interface';

@Injectable()
export class CommentService {
  constructor(private readonly prisma: PrismaService) {}

  async getComments(cardId: number): Promise<CommentWithUser[]> {
    return this.prisma.comment.findMany({
      where: { cardId },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, avatarPath: true },
        },
      },
    });
  }

  async createComment(
    cardId: number,
    userId: number,
    dto: CreateCommentDto,
  ) {
    return this.prisma.comment.create({
      data: {
        cardId,
        userId,
        body: dto.body,
      },
      include: {
        user: {
          select: { id: true, name: true, avatarPath: true },
        },
      },
    });
  }

  async updateComment(
    commentId: number,
    userId: number,
    dto: UpdateCommentDto,
  ): Promise<CommentWithUser> {
    const comment = await this.getCommentAuthorOrThrow(commentId);
    if (comment.userId !== userId) {
      throw new ForbiddenException({
        code: 'COMMENT_EDIT_FORBIDDEN',
        message: 'You can only edit your own comments.',
      });
    }

    return this.prisma.comment.update({
      where: { id: commentId },
      data: { body: dto.body },
      include: {
        user: {
          select: { id: true, name: true, avatarPath: true },
        },
      },
    });
  }

  async deleteComment(
    commentId: number,
    userId: number,
    workspaceId: number,
  ): Promise<{ ok: boolean }> {
    const comment = await this.getCommentAuthorOrThrow(commentId);

    if (comment.userId === userId) {
      await this.prisma.comment.delete({ where: { id: commentId } });
      return { ok: true };
    }

    const member = await this.prisma.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
      select: { role: true },
    });

    if (
      member?.role !== WorkspaceRole.OWNER &&
      member?.role !== WorkspaceRole.ADMIN
    ) {
      throw new ForbiddenException({
        code: 'COMMENT_DELETE_FORBIDDEN',
        message:
          'Only workspace owners and administrators can delete comments by other members.',
      });
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { ok: true };
  }

  private async getCommentAuthorOrThrow(
    commentId: number,
  ): Promise<{ userId: number }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: { userId: true },
    });

    if (!comment) {
      throw new NotFoundException({
        code: 'COMMENT_NOT_FOUND',
        message: 'Comment not found',
      });
    }

    return comment;
  }
}
