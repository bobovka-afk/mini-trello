import { Module } from '@nestjs/common';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { WorkspaceModule } from '../workspace/workspace.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Module({
  imports: [PrismaModule, WorkspaceModule, RedisModule],
  controllers: [CommentsController],
  providers: [CommentsService, RateLimitGuard],
})
export class CommentsModule {}
