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
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { PaginationDto } from '../workspace/dto/pagination.dto';
import { WorkspaceAccessGuard } from '../workspace/guards/workspace-access.guard';


@UseGuards(JwtAuthGuard)
@Controller('workspace-invite')
export class WorkspaceInviteController {
  constructor(private readonly workspaceInviteService: WorkspaceInviteService) {}

  @Get('my')
  async getMyInvites(
    @Req() req: Request & { user: { id: number } },
    @Query() paginationDto: PaginationDto,
  ){
      return this.workspaceInviteService.getMyInvites(req.user.id, paginationDto)
    }

  @UseGuards(WorkspaceAccessGuard)
  @Post('create/:workspaceId')
  async sendInvite(
    @Param('workspaceId', ParseIntPipe) workspaceId: number, 
    @Req() req: Request & { user: { id: number } },@Body() dto: SendInviteDto,) {
      return this.workspaceInviteService.sendInvite(dto, req.user.id, workspaceId);
    }

  @Post(':inviteId/accept')
  async acceptInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.acceptInvite(inviteId, req.user.id);
  }

  @Post(':inviteId/decline')
  async declineInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.declineInvite(inviteId, req.user.id);
  }

  @UseGuards(WorkspaceAccessGuard)
  @Delete(':workspaceId/:inviteId')
  async deleteInvite(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.deleteInvite(inviteId, workspaceId, req.user.id);
  }
}
