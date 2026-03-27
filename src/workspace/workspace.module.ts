import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceController],
  providers: [WorkspaceService, WorkspaceAccessGuard, WorkspaceRoleGuard],
  exports: [WorkspaceService, WorkspaceAccessGuard, WorkspaceRoleGuard],
})
export class WorkspaceModule {}
