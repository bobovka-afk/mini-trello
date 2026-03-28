import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { WorkspaceRole } from '../generated/prisma/enums';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
    NotFoundException,
    ForbiddenException,
    BadRequestException,
} from '@nestjs/common';
import { PaginationDto } from './dto/pagination.dto';

@Injectable()
export class WorkspaceService {
    constructor(private readonly prisma: PrismaService) {}


    async createWorkspace(dto: CreateWorkspaceDto, userId: number) {
        const workspace = await this.prisma.workspace.create({
            data: {
                name: dto.name,
                description: dto.description,
                members: {
                    create: {
                        userId: userId,
                        role: WorkspaceRole.OWNER,
                    }
                }
            }
        })
        return {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            createdAt: workspace.createdAt,
        };
    }

    async getWorkspaceSummary(workspaceId: number, userId: number) {
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: {
                id: true,
                name: true,
                description: true,
            },
        });
        if (!workspace) {
            throw new NotFoundException({
                code: 'WORKSPACE_NOT_FOUND',
                message: 'Workspace not found',
            });
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
        return {
            ...workspace,
            myRole: member?.role ?? null,
        };
    }

    async getUserWorkspaces(userId: number, paginationDto: PaginationDto) {
        return this.prisma.workspaceMember.findMany({
            where: { userId: userId },
            select: {
                id: true,
                workspaceId: true,
                userId: true,
                role: true,
                createdAt: true,
                workspace: {
                    select: {
                        id: true,
                        name: true,
                        description: true,
                    },
                },
            },
            orderBy: {
                workspace: {
                    updatedAt: 'desc',
                },
            },
            take: paginationDto.limit,
            skip: paginationDto.offset,
        });
    }

    async getWorkspaceMembers(
        workspaceId: number,
        paginationDto: PaginationDto
    ) {
        return this.prisma.workspaceMember.findMany({
            where: { workspaceId: workspaceId },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatarPath: true,
                    },
                },
            },
            orderBy: {
                createdAt: 'desc',
            },
            take: paginationDto.limit,
            skip: paginationDto.offset,
        });
    }

    async updateWorkspace(
        workspaceId: number,
        dto: UpdateWorkspaceDto,
    ) {
        if (dto.name === undefined && dto.description === undefined) {
            throw new BadRequestException({
                code: 'WORKSPACE_UPDATE_FIELDS_REQUIRED',
                message: 'Provide at least one field: name or description',
            });
        }

        const workspace = await this.prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                name: dto.name,
                description: dto.description,
            },
        });
        return {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
        };
    }

    async deleteWorkspaceMember(
        workspaceId: number,
        memberId: number,
      ): Promise<{ ok: boolean }> {
        const targetMember = await this.getWorkspaceMemberOrThrow(
            workspaceId,
            memberId,
          );
          if (targetMember.role === WorkspaceRole.OWNER) {
            throw new ForbiddenException({
              code: 'WORKSPACE_OWNER_CANNOT_BE_REMOVED',
              message: 'You cannot remove workspace OWNER. Transfer ownership first.',
            });
          }
      
        await this.prisma.workspaceMember.delete({
          where: {
            workspaceId_userId: {
              workspaceId,
              userId: memberId,
            },
          },
        });
      
        return { ok: true };
      }

    async leaveWorkspace(userId: number, workspaceId: number): Promise <{ok: boolean}> {
        await this.prisma.workspaceMember.delete({
            where: {
                workspaceId_userId : {
                    userId: userId,
                    workspaceId: workspaceId
                }

            }
        })

        return { ok: true }
    }

    async deleteWorkspace(workspaceId: number): Promise<{ ok: boolean }> {
        await this.prisma.workspace.delete({
            where: { id: workspaceId },
        })
        return { ok: true }
    }

    async getWorkspaceOrThrow(workspaceId: number) {
        const workspace = await this.prisma.workspace.findUnique({
            where: { id: workspaceId },
            select: { id: true },
        });
        if (!workspace) {
            throw new NotFoundException({
                code: 'WORKSPACE_NOT_FOUND',
                message: 'Workspace not found',
            });
        }
        return workspace;
    }

    private async getWorkspaceMemberOrThrow(workspaceId: number, userId: number) {
        const member = await this.prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId,
                    userId,
                },
            },
        });
        if (!member) {
            throw new ForbiddenException({
                code: 'WORKSPACE_MEMBER_REQUIRED',
                message: 'You are not a member of this workspace',
            });
        }
        return member;
    }



}
