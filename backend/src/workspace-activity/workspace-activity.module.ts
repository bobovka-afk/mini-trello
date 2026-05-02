import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceActivityService } from './workspace-activity.service';
import { WorkspaceActivityController } from './workspace-activity.controller';
import { WorkspaceAccessGuard } from '../common/guards/workspace-access.guard';
import { WorkspaceRoleGuard } from '../common/guards/workspace-role.guard';

@Module({
  imports: [PrismaModule],
  controllers: [WorkspaceActivityController],
  providers: [
    WorkspaceActivityService,
    WorkspaceAccessGuard,
    WorkspaceRoleGuard,
  ],
  exports: [WorkspaceActivityService],
})
export class WorkspaceActivityModule {}
