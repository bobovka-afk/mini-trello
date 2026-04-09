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
import { CommentModule } from './comment/comment.module';
import { WorkspaceMemberModule } from './workspace-member/workspace-member.module';
import { HealthModule } from './health/health.module';
import { RedisModule } from './redis/redis.module';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'node:crypto';


@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        autoLogging: false,
        quietReqLogger: true,
        quietResLogger: true,
        genReqId: (req, res) => {
          const incomingRequestId = req.headers['x-request-id'];
          const requestId = Array.isArray(incomingRequestId)
            ? incomingRequestId[0]
            : incomingRequestId ?? randomUUID();

          res.setHeader('X-Request-Id', requestId);
          return requestId;
        },
        customProps: (req) => ({
          requestId: req.id,
        }),
        serializers: {
          req: (req) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res) => ({
            statusCode: res.statusCode,
          }),
        },
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
        transport:
          process.env.LOG_PRETTY === 'true' || process.env.NODE_ENV !== 'production'
            ? {
                target: 'pino-pretty',
                options: {
                  singleLine: true,
                  colorize: true,
                  translateTime: 'SYS:standard',
                },
              }
            : undefined,
        redact: {
          paths: [
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers.x-api-key',
            'req.body.password',
            'req.body.token',
            'req.body.refreshToken',
            'res.headers["set-cookie"]',
          ],
          remove: true,
        },
      },
    }),
    PrismaModule,
    UserModule,
    AuthModule,
    WorkspaceModule,
    WorkspaceInviteModule,
    BoardModule,
    ListModule,
    CardModule,
    CommentModule,
    WorkspaceMemberModule,
    HealthModule,
    RedisModule,
  ],
  controllers: [],
  providers: [ ],
})
export class AppModule {}
