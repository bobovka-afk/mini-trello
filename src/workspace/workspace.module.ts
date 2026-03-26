import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceAccessGuard } from './guards/workspace-access.guard';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceAccessGuard],
  exports: [WorkspaceService, WorkspaceAccessGuard],
})
export class WorkspaceModule {}
