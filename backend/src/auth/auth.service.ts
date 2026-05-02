import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { User } from '../generated/prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { AuthTokenType } from '../generated/prisma/enums';
import type { AuthTokens, AuthUserSnippet } from './interface';
import type {
  LoginResult,
  OAuthLoginResult,
  RefreshTokensResult,
  RegisterResult,
} from './type';

@Injectable()
export class AuthService {
  private readonly EXPIRE_DAY_REFRESH_TOKEN = 7
  public readonly REFRESH_TOKEN_NAME = 'refreshToken'

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async register(registerDto: RegisterDto): Promise<RegisterResult> {
    const normalizedEmail = this.normalizeEmail(registerDto.email);
    const oldUser = await this.userService.findByEmail(normalizedEmail);
    if (oldUser) {
      throw new BadRequestException({
        code: 'EMAIL_ALREADY_EXISTS',
        message: 'User with this email already exists',
      });
    }

    const user = await this.userService.create({
      ...registerDto,
      email: normalizedEmail,
    });
    try {
      await this.requestEmailVerification(normalizedEmail);
    } catch (error) {
      console.error('Failed to send email verification message:', error);
    }

    return user;
  }

  async login(loginDto: LoginDto): Promise<LoginResult> {
    return this.signIn(loginDto);
  }

  async getNewTokens(refreshToken: string): Promise<RefreshTokensResult> {
    try {
        const result = await this.jwtService.verifyAsync<{ id: string }>(
            refreshToken
        )

        const user = await this.userService.getById(result.id)
        if (!user) {
            throw new UnauthorizedException({
              code: 'USER_NOT_FOUND',
              message: 'User not found',
            })
        }

        const tokens = this.issueTokens(user.id)

        return { user, ...tokens }
    } catch {
        throw new UnauthorizedException({
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Invalid refresh token',
        })
    }
}


  issueTokens(userId: number): AuthTokens {
    const data = { id: String(userId) }

    const accessToken = this.jwtService.sign(data, {
        expiresIn: '1h'
    })

    const refreshToken = this.jwtService.sign(data, {
        expiresIn: '7d'
    })

    return { accessToken, refreshToken }
}

