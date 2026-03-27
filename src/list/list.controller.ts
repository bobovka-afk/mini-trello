import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
} from '@nestjs/common';
import { ListService } from './list.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard)
@Controller('list')
export class ListController {
    constructor(private readonly listService: ListService) {}

    @Get('workspace/:workspaceId/board/:boardId/lists')
    async getLists(
        @Param('workspaceId', ParseIntPipe) workspaceId: number,
        @Param('boardId', ParseIntPipe) boardId: number,
    ) {
        return this.listService.getLists(workspaceId, boardId);
    }

    @Post('workspace/:workspaceId/board/:boardId/lists')
    async createList(
        @Param('workspaceId', ParseIntPipe) workspaceId: number,
        @Param('boardId', ParseIntPipe) boardId: number,
        @Body() dto: CreateListDto,
    ) {
        return this.listService.createList(
            workspaceId,
            boardId,
            dto,
        );
    }

    @Patch('workspace/:workspaceId/board/:boardId/lists/:listId')
    async updateList(
        @Param('workspaceId', ParseIntPipe) workspaceId: number,
        @Param('boardId', ParseIntPipe) boardId: number,
        @Param('listId', ParseIntPipe) listId: number,
        @Body() dto: UpdateListDto,
    ) {
        return this.listService.updateList(
            workspaceId,
            boardId,
            listId,
            dto,
        );
    }
}
