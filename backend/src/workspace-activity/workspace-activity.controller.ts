import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { WorkspaceRole } from '../generated/prisma/enums';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import { WorkspaceActivityService } from './workspace-activity.service';
import type { WorkspaceActivityListItem } from './interface';

@ApiTags('workspace-activity')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspace')
export class WorkspaceActivityController {
  constructor(private readonly workspaceActivityService: WorkspaceActivityService) {}

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Get(':workspaceId/activity')
  @ApiOperation({ summary: 'List workspace activity (owner/admin)' })
  @ApiParam({ name: 'workspaceId', example: 1 })
  @ApiResponse({ status: 200, description: 'Activity rows (newest first)' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 404, description: 'Workspace not found' })
  async listWorkspaceActivity(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Query() paginationDto: PaginationDto,
  ): Promise<WorkspaceActivityListItem[]> {
    return this.workspaceActivityService.listByWorkspace(
      workspaceId,
      paginationDto,
    );
  }
}
