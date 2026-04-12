import {
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    UseGuards,
    Delete,
} from '@nestjs/common';
import { ListService } from './list.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { CreateListDto } from './dto/create-list.dto';
import { MoveListDto } from './dto/move-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
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
import type { List } from '../generated/prisma/client';

@ApiTags('list')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('workspace/:workspaceId')
export class ListController {
    constructor(private readonly listService: ListService) {}

    @Get('board/:boardId/lists')
    @ApiOperation({ summary: 'Get board lists' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
    @ApiResponse({ status: 200, description: 'Board lists returned successfully.' })
    @ApiResponse({ status: 401, description: 'Authentication is required.' })
    @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
    async getLists(
        @Param('boardId', ParseIntPipe) boardId: number,
    ): Promise<List[]> {
        return this.listService.getLists(boardId);
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Post('board/:boardId/lists')
    @ApiOperation({ summary: 'Create list' })
    @ApiBody({ type: CreateListDto, description: 'List creation payload' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
    @ApiResponse({ status: 201, description: 'List created successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid list creation payload.' })
    @ApiResponse({ status: 401, description: 'Authentication is required.' })
    @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
    async createList(
        @Param('boardId', ParseIntPipe) boardId: number,
        @Body() dto: CreateListDto,
    ): Promise<List> {
        return this.listService.createList(
            boardId,
            dto,
        );
    }

    @Patch('lists/:listId/move')
    @ApiOperation({ summary: 'Reorder list within its board' })
    @ApiBody({ type: MoveListDto, description: 'Target index within the board' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'listId', example: 11, description: 'List id' })
    @ApiResponse({ status: 200, description: 'List order updated successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid move payload.' })
    @ApiResponse({ status: 401, description: 'Authentication is required.' })
    @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
    @ApiResponse({ status: 404, description: 'List not found.' })
    async moveList(
        @Param('listId', ParseIntPipe) listId,
        @Body() dto,
    ): Promise<List | null> {
        return this.listService.moveList(listId, dto);
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Patch('lists/:listId')
    @ApiOperation({ summary: 'Update list' })
    @ApiBody({ type: UpdateListDto, description: 'List update payload' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'listId', example: 11, description: 'List id' })
    @ApiResponse({ status: 200, description: 'List updated successfully.' })
    @ApiResponse({ status: 400, description: 'Invalid list update payload.' })
    @ApiResponse({ status: 401, description: 'Authentication is required.' })
    @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
    @ApiResponse({ status: 404, description: 'List not found.' })
    async updateList(
        @Param('listId', ParseIntPipe) listId: number,
        @Body() dto: UpdateListDto,
    ): Promise<List> {
        return this.listService.updateList(
            listId,
            dto,
        );
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Delete('lists/:listId')
    @ApiOperation({ summary: 'Delete list' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'listId', example: 11, description: 'List id' })
    @ApiResponse({ status: 200, description: 'List deleted successfully.' })
    @ApiResponse({ status: 401, description: 'Authentication is required.' })
    @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
    @ApiResponse({ status: 404, description: 'List not found.' })
    async deleteList(
        @Param('listId', ParseIntPipe) listId: number,
    ): Promise<{ ok: boolean }> {
        return this.listService.deleteList(listId);
    }
}
