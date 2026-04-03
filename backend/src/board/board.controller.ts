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
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('board')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('workspace/:workspaceId')
export class BoardController {
  constructor(private readonly boardService: BoardService) {}

  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Post('boards')
  @ApiOperation({ summary: 'Create board' })
  @ApiBody({ type: CreateBoardDto, description: 'Board creation payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 201, description: 'Board created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid board creation payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  async createBoard(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
    @Body() dto: CreateBoardDto,
  ) {
    return this.boardService.createBoard(workspaceId, dto);
  }

  @Get('boards/:boardId')
  @ApiOperation({ summary: 'Get board details' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
  @ApiResponse({ status: 200, description: 'Board details returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Board not found.' })
  async getBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.getBoard(boardId);
  }

  @Get('boards')
  @ApiOperation({ summary: 'Get workspace boards' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiResponse({ status: 200, description: 'Workspace boards returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  async getBoards(
    @Param('workspaceId', ParseIntPipe) workspaceId: number,
  ) {
    return this.boardService.getBoards(workspaceId);
  }

  @UseGuards(WorkspaceRoleGuard)
  @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
  @Patch('boards/:boardId')
  @ApiOperation({ summary: 'Update board' })
  @ApiBody({ type: UpdateBoardDto, description: 'Board update payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
  @ApiResponse({ status: 200, description: 'Board updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid board update payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Board not found.' })
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
  @Delete('boards/:boardId')
  @ApiOperation({ summary: 'Delete board' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
  @ApiResponse({ status: 200, description: 'Board deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  @ApiResponse({ status: 404, description: 'Board not found.' })
  async deleteBoard(
    @Param('boardId', ParseIntPipe) boardId: number,
  ) {
    return this.boardService.deleteBoard(boardId);
  }

}
