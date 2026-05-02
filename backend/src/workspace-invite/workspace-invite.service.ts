import {
  BadRequestException,
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SendInviteDto } from './dto/send-invite.dto';
import { Prisma } from '../generated/prisma/client';
import * as crypto from 'crypto';
import { WorkspaceInviteStatus } from '../generated/prisma/enums';
import { MailService } from '../mail/mail.service';
import { ConfigService } from '@nestjs/config';
import { WorkspaceService } from '../workspace/workspace.service';
import { WorkspaceActivityService } from '../workspace-activity/workspace-activity.service';
import { WorkspaceActivityType } from '../generated/prisma/enums';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import type {
  InviteForEmailAccess,
  MyWorkspaceInviteRow,
  WorkspaceInviteCreated,
  WorkspaceInviteListItem,
} from './interface';

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
    private readonly workspaceActivityService: WorkspaceActivityService,
  ) {}

  async sendInvite(
    dto: SendInviteDto,
    userId: number,
    workspaceId: number,
  ): Promise<WorkspaceInviteCreated> {
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

    const token = crypto.randomBytes(32).toString('hex');
    let invite;
    try {
      invite = await this.prisma.workspaceInvite.create({
        data: {
          email: dto.email,
          workspaceId: workspaceId,
          invitedByUserId: userId,
          role: dto.role,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          tokenHash: this.hashToken(token),
        },
      });
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

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });
    const workspaceName = workspace?.name ?? '';
    const clientUrl = this.configService.get<string>('CLIENT_URL') || '';
    const inviteUrl = `${clientUrl}/invite?token=${token}`;

    try {
      await this.mailService.sendWorkspaceInvite(
        dto.email,
        inviteUrl,
        workspaceName,
      );
    } catch {
      await this.prisma.workspaceInvite
        .delete({ where: { id: invite.id } })
        .catch(() => undefined);
      throw new ServiceUnavailableException({
        code: 'INVITE_MAIL_FAILED',
        message: 'Could not send invitation email',
      });
    }

    await this.workspaceActivityService.record(this.prisma, {
      workspaceId,
      actorUserId: userId,
      type: WorkspaceActivityType.MEMBER_INVITED,
      payload: {
        invitedEmail: dto.email,
        role: dto.role,
      },
    });

    return { id: invite.id };
  }

  async getWorkspaceInvites(
    workspaceId: number,
    paginationDto: PaginationDto,
  ): Promise<WorkspaceInviteListItem[]> {
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

  async deleteInvite(
    inviteId: number,
    workspaceId: number,
    cancelledByUserId: number,
  ): Promise<{ ok: boolean }> {
    await this.prisma.$transaction(async (tx) => {
      const invite = await tx.workspaceInvite.findFirst({
        where: { id: inviteId, workspaceId },
        select: { id: true, email: true, role: true },
      });
      if (!invite) {
        this.throwInviteNotFound();
      }
      await tx.workspaceInvite.delete({
        where: { id: invite.id },
      });
      await this.workspaceActivityService.record(tx, {
        workspaceId,
        actorUserId: cancelledByUserId,
        type: WorkspaceActivityType.INVITE_CANCELLED,
        payload: {
          invitedEmail: invite.email,
          role: invite.role,
        },
      });
    });
    return { ok: true };
  }

  async getMyInvites(
    userId: number,
    paginationDto: PaginationDto,
  ): Promise<MyWorkspaceInviteRow[]> {
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

  async acceptInviteByToken(
    token: string,
    userId: number,
  ): Promise<{ ok: boolean }> {
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

  async acceptInvite(inviteId: number, userId: number): Promise<{ ok: boolean }> {
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
        await this.workspaceActivityService.record(tx, {
          workspaceId: invite.workspaceId,
          actorUserId: userId,
          type: WorkspaceActivityType.INVITE_ACCEPTED,
          payload: {
            invitedEmail: invite.email,
            role: invite.role,
            joinedUserId: userId,
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

  async declineInvite(inviteId: number, userId: number): Promise<{ ok: boolean }> {
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
      await this.workspaceActivityService.record(tx, {
        workspaceId: invite.workspaceId,
        actorUserId: userId,
        type: WorkspaceActivityType.INVITE_DECLINED,
        payload: {
          invitedEmail: invite.email,
          role: invite.role,
        },
      });
    });

    return { ok: true };
  }

  private async deleteInviteRecord(
    db: InviteDbClient,
    inviteId: number,
  ): Promise<void> {
    await db.workspaceInvite.delete({ where: { id: inviteId } });
  }

  private async getUserEmailOrThrow(userId: number): Promise<string> {
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

  private async getInviteForEmailOrThrow(
    inviteId: number,
    email: string,
  ): Promise<InviteForEmailAccess> {
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

  private ensureInviteIsActive(
    status: WorkspaceInviteStatus,
    expiresAt: Date,
  ): void {
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

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private throwInviteNotFound(): never {
    throw new NotFoundException({
      code: 'INVITE_NOT_FOUND',
      message: 'Invite not found',
    });
  }
}
