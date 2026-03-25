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


@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  @UseGuards(JwtAuthGuard)
  @Post('create')
  async createWorkspace(
    @Req() req: Request & { user: { id: number } },@Body() dto: CreateWorkspaceDto,) {
      return this.workspaceService.createWorkspace(dto, req.user.id);
    }

  @UseGuards(JwtAuthGuard)
  @Get('get-user-workspaces')
  async getUserWorkspaces(
    @Req() req: Request & { user: { id: number } },
    @Query() paginationDto: PaginationDto,
  ) {
    return this.workspaceService.getUserWorkspaces(req.user.id, paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':workspaceId')
  async updateWorkspace(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: UpdateWorkspaceDto,
  ) {
    return this.workspaceService.updateWorkspace(workspaceId, dto, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':workspaceId')
  async deleteWorkspace(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.workspaceService.deleteWorkspace(workspaceId, req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':workspaceId/members')
  async getWorkspaceMembers(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.workspaceService.getWorkspaceMembers(req.user.id, workspaceId, paginationDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':workspaceId/members/:memberId')
  async deleteWorkspaceMember(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('memberId', ParseIntPipe) memberId: number,
  ) {
    return this.workspaceService.deleteWorkspaceMember(workspaceId, req.user.id, memberId);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('/workspace/:workspaceId/members/me')
  async leaveWorkspace(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.workspaceService.leaveWorkspace(req.user.id, workspaceId);
  }


}
