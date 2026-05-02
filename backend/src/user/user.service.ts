import { Injectable } from '@nestjs/common';
import { User } from '../generated/prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from '../auth/dto/register.dto';
import type { UserPublic } from './interface';
import type { UserPublicRow } from './type';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getById(id: string): Promise<UserPublic | null> {
    const userId = Number(id);
    if (!Number.isInteger(userId)) return null;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        passwordHash: true,
        createdAt: true,
      },
    });
    if (!user) return null;
    return this.toUserPublic(user);
  }

  async findByEmail(email: string): Promise<User | null> {
    const normalizedEmail = this.normalizeEmail(email);
    return this.prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
  }

  async create(dto: RegisterDto): Promise<UserPublic> {
    const normalizedEmail = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name: dto.name,
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
    });
    return this.toUserPublic(user);
  }

  async createOAuthUser(
    email: string,
    name: string,
    picture: string,
  ): Promise<User> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.prisma.user.create({
      data: {
        email: normalizedEmail,
        name,
        avatarPath: picture,
        emailVerifiedAt: new Date(),
      },
    });

    return user;
  }

  async updateAvatar(id: number, avatarPath: string): Promise<UserPublic> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarPath },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        passwordHash: true,
        createdAt: true,
      },
    });
    return this.toUserPublic(user);
  }

  async removeAvatar(id: number): Promise<UserPublic> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { avatarPath: null },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        passwordHash: true,
        createdAt: true,
      },
    });
    return this.toUserPublic(user);
  }

  async updateName(id: number, name: string): Promise<UserPublic> {
    const user = await this.prisma.user.update({
      where: { id },
      data: { name },
      select: {
        id: true,
        email: true,
        name: true,
        avatarPath: true,
        passwordHash: true,
        createdAt: true,
      },
    });
    return this.toUserPublic(user);
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private toUserPublic(user: UserPublicRow): UserPublic {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarPath: user.avatarPath,
      hasPassword: Boolean(user.passwordHash),
      createdAt: user.createdAt,
    };
  }
}
