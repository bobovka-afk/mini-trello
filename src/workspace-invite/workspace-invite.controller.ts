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


@Controller('workspace-invite')
export class WorkspaceInviteController {
  constructor(private readonly workspaceInviteService: WorkspaceInviteService) {}

  @UseGuards(JwtAuthGuard)
  @Get('my')
  async getMyInvites(
    @Req() req: Request & { user: { id: number } },
    @Query() paginationDto: PaginationDto,
  ){
      return this.workspaceInviteService.getMyInvites(req.user.id, paginationDto)
    }

  @UseGuards(JwtAuthGuard)
  @Post('create/:workspaceId')
  async sendInvite(
    @Param('workspaceId', ParseIntPipe) workspaceId: number, 
    @Req() req: Request & { user: { id: number } },@Body() dto: SendInviteDto,) {
      return this.workspaceInviteService.sendInvite(dto, req.user.id, workspaceId);
    }

  @UseGuards(JwtAuthGuard)
  @Post(':inviteId/accept')
  async acceptInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.acceptInvite(inviteId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post(':inviteId/decline')
  async declineInvite(
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.declineInvite(inviteId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':workspaceId/:inviteId')
  async deleteInvite(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('inviteId', ParseIntPipe) inviteId: number,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.workspaceInviteService.deleteInvite(inviteId, workspaceId, req.user.id);
  }
}
