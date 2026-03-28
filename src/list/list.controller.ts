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

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('list')
export class ListController {
    constructor(private readonly listService: ListService) {}

    @Get('workspace/:workspaceId/board/:boardId/lists')
    async getLists(
        @Param('boardId', ParseIntPipe) boardId: number,
    ) {
        return this.listService.getLists(boardId);
    }

    @UseGuards(WorkspaceRoleGuard)
    @WorkspaceRoles(WorkspaceRole.OWNER, WorkspaceRole.ADMIN)
    @Post('workspace/:workspaceId/board/:boardId/lists')
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
    async deleteList(
        @Param('listId', ParseIntPipe) listId: number,
    ) {
        return this.listService.deleteList(listId);
    }
}
