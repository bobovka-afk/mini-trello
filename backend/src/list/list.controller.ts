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
import { UpdateListDto } from './dto/update-list.dto';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceResourceGuard } from '../common/guards/workspace-resource.guard';
import { WorkspaceRoles } from '../common/decorators/workspace-roles.decorator';
import { WorkspaceRole } from '../generated/prisma/enums';
import {
    ApiBearerAuth,
    ApiOperation,
    ApiParam,
    ApiResponse,
    ApiTags,
} from '@nestjs/swagger';

@ApiTags('list')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('list')
export class ListController {
    constructor(private readonly listService: ListService) {}

    @Get('workspace/:workspaceId/board/:boardId/lists')
    @ApiOperation({ summary: 'Get board lists' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
    @ApiResponse({ status: 200, description: 'Returns board lists' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'User is not a member of this workspace' })
    async getLists(
        @Param('boardId', ParseIntPipe) boardId: number,
    ) {
        return this.listService.getLists(boardId);
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Post('workspace/:workspaceId/board/:boardId/lists')
    @ApiOperation({ summary: 'Create list' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'boardId', example: 7, description: 'Board id' })
    @ApiResponse({ status: 201, description: 'List created successfully' })
    @ApiResponse({ status: 400, description: 'Invalid list data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Action is forbidden for current workspace role' })
    async createList(
        @Param('boardId', ParseIntPipe) boardId: number,
        @Body() dto: CreateListDto,
    ) {
        return this.listService.createList(
            boardId,
            dto,
        );
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Patch('workspace/:workspaceId/lists/:listId')
    @ApiOperation({ summary: 'Update list' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'listId', example: 11, description: 'List id' })
    @ApiResponse({ status: 200, description: 'List updated successfully' })
    @ApiResponse({ status: 400, description: 'Invalid update data' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Action is forbidden for current workspace role' })
    @ApiResponse({ status: 404, description: 'List not found' })
    async updateList(
        @Param('listId', ParseIntPipe) listId: number,
        @Body() dto: UpdateListDto,
    ) {
        return this.listService.updateList(
            listId,
            dto,
        );
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Delete('workspace/:workspaceId/lists/:listId')
    @ApiOperation({ summary: 'Delete list' })
    @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
    @ApiParam({ name: 'listId', example: 11, description: 'List id' })
    @ApiResponse({ status: 200, description: 'List deleted successfully' })
    @ApiResponse({ status: 401, description: 'Unauthorized' })
    @ApiResponse({ status: 403, description: 'Action is forbidden for current workspace role' })
    @ApiResponse({ status: 404, description: 'List not found' })
    async deleteList(
        @Param('listId', ParseIntPipe) listId: number,
    ) {
        return this.listService.deleteList(listId);
    }
}
