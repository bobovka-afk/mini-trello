import { Module } from '@nestjs/common';
import { BoardService } from './board.service';
import { BoardController } from './board.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [BoardController],
  providers: [BoardService],
})
export class BoardModule {}
