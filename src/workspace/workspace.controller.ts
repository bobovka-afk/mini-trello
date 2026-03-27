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


@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @Post('create')
  async createWorkspace(
    @Req() req: Request & { user: { id: number } },@Body() dto: CreateWorkspaceDto,) {
      return this.workspaceService.createWorkspace(dto, req.user.id);
    }

  @Get('get-user-workspaces')
  async getUserWorkspaces(
    @Req() req: Request & { user: { id: number } },
    @Query() paginationDto: PaginationDto,
  ) {
    return this.workspaceService.getUserWorkspaces(req.user.id, paginationDto);
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Patch(':workspaceId')
  async updateWorkspace(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, dto);
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER)
  @Delete(':workspaceId')
  async deleteWorkspace(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.workspaceService.deleteWorkspace(workspaceId);
  }

  @UseGuards(WorkspaceAccessGuard)
  @Get(':workspaceId/members')
  async getMembersWorkspace(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.workspaceService.getWorkspaceMembers(workspaceId, paginationDto);
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Delete(':workspaceId/members/:memberId')
  async deleteWorkspaceMember(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.workspaceService.deleteWorkspaceMember(workspaceId, memberId);
  }

  @UseGuards(WorkspaceAccessGuard)
  @Delete('/workspace/:workspaceId/members/me')
  async leaveWorkspace(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.workspaceService.leaveWorkspace(req.user.id, workspaceId);
  }


}
