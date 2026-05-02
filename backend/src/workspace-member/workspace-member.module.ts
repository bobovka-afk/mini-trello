import { Module } from '@nestjs/common';
import { WorkspaceMemberService } from './workspace-member.service';
import { WorkspaceMemberController } from './workspace-member.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspaceActivityModule } from '../workspace-activity/workspace-activity.module';

@Module({
  imports: [PrismaModule, WorkspaceModule, WorkspaceActivityModule],
  controllers: [WorkspaceMemberController],
  providers: [WorkspaceMemberService],
})
export class WorkspaceMemberModule {}
