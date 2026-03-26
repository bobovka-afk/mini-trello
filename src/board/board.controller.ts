import { Controller } from '@nestjs/common';
import { BoardService } from './board.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UseGuards } from '@nestjs/common';
import { CreateBoardDto } from './dto/create-board.dto';
import { UpdateBoardDto } from './dto/update-board.dto';
import { Post, Req, Body, Get, Patch, Delete, Param, ParseIntPipe } from '@nestjs/common';
import { WorkspaceAccessGuard } from '../workspace/guards/workspace-access.guard';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('board')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @Post('workspace/:workspaceId/boards')
  async createBoard(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardService.createBoard(workspaceId, dto, req.user.id);
  }

  @Get('workspace/:workspaceId/boards/:boardId')
  async getBoard(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.getBoard(workspaceId, boardId, req.user.id);
  }

  @Get('workspace/:workspaceId/boards')
  async getBoards(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.boardService.getBoards(workspaceId, req.user.id);
  }

  @Patch('workspace/:workspaceId/boards/:boardId')
  async updateBoard(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
    @Body() dto: UpdateBoardDto,
  ) {
    return this.boardService.updateBoard(
      workspaceId,
      boardId,
      dto,
      req.user.id,
    );
  }

  @Delete('workspace/:workspaceId/boards/:boardId')
  async deleteBoard(
    @Req() req: Request & { user: { id: number } },
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.deleteBoard(boardId, workspaceId, req.user.id);
  }

}
