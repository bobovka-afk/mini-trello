import { Module } from '@nestjs/common';
import { WorkspaceInviteService } from './workspace-invite.service';
import { WorkspaceInviteController } from './workspace-invite.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { MailModule } from '../mail/mail.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { WorkspaceActivityModule } from '../workspace-activity/workspace-activity.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Module({
  imports: [
    PrismaModule,
    MailModule,
    WorkspaceModule,
    WorkspaceActivityModule,
    RedisModule,
  ],
  controllers: [WorkspaceInviteController],
  providers: [WorkspaceInviteService, RateLimitGuard],
})
export class WorkspaceInviteModule {}
