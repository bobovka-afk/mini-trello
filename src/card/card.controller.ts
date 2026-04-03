import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CardService } from './card.service';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceResourceGuard } from '../common/guards/workspace-resource.guard';
import { CreateCardDto } from './dto/create-card.dto';
import { MoveCardDto } from './dto/move-card.dto';
import { SetCardCompletionDto } from './dto/set-card-completion.dto';
import { UpdateCardDto } from './dto/update-card.dto';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('card')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('card')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get('workspace/:workspaceId/lists/:listId/cards')
  @ApiOperation({ summary: 'Get cards for a list' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'listId', example: 11, description: 'List id' })
  @ApiResponse({ status: 200, description: 'Returns list cards' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'User is not a member of this workspace' })
  async getCards(@Param('listId', ParseIntPipe) listId: number) {
    return this.cardService.getCards(listId);
  }


  @Post('workspace/:workspaceId/lists/:listId/cards')
  @ApiOperation({ summary: 'Create card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'listId', example: 11, description: 'List id' })
  @ApiResponse({ status: 201, description: 'Card created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid card data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createCard(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: CreateCardDto,
  ) {
    return this.cardService.createCard(listId, dto);
  }


  @Patch('workspace/:workspaceId/cards/:cardId/move')
  @ApiOperation({ summary: 'Move card to another list or position' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card moved successfully' })
  @ApiResponse({ status: 400, description: 'Invalid move data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card or target list not found' })
  async moveCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: MoveCardDto,
  ) {
    return this.cardService.moveCard(cardId, dto);
  }

  @Patch('workspace/:workspaceId/cards/:cardId/completion')
  @ApiOperation({ summary: 'Set card completion state' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card completion updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid completion state' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async setCardCompletion(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: SetCardCompletionDto,
  ) {
    return this.cardService.setCardCompletion(cardId, dto);
  }

  @Patch('workspace/:workspaceId/cards/:cardId')
  @ApiOperation({ summary: 'Update card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async updateCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cardService.updateCard(cardId, dto);
  }


  @Delete('workspace/:workspaceId/cards/:cardId')
  @ApiOperation({ summary: 'Delete card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Card not found' })
  async deleteCard(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.cardService.deleteCard(cardId);
  }
}
