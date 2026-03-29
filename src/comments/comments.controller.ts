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

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('comment')
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Get('workspace/:workspaceId/cards/:cardId/comments')
  async getComments(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.commentsService.getComments(cardId);
  }

  @Post('workspace/:workspaceId/cards/:cardId/comments')
  async createComment(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: CreateCommentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.commentsService.createComment(cardId, req.user.id, dto);
  }

  @Patch('workspace/:workspaceId/comments/:commentId')
  async updateComment(
    @Param('commentId', ParseIntPipe) commentId: number,
    @Body() dto: UpdateCommentDto,
    @Req() req: Request & { user: { id: number } },
  ) {
    return this.commentsService.updateComment(commentId, req.user.id, dto);
  }

  @Delete('workspace/:workspaceId/comments/:commentId')
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
