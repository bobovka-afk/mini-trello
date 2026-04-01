import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { Prisma } from '../generated/prisma/client';
import * as crypto from 'crypto';
import { WorkspaceInviteStatus } from '../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from '../workspace/workspace.service';
import { PaginationDto } from '../workspace/dto/pagination.dto';

type InviteDbClient = {
  workspaceInvite: PrismaService['workspaceInvite'];
};

@Injectable()
export class WorkspaceInviteService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async sendInvite(dto: SendInviteDto, userId: number, workspaceId: number) {
    const invitedUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (invitedUser) {
      const existingMember = await this.prisma.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId: invitedUser.id,
          },
        },
      });

      if (existingMember) {
        throw new ConflictException({
          code: 'USER_ALREADY_MEMBER',
          message: 'User is already a workspace member',
        });
      }
    }

    try {
      const token = crypto.randomBytes(32).toString('hex');
      const invite = await this.prisma.workspaceInvite.create({
        data: {
          email: dto.email,
          workspaceId: workspaceId,
          invitedByUserId: userId,
          role: dto.role,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
          tokenHash: this.hashToken(token),
        },
      });

      const workspace = await this.prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: { name: true },
      });
      const workspaceName = workspace?.name ?? '';

      const clientUrl = this.configService.get<string>('CLIENT_URL') || '';
      const inviteUrl = `${clientUrl}/invite?token=${token}`;
      await this.mailService.sendWorkspaceInvite(
        dto.email,
        inviteUrl,
        workspaceName,
      );

      return { id: invite.id };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'INVITE_ALREADY_SENT',
          message: 'Invite has already been sent',
        });
      }
      throw error;
    }
  }

  async getWorkspaceInvites(workspaceId: number, paginationDto: PaginationDto) {
    const now = new Date();
    return this.prisma.workspaceInvite.findMany({
      where: {
        workspaceId,
        status: WorkspaceInviteStatus.PENDING,
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        email: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        invitedBy: {
          select: { id: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: paginationDto.limit,
      skip: paginationDto.offset,
    });
  }

  async deleteInvite(inviteId: number, workspaceId: number): Promise<{ ok: boolean }> {
    return this.prisma.$transaction(async (tx) => {
      const deleted = await tx.workspaceInvite.deleteMany({
        where: { id: inviteId, workspaceId },
      });
      if (deleted.count === 0) {
        this.throwInviteNotFound();
      }
      return { ok: true };
    });
  }

  async getMyInvites(userId: number, paginationDto: PaginationDto) {
    const currentUserEmail = await this.getUserEmailOrThrow(userId);

    return this.prisma.workspaceInvite.findMany({
      where: {
        email: currentUserEmail,
        status: WorkspaceInviteStatus.PENDING,
      },
      select: {
        id: true,
        role: true,
        expiresAt: true,
        createdAt: true,
        workspace: {
          select: { name: true },
        },
        invitedBy: {
          select: { name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: paginationDto.limit,
      skip: paginationDto.offset,
    });
  }

  async acceptInviteByToken(token: string, userId: number) {
    const tokenHash = this.hashToken(token);
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { tokenHash },
      select: { id: true },
    });
    if (!invite) {
      this.throwInviteNotFound();
    }
    return this.acceptInvite(invite.id, userId);
  }

  async acceptInvite(inviteId: number, userId: number) {
    const currentUserEmail = await this.getUserEmailOrThrow(userId);
    const invite = await this.getInviteForEmailOrThrow(inviteId, currentUserEmail);

    this.ensureInviteIsActive(invite.status, invite.expiresAt);
    await this.workspaceService.getWorkspaceOrThrow(invite.workspaceId);

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.workspaceMember.create({
          data: {
            workspaceId: invite.workspaceId,
            userId,
            role: invite.role,
          },
        });
        await this.deleteInviteRecord(tx, invite.id);
      });
      return { ok: true };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'USER_ALREADY_MEMBER',
          message: 'User is already a workspace member',
        });
      }
      throw error;
    }
  }

  async declineInvite(inviteId: number, userId: number) {
    const currentUserEmail = await this.getUserEmailOrThrow(userId);
    const invite = await this.getInviteForEmailOrThrow(inviteId, currentUserEmail);

    this.ensureInviteIsActive(invite.status, invite.expiresAt);
    await this.workspaceService.getWorkspaceOrThrow(invite.workspaceId);

    await this.prisma.$transaction(async (tx) => {
      const deleted = await tx.workspaceInvite.deleteMany({
        where: {
          id: invite.id,
          email: currentUserEmail,
          status: WorkspaceInviteStatus.PENDING,
        },
      });
      if (deleted.count === 0) {
        this.throwInviteNotFound();
      }
    });

    return { ok: true };
  }

  private async deleteInviteRecord(db: InviteDbClient, inviteId: number) {
    await db.workspaceInvite.delete({ where: { id: inviteId } });
  }

  private async getUserEmailOrThrow(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }
    return user.email;
  }

  private async getInviteForEmailOrThrow(inviteId: number, email: string) {
    const invite = await this.prisma.workspaceInvite.findUnique({
      where: { id: inviteId },
      select: {
        id: true,
        email: true,
        workspaceId: true,
        role: true,
        status: true,
        expiresAt: true,
      },
    });
    if (!invite) {
      this.throwInviteNotFound();
    }
    if (invite.email !== email) {
      throw new ForbiddenException({
        code: 'INVITE_ACCESS_DENIED',
        message: 'You cannot access this invite',
      });
    }
    return invite;
  }

  private ensureInviteIsActive(status: WorkspaceInviteStatus, expiresAt: Date) {
    if (status !== WorkspaceInviteStatus.PENDING) {
      throw new ConflictException({
        code: 'INVITE_ALREADY_PROCESSED',
        message: 'Invite has already been processed',
      });
    }
    if (expiresAt < new Date()) {
      throw new BadRequestException({
        code: 'INVITE_EXPIRED',
        message: 'Invite has expired',
      });
    }
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private throwInviteNotFound(): never {
    throw new NotFoundException({
      code: 'INVITE_NOT_FOUND',
      message: 'Invite not found',
    });
  }
}
