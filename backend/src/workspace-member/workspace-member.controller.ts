import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { WorkspaceRole } from '../generated/prisma/enums';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import { WorkspaceMemberService } from './workspace-member.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('workspace-members')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspace/:workspaceId/members')
export class WorkspaceMemberController {
  constructor(private readonly workspaceMemberService: WorkspaceMemberService) {}

  @UseGuards(WorkspaceAccessGuard)
  @Get()
  @ApiOperation({ summary: 'Get workspace members' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Maximum number of records to return' })
  @ApiQuery({ name: 'offset', required: false, example: 0, description: 'Number of records to skip' })
  @ApiResponse({ status: 200, description: 'Workspace members returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async getMembersWorkspace(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.workspaceMemberService.getWorkspaceMembers(
      workspaceId,
      paginationDto,
    );
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Delete(':memberId')
  @ApiOperation({ summary: 'Remove workspace member' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'memberId', example: 22, description: 'Workspace member id' })
  @ApiResponse({ status: 200, description: 'Workspace member removed successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace member not found.' })
  async deleteWorkspaceMember(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.workspaceMemberService.deleteWorkspaceMember(
      workspaceId,
      memberId,
    );
  }

  @UseGuards(WorkspaceAccessGuard)
  @Delete('me')
  @ApiOperation({ summary: 'Leave workspace' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 200, description: 'User left the workspace successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async leaveWorkspace(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.workspaceMemberService.leaveWorkspace(req.user.id, workspaceId);
  }
}
