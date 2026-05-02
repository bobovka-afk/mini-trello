import { Module } from '@nestjs/common';
import { WorkspaceService } from './workspace.service';
import { WorkspaceController } from './workspace.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceActivityModule } from '../workspace-activity/workspace-activity.module';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';
import { WorkspaceResourceGuard } from '../common/guards/workspace-resource.guard';
import { WorkspaceContextResolver } from '../common/services/workspace-context.resolver';

@Module({
  imports: [PrismaModule, WorkspaceActivityModule],
  controllers: [WorkspaceController],
  providers: [
    WorkspaceService,
    WorkspaceAccessGuard,
    WorkspaceRoleGuard,
    WorkspaceResourceGuard,
    WorkspaceContextResolver,
  ],
  exports: [
    WorkspaceService,
    WorkspaceAccessGuard,
    WorkspaceRoleGuard,
    WorkspaceResourceGuard,
    WorkspaceContextResolver,
  ],
})
export class WorkspaceModule {}
