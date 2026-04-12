import {
  Body,
  Controller,
  Get,
  Delete,
  Patch,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import type { UserPublic } from './interface';
import { Request } from 'express';
import type { File as MulterFile } from 'multer';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { RateLimit } from '../common/decorators/rate-limit.decorator';
import { RateLimitGuard } from '../common/guards/rate-limit.guard';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('user')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Current user profile returned successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async getProfile(@Req() req): Promise<UserPublic | null> {
    return this.userService.getById(String(req.user.id));
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiBody({ type: UpdateUserDto, description: 'User profile update payload' })
  @ApiResponse({ status: 200, description: 'Current user profile updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid user profile update payload.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async updateProfile(
    @Req() req: Request & { user: { id: number } },
    @Body() body: UpdateUserDto,
  ): Promise<UserPublic> {
    return this.userService.updateName(req.user.id, body.name);
  }

  @Patch('update-avatar')
  @UseGuards(RateLimitGuard)
  @RateLimit({ key: 'user:update-avatar', limit: 10, windowSec: 300 })
  @ApiOperation({ summary: 'Upload and update user avatar' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Avatar image file',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'avatars');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req, file, cb) => {
          const userId = (req as any).user?.id ?? 'anon';
          const ext = path.extname(file.originalname).toLowerCase() || '.png';
          const name = `${userId}-${Date.now()}-${randomUUID()}${ext}`;
          cb(null, name);
        },
      }),
      limits: { fileSize: 5 * 1024 * 1024 }, 
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
          return cb(
            new BadRequestException({
              code: 'IMAGE_FILE_REQUIRED',
              message: 'Only image files are allowed',
            }),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  @ApiResponse({ status: 200, description: 'User avatar updated successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid avatar upload request.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async updateAvatar(
    @Req() req: Request & { user: { id: number } },
    @UploadedFile() file?: MulterFile,
  ): Promise<UserPublic> {
    if (!file) {
      throw new BadRequestException({
        code: 'FILE_NOT_PROVIDED',
        message: 'File is not provided',
      });
    }

    const baseUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
    const avatarUrl = `${baseUrl}/uploads/avatars/${file.filename}`;

    return this.userService.updateAvatar(req.user.id, avatarUrl);
  }

  @Delete('remove-avatar')
  @ApiOperation({ summary: 'Remove current user avatar' })
  @ApiResponse({ status: 200, description: 'User avatar removed successfully.' })
  @ApiResponse({ status: 401, description: 'Authentication is required.' })
  async removeAvatar(
    @Req() req: Request & { user: { id: number } },
  ): Promise<UserPublic> {
    return this.userService.removeAvatar(req.user.id);
  }
}


