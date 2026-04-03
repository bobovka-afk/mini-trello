import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { CommentsService } from './comments.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceResourceGuard } from '../common/guards/workspace-resource.guard';
import { CreateCommentDto } from './dto/create-comment.dto';
import { UpdateCommentDto } from './dto/update-comment-dto';
import { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('comment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('comment')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('workspace/:workspaceId/cards/:cardId/comments')
  @ApiOperation({ summary: 'Get comments for a card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Returns card comments' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'User is not a member of this workspace' })
  async getComments(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.commentsService.getComments(cardId);
  }

  @Post('workspace/:workspaceId/cards/:cardId/comments')
  @ApiOperation({ summary: 'Create comment for a card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 201, description: 'Comment created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid comment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createComment(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: CreateCommentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.commentsService.createComment(cardId, req.user.id, dto);
  }

  @Patch('workspace/:workspaceId/comments/:commentId')
  @ApiOperation({ summary: 'Update comment' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'commentId', example: 52, description: 'Comment id' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid comment data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'You can only edit your own comments' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async updateComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.commentsService.updateComment(commentId, req.user.id, dto);
  }

  @Delete('workspace/:workspaceId/comments/:commentId')
  @ApiOperation({ summary: 'Delete comment' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'commentId', example: 52, description: 'Comment id' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Action is forbidden' })
  @ApiResponse({ status: 404, description: 'Comment not found' })
  async deleteComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Req() req: Request & { user: { id: number }; workspaceId: number },
  ) {
    return this.commentsService.deleteComment(
      commentId,
      req.user.id,
      req.workspaceId,
    );
  }
}
