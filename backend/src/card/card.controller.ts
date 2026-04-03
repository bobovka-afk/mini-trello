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
  ApiBody,
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('card')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('workspace/:workspaceId')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get('lists/:listId/cards')
  @ApiOperation({ summary: 'Get cards for a list' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'listId', example: 11, description: 'List id' })
  @ApiResponse({ status: 200, description: 'Cards returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 403, description: 'Access to this workspace is denied.' })
  async getCards(@Param('listId', ParseIntPipe) listId: number) {
    return this.cardService.getCards(listId);
  }


  @Post('lists/:listId/cards')
  @ApiOperation({ summary: 'Create card' })
  @ApiBody({ type: CreateCardDto, description: 'Card creation payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'listId', example: 11, description: 'List id' })
  @ApiResponse({ status: 201, description: 'Card created successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid card creation payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async createCard(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: CreateCardDto,
  ) {
    return this.cardService.createCard(listId, dto);
  }


  @Patch('cards/:cardId/move')
  @ApiOperation({ summary: 'Move card to another list or position' })
  @ApiBody({ type: MoveCardDto, description: 'Card move payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card moved successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid card move payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Card or target list not found.' })
  async moveCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: MoveCardDto,
  ) {
    return this.cardService.moveCard(cardId, dto);
  }

  @Patch('cards/:cardId/completion')
  @ApiOperation({ summary: 'Set card completion state' })
  @ApiBody({ type: SetCardCompletionDto, description: 'Card completion payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card completion state updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid card completion payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  async setCardCompletion(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: SetCardCompletionDto,
  ) {
    return this.cardService.setCardCompletion(cardId, dto);
  }

  @Patch('cards/:cardId')
  @ApiOperation({ summary: 'Update card' })
  @ApiBody({ type: UpdateCardDto, description: 'Card update payload' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid card update payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  async updateCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cardService.updateCard(cardId, dto);
  }


  @Delete('cards/:cardId')
  @ApiOperation({ summary: 'Delete card' })
  @ApiParam({ name: 'workspaceId', example: 1, description: 'Workspace id' })
  @ApiParam({ name: 'cardId', example: 35, description: 'Card id' })
  @ApiResponse({ status: 200, description: 'Card deleted successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  @ApiResponse({ status: 404, description: 'Card not found.' })
  async deleteCard(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.cardService.deleteCard(cardId);
  }
}