  async validateOAuthLogin(req: {
    user: { email: string; name: string; picture: string };
  }): Promise<OAuthLoginResult> {
    const normalizedEmail = this.normalizeEmail(req.user.email);
    let user: User | null = await this.userService.findByEmail(
        normalizedEmail
    )

    if (!user) {
        user = await this.userService.createOAuthUser(
            normalizedEmail,
            req.user.name,
            req.user.picture
        )
    } else if (!user.emailVerifiedAt) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerifiedAt: new Date() },
      });
    }
    const tokens = this.issueTokens(user!.id);

    return { user: user!, ...tokens };
  }

  addRefreshTokenToResponse(res: Response, refreshToken: string): void {
    const expiresIn = new Date()
    expiresIn.setDate(expiresIn.getDate() + this.EXPIRE_DAY_REFRESH_TOKEN)

    res.cookie(this.REFRESH_TOKEN_NAME, refreshToken, {
        httpOnly: true,
        domain: this.configService.get('SERVER_DOMAIN'),
        expires: expiresIn,
        secure: true,
        sameSite: 'none'
    })
}

  removeRefreshTokenFromResponse(res: Response): void {
    res.cookie(this.REFRESH_TOKEN_NAME, '', {
        httpOnly: true,
        domain: this.configService.get('SERVER_DOMAIN'),
        expires: new Date(0),
        secure: true,
        sameSite: 'none'
    })
}

  async requestEmailVerification(email: string): Promise<{ ok: boolean }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userService.findByEmail(normalizedEmail);

    if (!user || user.emailVerifiedAt) return { ok: true };

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);

    const expiresAt = new Date(Date.now() + this.getEmailVerificationTtlMs());

    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        type: AuthTokenType.EMAIL_VERIFICATION,
        tokenHash,
        expiresAt,
      },
    });

    const serverUrl = this.configService.get<string>('SERVER_URL') || '';
    const verificationUrl = `${serverUrl}/auth/email/verification/confirm?token=${token}`;

    await this.mailService.sendEmailVerification(user.email, verificationUrl);
    return { ok: true };
  }

  async confirmEmailVerification(token: string): Promise<{ ok: boolean }> {
    if (!token) {
      throw new BadRequestException({
        code: 'TOKEN_REQUIRED',
        message: 'Token is required',
      });
    }

    const tokenHash = this.hashToken(token);
    const authToken = await this.prisma.authToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    const now = new Date();
    const isValid =
      authToken &&
      authToken.type === AuthTokenType.EMAIL_VERIFICATION &&
      !authToken.usedAt &&
      authToken.expiresAt > now;

    if (!isValid) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: 'Token is invalid or expired',
      });
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authToken!.userId },
        data: { emailVerifiedAt: now },
      }),
      this.prisma.authToken.update({
        where: { id: authToken!.id },
        data: { usedAt: now },
      }),
    ]);

    return { ok: true };
  }

  async requestPasswordReset(email: string): Promise<{ ok: boolean }> {
    const normalizedEmail = this.normalizeEmail(email);
    const user = await this.userService.findByEmail(normalizedEmail);

    if (!user) return { ok: true };

    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + this.getPasswordResetTtlMs());

    await this.prisma.authToken.create({
      data: {
        userId: user.id,
        type: AuthTokenType.PASSWORD_RESET,
        tokenHash,
        expiresAt,
      },
    });

    const clientUrl = this.configService.get<string>('CLIENT_URL') || '';
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;

    await this.mailService.sendPasswordReset(user.email, resetUrl);
    return { ok: true };
  }

  async confirmPasswordReset(
    token: string,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    if (!token) {
      throw new BadRequestException({
        code: 'TOKEN_REQUIRED',
        message: 'Token is required',
      });
    }

    if (!newPassword) {
      throw new BadRequestException({
        code: 'PASSWORD_REQUIRED',
        message: 'Password is required',
      });
    }

    const tokenHash = this.hashToken(token);
    const authToken = await this.prisma.authToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    const now = new Date();
    const isValid =
      authToken &&
      authToken.type === AuthTokenType.PASSWORD_RESET &&
      !authToken.usedAt &&
      authToken.expiresAt > now;

    if (!isValid) {
      throw new BadRequestException({
        code: 'TOKEN_INVALID_OR_EXPIRED',
        message: 'Token is invalid or expired',
      });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: authToken!.userId },
        data: { passwordHash },
      }),
      this.prisma.authToken.update({
        where: { id: authToken!.id },
        data: { usedAt: now },
      }),
    ]);

    return { ok: true };
  }

  async changePassword(
    userId: number,
    currentPassword: string | undefined,
    newPassword: string,
  ): Promise<{ ok: boolean }> {
    if (!newPassword) {
      throw new BadRequestException({
        code: 'NEW_PASSWORD_REQUIRED',
        message: 'New password is required',
      });
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    if (user.passwordHash) {
      if (!currentPassword) {
        throw new BadRequestException({
          code: 'CURRENT_PASSWORD_REQUIRED',
          message: 'Current password is required',
        });
      }
      if (currentPassword === newPassword) {
        throw new BadRequestException({
          code: 'PASSWORD_SHOULD_DIFFER',
          message: 'New password must be different from current password',
        });
      }

      const isCurrentPasswordValid = await bcrypt.compare(
        currentPassword,
        user.passwordHash,
      );
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException({
          code: 'INVALID_CURRENT_PASSWORD',
          message: 'Current password is invalid',
        });
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return { ok: true };
  }

  private async signIn(loginDto: LoginDto): Promise<LoginResult> {
    const user = await this.validateUser(loginDto);
    const tokens = this.issueTokens(user.id);
    return { user, ...tokens };
  }

  private async validateUser(loginDto: LoginDto): Promise<AuthUserSnippet> {
    const normalizedEmail = this.normalizeEmail(loginDto.email);
    const user = await this.userService.findByEmail(normalizedEmail);
    if (!user) {
      this.throwInvalidCredentials();
    }
    if (!user.passwordHash) {
      this.throwInvalidCredentials();
    }
    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      this.throwInvalidCredentials();
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private throwInvalidCredentials(): never {
    throw new UnauthorizedException({
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    });
  }

  private generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  private hashToken(token: string) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private getEmailVerificationTtlMs() {
    const minutes =
      Number(this.configService.get('EMAIL_VERIFICATION_TTL_MINUTES')) ||
      60 * 24;
    return minutes * 60 * 1000;
  }

  private getPasswordResetTtlMs() {
    const minutes =
      Number(this.configService.get('PASSWORD_RESET_TTL_MINUTES')) || 30;
    return minutes * 60 * 1000;
  }


}
