import { Module } from '@nestjs/common';
import { ListService } from './list.service';
import { ListController } from './list.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [PrismaModule, WorkspaceModule],
  controllers: [ListController],
  providers: [ListService],
})
export class ListModule {}
