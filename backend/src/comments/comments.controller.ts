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
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import { Request } from 'express';
import {
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('comment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('workspace/:workspaceId')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('cards/:cardId/comments')
  @ApiOperation({ summary: 'Get comments for a card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Comments returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  async getComments(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.commentsService.getComments(cardId);
  }

  @Post('cards/:cardId/comments')
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'comment:create', limit: 20, windowSec: 60 })
  @ApiOperation({ summary: 'Create comment for a card' })
  @ApiBody({ type: CreateCommentDto, description: 'Comment creation payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 201, description: 'Comment created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid comment creation payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async createComment(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: CreateCommentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.commentsService.createComment(cardId, req.user.id, dto);
  }

  @Patch('comments/:commentId')
  @ApiOperation({ summary: 'Update comment' })
  @ApiBody({ type: UpdateCommentDto, description: 'Comment update payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'commentId', example: 52, description: 'Comment id' })
  @ApiResponse({ status: 200, description: 'Comment updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid comment update payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'You do not have permission to update this comment.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
  async updateComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.commentsService.updateComment(commentId, req.user.id, dto);
  }

  @Delete('comments/:commentId')
  @ApiOperation({ summary: 'Delete comment' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'commentId', example: 52, description: 'Comment id' })
  @ApiResponse({ status: 200, description: 'Comment deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'You do not have permission to delete this comment.' })
  @ApiResponse({ status: 404, description: 'Comment not found.' })
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
