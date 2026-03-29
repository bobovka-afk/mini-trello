import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
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
  ],
  controllers: [AppController],
  providers: [AppService ],
})
export class AppModule {}
