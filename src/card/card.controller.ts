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

@UseGuards(JwtAuthGuard, WorkspaceAccessGuard, WorkspaceResourceGuard)
@Controller('card')
export class CardController {
  constructor(private readonly cardService: CardService) {}

  @Get('workspace/:workspaceId/lists/:listId/cards')
  async getCards(@Param('listId', ParseIntPipe) listId: number) {
    return this.cardService.getCards(listId);
  }


  @Post('workspace/:workspaceId/lists/:listId/cards')
  async createCard(
    @Param('listId', ParseIntPipe) listId: number,
    @Body() dto: CreateCardDto,
  ) {
    return this.cardService.createCard(listId, dto);
  }


  @Patch('workspace/:workspaceId/cards/:cardId/move')
  async moveCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: MoveCardDto,
  ) {
    return this.cardService.moveCard(cardId, dto);
  }

  @Patch('workspace/:workspaceId/cards/:cardId/completion')
  async setCardCompletion(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: SetCardCompletionDto,
  ) {
    return this.cardService.setCardCompletion(cardId, dto);
  }

  @Patch('workspace/:workspaceId/cards/:cardId')
  async updateCard(
    @Param('cardId', ParseIntPipe) cardId: number,
    @Body() dto: UpdateCardDto,
  ) {
    return this.cardService.updateCard(cardId, dto);
  }


  @Delete('workspace/:workspaceId/cards/:cardId')
  async deleteCard(@Param('cardId', ParseIntPipe) cardId: number) {
    return this.cardService.deleteCard(cardId);
  }
}
