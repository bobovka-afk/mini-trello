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
import { Request } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/auth.guard';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/update-user.dto';
import * as fs from 'fs';
import { diskStorage } from 'multer';
import type { File as MulterFile } from 'multer';
import * as path from 'path';
import { randomUUID } from 'crypto';

@UseGuards(JwtAuthGuard)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('me')
  async getProfile(@Req() req: Request & { user: { id: number } }) {
    return this.userService.getById(String(req.user.id));
  }

  @Patch('me')
  async updateProfile(
    @Req() req: Request & { user: { id: number } },
    @Body() body: UpdateUserDto,
  ) {
    return this.userService.updateName(req.user.id, body.name);
  }

  @Patch('update-avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const dir = path.join(process.cwd(), 'uploads', 'avatars');
          fs.mkdirSync(dir, { recursive: true });
          cb(null, dir);
        },
        filename: (req: Request & { user?: { id?: number } }, file, cb) => {
          const userId = req.user?.id ?? 'anon';
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
  async updateAvatar(
    @Req() req: Request & { user: { id: number } },
    @UploadedFile() file?: MulterFile,
  ) {
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
  async removeAvatar(@Req() req: Request & { user: { id: number } }) {
    return this.userService.removeAvatar(req.user.id);
  }
}


