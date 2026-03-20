import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string) {
    const userId = Number(id);
    if (!Number.isInteger(userId)) return null;

    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        createdAt: true,
      },
    });
  }

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async getByEmail(email: string) {
    return this.findByEmail(email);
  }

  async create(dto: RegisterDto) {
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async createOAuthUser(email: string, name: string, picture: string) {
    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        avatarPath: picture,
        emailVerifiedAt: new Date(),
      },
    });

    return user;
  }

  async updateAvatar(id: number, avatarPath: string) {
    return this.prisma.user.update({
      where: { id },
      data: { avatarPath },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        createdAt: true,
      },
    });
  }

  async removeAvatar(id: number) {
    return this.prisma.user.update({
      where: { id },
      data: { avatarPath: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        createdAt: true,
      },
    });
  }
}
