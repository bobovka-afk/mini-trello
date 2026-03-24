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



    async checkWorkspaceAccess(
        workspaceId: number,
        userId: number,
        action: 'update' | 'delete' | 'manage_invites',
    ) {
        const existingWorkspace = await this.getWorkspaceById(workspaceId);
        if (!existingWorkspace) {
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
        });

        if (!member) {
            throw new ForbiddenException({
                code: 'WORKSPACE_MEMBER_REQUIRED',
                message: 'You are not a member of this workspace',
            });
        }

        if (
            member.role !== WorkspaceRole.OWNER &&
            member.role !== WorkspaceRole.ADMIN
        ) {
            throw new ForbiddenException({
                code: 'WORKSPACE_ACTION_FORBIDDEN',
                message: `You do not have permission to ${action} this workspace`,
            });
        }
    }

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

    async getUserWorkspaces(userId: number, paginationDto: PaginationDto) {
        return this.prisma.workspaceMember.findMany({
            where: { userId: userId },
            include: {
                workspace: true,
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
        userId: number,
    ) {
        await this.checkWorkspaceAccess(workspaceId, userId, 'update');

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

    async deleteWorkspace(workspaceId: number, userId: number): Promise<{ ok: boolean }> {
        await this.checkWorkspaceAccess(workspaceId, userId, 'delete');

        await this.prisma.workspace.delete({
            where: { id: workspaceId },
        })
        return { ok: true }
    }

    private async getWorkspaceById(workspaceId: number) {
        return this.prisma.workspace.findUnique({
            where: { id: workspaceId },
        })
    }




}
