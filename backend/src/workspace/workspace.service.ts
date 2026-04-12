import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import {
    NotFoundException,
    BadRequestException,
} from '@nestjs/common';
import { PaginationDto } from './dto/pagination.dto';
import { WorkspaceRole } from '../generated/prisma/enums';
import type {
    WorkspaceCreated,
    WorkspaceIdRef,
    WorkspaceSummary,
    WorkspaceUpdated,
    UserWorkspaceRow,
} from './interface';

@Injectable()
export class WorkspaceService {
    constructor(private readonly prisma: PrismaService) {}


    async createWorkspace(
        dto: CreateWorkspaceDto,
        userId: number,
    ): Promise<WorkspaceCreated> {
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

    async getWorkspaceSummary(
        workspaceId: number,
        userId: number,
    ): Promise<WorkspaceSummary> {
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

    async getUserWorkspaces(
        userId: number,
        paginationDto: PaginationDto,
    ): Promise<UserWorkspaceRow[]> {
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

    async updateWorkspace(
        workspaceId: number,
        dto: UpdateWorkspaceDto,
    ): Promise<WorkspaceUpdated> {
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

    async deleteWorkspace(workspaceId: number): Promise<{ ok: boolean }> {
        await this.prisma.workspace.delete({
            where: { id: workspaceId },
        })
        return { ok: true }
    }

    async getWorkspaceOrThrow(workspaceId: number): Promise<WorkspaceIdRef> {
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

}
