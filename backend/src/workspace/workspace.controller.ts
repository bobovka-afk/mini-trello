import {
  Controller,
  Post,
  Req,
  Body,
  Query,
  Get,
  Patch,
  Delete,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateWorkspaceDto } from './dto/create-workspace.dto';
import { PaginationDto } from './dto/pagination.dto';
import { UpdateWorkspaceDto } from './dto/update-workspace.dto';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { WorkspaceRole } from '../generated/prisma/enums';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type {
  UserWorkspaceRow,
  WorkspaceCreated,
  WorkspaceSummary,
  WorkspaceUpdated,
} from './interface';
import { Request } from 'express';

@ApiTags('workspace')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post('create')
  @ApiOperation({ summary: 'Create a workspace' })
  @ApiBody({ type: CreateWorkspaceDto, description: 'Workspace creation payload' })
  @ApiResponse({ status: 201, description: 'Workspace created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid workspace creation payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async createWorkspace(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: CreateWorkspaceDto,
  ): Promise<WorkspaceCreated> {
      return this.workspaceService.createWorkspace(dto, req.user.id);
    }

  @Get('get-user-workspaces')
  @ApiOperation({ summary: 'Get workspaces for current user' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Maximum number of records to return' })
  @ApiQuery({ name: 'offset', required: false, example: 0, description: 'Number of records to skip' })
  @ApiResponse({ status: 200, description: 'User workspaces returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async getUserWorkspaces(
    @Req() req: Request & { user: { id: number } },
    @Query() paginationDto: PaginationDto,
  ): Promise<UserWorkspaceRow[]> {
    return this.workspaceService.getUserWorkspaces(req.user.id, paginationDto);
  }

  @UseGuards(WorkspaceAccessGuard)
  @Get(':workspaceId/summary')
  @ApiOperation({ summary: 'Get workspace summary' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 200, description: 'Workspace summary returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async getWorkspaceSummary(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Req() req: Request & { user: { id: number } },
  ): Promise<WorkspaceSummary> {
    return this.workspaceService.getWorkspaceSummary(
      workspaceId,
      req.user.id,
    );
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Patch(':workspaceId')
  @ApiOperation({ summary: 'Update workspace' })
  @ApiBody({ type: UpdateWorkspaceDto, description: 'Workspace update payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 200, description: 'Workspace updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid workspace update payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async updateWorkspace(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: UpdateWorkspaceDto,
    @Req() req: Request & { user: { id: number } },
  ): Promise<WorkspaceUpdated> {
    return this.workspaceService.updateWorkspace(
      workspaceId,
      dto,
      req.user.id,
    );
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @Delete(':workspaceId')
  @ApiOperation({ summary: 'Delete workspace' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 200, description: 'Workspace deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async deleteWorkspace(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ): Promise<{ ok: boolean }> {
    return this.workspaceService.deleteWorkspace(workspaceId);
  }

}
