import { Controller } from '@nestjs/common';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Post, Body, Get, Patch, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceResourceGuard } from '../common/guards/workspace-resource.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { WorkspaceRole } from '../generated/prisma/enums';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Post('workspace/:workspaceId/boards')
  async createBoard(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardService.createBoard(workspaceId, dto);
  }

  @Get('workspace/:workspaceId/boards/:boardId')
  async getBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.getBoard(boardId);
  }

  @Get('workspace/:workspaceId/boards')
  async getBoards(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.boardService.getBoards(workspaceId);
  }

  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Patch('workspace/:workspaceId/boards/:boardId')
  async updateBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardService.updateBoard(
      boardId,
      dto,
    );
  }

  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Delete('workspace/:workspaceId/boards/:boardId')
  async deleteBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.deleteBoard(boardId);
  }

}
