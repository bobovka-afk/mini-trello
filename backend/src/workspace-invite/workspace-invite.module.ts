import { Module } from '@nestjs/common';
import { WorkspaceInviteService } from './workspace-invite.service';
import { WorkspaceInviteController } from './workspace-invite.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { WorkspaceModule } from '../workspace/workspace.module';

@Module({
  imports: [PrismaModule, MailModule, WorkspaceModule],
  controllers: [WorkspaceInviteController],
  providers: [WorkspaceInviteService],
})
export class WorkspaceInviteModule {}
