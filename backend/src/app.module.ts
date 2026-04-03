import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { WorkspaceModule } from './workspace/workspace.module';
import { WorkspaceInviteModule } from './workspace-invite/workspace-invite.module';
import { BoardModule } from './board/board.module';
import { ListModule } from './list/list.module';
import { CardModule } from './card/card.module';
import { CommentsModule } from './comments/comments.module';
import { WorkspaceMembersModule } from './workspace-members/workspace-members.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    WorkspaceModule,
    WorkspaceInviteModule,
    BoardModule,
    ListModule,
    CardModule,
    CommentsModule,
    WorkspaceMembersModule,
    HealthModule,
    RedisModule,
  ],
  controllers: [],
  providers: [ ],
})
export class AppModule {}
