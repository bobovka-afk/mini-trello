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
import { PaginationDto } from 'src/workspace/dto/pagination.dto';

@Injectable()
export class WorkspaceInviteService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
        private readonly configService: ConfigService,
        private readonly workspaceService: WorkspaceService,
    ) {}
    async sendInvite(dto: SendInviteDto, userId: number, workspaceId: number) {
        await this.workspaceService.checkWorkspaceAccess(
            workspaceId,
            userId,
        );

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
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 дней
                    tokenHash: this.hashToken(token),
                },
            });

            const clientUrl = this.configService.get<string>('CLIENT_URL') || '';
            const inviteUrl = `${clientUrl}/invite?token=${token}`;
            await this.mailService.sendWorkspaceInvite(dto.email, inviteUrl);

            const { tokenHash: _, ...inviteWithoutHash } = invite;
            return inviteWithoutHash;
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

    async deleteInvite(inviteId: number,workspaceId: number, userId: number): Promise<{ ok: boolean }>  {
        await this.workspaceService.checkWorkspaceAccess(
            workspaceId,
            userId,
        );
        const invite = await this.prisma.workspaceInvite.findFirst({
            where: {
                id: inviteId,
                workspaceId,
            },
            select: { id: true },
        });
        if (!invite) {
            throw new NotFoundException({
                code: 'INVITE_NOT_FOUND',
                message: 'Invite not found',
            });
        }
        try {
        await this.prisma.workspaceInvite.delete({
            where: { id: invite.id },
        })
        return { ok: true }
    } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2025'
        ) {
          throw new NotFoundException({
            code: 'INVITE_NOT_FOUND',
            message: 'Invite not found',
          });
        }
        throw error;
      }
    }

    async getMyInvites(userId: number, paginationDto: PaginationDto){
        const currentUserEmail = await this.getUserEmailOrThrow(userId);

        return this.prisma.workspaceInvite.findMany({
            where: { email: currentUserEmail },
            select: {
              id: true,
              email: true,
              workspaceId: true,
              invitedByUserId: true,
              role: true,
              expiresAt: true,
              usedAt: true,
              createdAt: true,
            }, orderBy: { createdAt: 'desc' },
            take: paginationDto.limit,
            skip: paginationDto.offset,
        });
    }

    async acceptInvite(inviteId: number, userId: number) {
        const currentUserEmail = await this.getUserEmailOrThrow(userId);
        const invite = await this.getInviteForEmailOrThrow(inviteId, currentUserEmail);

        this.ensureInviteIsActive(invite.status, invite.usedAt, invite.expiresAt);
        await this.workspaceService.getWorkspaceOrThrow(invite.workspaceId);

        try {
            return await this.prisma.$transaction(async (tx) => {
                await tx.workspaceMember.create({
                    data: {
                        workspaceId: invite.workspaceId,
                        userId,
                        role: invite.role,
                    },
                });

                const updatedInvite = await tx.workspaceInvite.update({
                    where: { id: invite.id },
                    data: {
                        status: WorkspaceInviteStatus.ACCEPTED,
                        usedAt: new Date(),
                    },
                    select: this.getInvitePublicSelect(),
                });

                return updatedInvite;
            });
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

        this.ensureInviteIsActive(invite.status, invite.usedAt, invite.expiresAt);
        await this.workspaceService.getWorkspaceOrThrow(invite.workspaceId);

        return this.prisma.workspaceInvite.update({
            where: { id: invite.id },
            data: {
                status: WorkspaceInviteStatus.DECLINED,
                usedAt: new Date(),
            },
            select: this.getInvitePublicSelect(),
        });
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
                usedAt: true,
            },
        });
        if (!invite) {
            throw new NotFoundException({
                code: 'INVITE_NOT_FOUND',
                message: 'Invite not found',
            });
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
        usedAt: Date | null,
        expiresAt: Date,
    ) {
        if (status !== WorkspaceInviteStatus.PENDING) {
            throw new ConflictException({
                code: 'INVITE_ALREADY_PROCESSED',
                message: 'Invite has already been processed',
            });
        }
        if (usedAt) {
            throw new ConflictException({
                code: 'INVITE_ALREADY_USED',
                message: 'Invite has already been used',
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

    private getInvitePublicSelect() {
        return {
            id: true,
            email: true,
            workspaceId: true,
            invitedByUserId: true,
            role: true,
            status: true,
            expiresAt: true,
            usedAt: true,
            createdAt: true,
        } as const;
    }
}
    

