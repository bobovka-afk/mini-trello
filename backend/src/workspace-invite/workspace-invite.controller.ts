import { Controller } from '@nestjs/common';
import { WorkspaceInviteService } from './workspace-invite.service';
import { UseGuards } from '@nestjs/common';
import { Get } from '@nestjs/common';
import { Req } from '@nestjs/common';
import { Post } from '@nestjs/common';
import { Param } from '@nestjs/common';
import { ParseIntPipe } from '@nestjs/common';
import { Body } from '@nestjs/common';
import { Query } from '@nestjs/common';
import { Delete } from '@nestjs/common';
import { SendInviteDto } from './dto/send-invite.dto';
import { AcceptInviteTokenDto } from './dto/accept-invite-token.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { WorkspaceRole } from '../generated/prisma/enums';
import { Request } from 'express';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('workspace-invite')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('workspace-invite')
export class WorkspaceInviteController {
  constructor(private readonly workspaceInviteService: WorkspaceInviteService) {}

  @Get('my')
  @ApiOperation({ summary: 'Get invites for current user' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Maximum number of records to return' })
  @ApiQuery({ name: 'offset', required: false, example: 0, description: 'Number of records to skip' })
  @ApiResponse({ status: 200, description: 'Current user invites returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async getMyInvites(
    @Req() req: Request & { user: { id: number } },
    @Query() paginationDto: PaginationDto,
  ){
      return this.workspaceInviteService.getMyInvites(req.user.id, paginationDto)
    }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Get(':workspaceId')
  @ApiOperation({ summary: 'Get invites for a workspace' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiQuery({ name: 'limit', required: false, example: 10, description: 'Maximum number of records to return' })
  @ApiQuery({ name: 'offset', required: false, example: 0, description: 'Number of records to skip' })
  @ApiResponse({ status: 200, description: 'Workspace invites returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Workspace not found.' })
  async getWorkspaceInvites(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.workspaceInviteService.getWorkspaceInvites(workspaceId, paginationDto);
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Post('create/:workspaceId')
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'workspace-invite:create', limit: 5, windowSec: 300 })
  @ApiOperation({ summary: 'Create workspace invite' })
  @ApiBody({ type: SendInviteDto, description: 'Workspace invite creation payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 201, description: 'Workspace invite created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid workspace invite payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 409, description: 'Invite conflicts with the current workspace state.' })
  async sendInvite(
    @Param('workspaceId', ParseIntPipe) workspaceId: number, 
    @Req() req: Request & { user: { id: number } },@Body() dto: SendInviteDto,) {
      return this.workspaceInviteService.sendInvite(dto, req.user.id, workspaceId);
    }

  @Post('accept-token')
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'workspace-invite:accept-token', limit: 10, windowSec: 300 })
  @ApiOperation({ summary: 'Accept workspace invite by token' })
  @ApiBody({ type: AcceptInviteTokenDto, description: 'Workspace invite token payload' })
  @ApiResponse({ status: 201, description: 'Workspace invite accepted successfully by token.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Invite token not found or expired.' })
  async acceptInviteByToken(
    @Req() req: Request & { user: { id: number } },
    @Body() dto: AcceptInviteTokenDto,
  ) {
    return this.workspaceInviteService.acceptInviteByToken(
      dto.token,
      req.user.id,
    );
  }

  @Post(':inviteId/accept')
  @ApiOperation({ summary: 'Accept workspace invite by id' })
  @ApiParam({ name: 'inviteId', example: 15, description: 'Invite id' })
  @ApiResponse({ status: 201, description: 'Workspace invite accepted successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  @ApiResponse({ status: 409, description: 'Invite conflicts with the current workspace state.' })
  async acceptInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.acceptInvite(inviteId, req.user.id);
  }

  @Post(':inviteId/decline')
  @ApiOperation({ summary: 'Decline workspace invite by id' })
  @ApiParam({ name: 'inviteId', example: 15, description: 'Invite id' })
  @ApiResponse({ status: 201, description: 'Workspace invite declined successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  @ApiResponse({ status: 409, description: 'Invite conflicts with the current workspace state.' })
  async declineInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.declineInvite(inviteId, req.user.id);
  }

  @UseGuards(WorkspaceAccessGuard, WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Delete(':workspaceId/:inviteId')
  @ApiOperation({ summary: 'Delete workspace invite' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'inviteId', example: 15, description: 'Invite id' })
  @ApiResponse({ status: 200, description: 'Workspace invite deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Invite not found.' })
  async deleteInvite(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
  ) {
    return this.workspaceInviteService.deleteInvite(inviteId, workspaceId);
  }
}
