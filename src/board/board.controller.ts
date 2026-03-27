import { Controller } from '@nestjs/common';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Post, Body, Get, Patch, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post('workspace/:workspaceId/boards')
  async createBoard(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardService.createBoard(workspaceId, dto);
  }

  @Get('workspace/:workspaceId/boards/:boardId')
  async getBoard(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.getBoard(workspaceId, boardId);
  }

  @Get('workspace/:workspaceId/boards')
  async getBoards(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.boardService.getBoards(workspaceId);
  }

  @Patch('workspace/:workspaceId/boards/:boardId')
  async updateBoard(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardService.updateBoard(
      workspaceId,
      boardId,
      dto,
    );
  }

  @Delete('workspace/:workspaceId/boards/:boardId')
  async deleteBoard(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.deleteBoard(boardId, workspaceId);
  }

}
