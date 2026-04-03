import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';

@Module({
  imports: [PrismaModule, RedisModule],
  controllers: [UserController],
  providers: [UserService, RateLimitGuard],
  exports: [UserService],
})
export class UserModule {}
