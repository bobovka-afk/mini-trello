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

  async register(registerDto: RegisterDto) {
    const oldUser = await this.userService.findByEmail(registerDto.email);
    if (oldUser) {
      throw new BadRequestException('Пользователь с таким email уже существует');
    }

    const user = await this.userService.create(registerDto);
    try {
      await this.requestEmailVerification(registerDto.email);
    } catch (error) {
      console.error('Не удалось отправить письмо для подтверждения email:', error);
    }

    return user;
  }

  async login(loginDto: LoginDto) {
    return this.signIn(loginDto);
  }

  private async signIn(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto);
    const tokens = this.issueTokens(user.id);
    return { user, ...tokens };
  }


  private async validateUser(loginDto: LoginDto) {
    const user = await this.userService.findByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    const isMatch = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedException('Неверный email или пароль');
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async getNewTokens(refreshToken: string) {
    try {
        const result = await this.jwtService.verifyAsync<{ id: string }>(
            refreshToken
        )

        const user = await this.userService.getById(result.id)
        if (!user) {
            throw new UnauthorizedException('Пользователь не найден')
        }

        const tokens = this.issueTokens(user.id)

        return { user, ...tokens }
    } catch {
        throw new UnauthorizedException('Невалидный refresh токен')
    }
}


issueTokens(userId: number) {
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
    user: { email: string; name: string; picture: string }
}) {
    let user: User | null = await this.userService.getByEmail(
        req.user.email
    )

    if (!user) {
        user = await this.userService.createOAuthUser(
            req.user.email,
            req.user.name,
            req.user.picture
        )
    } else if (!user.emailVerifiedAt) {
        user = await this.prisma.user.update({
            where: { id: user.id },
            data: { emailVerifiedAt: new Date() },
        });
    }

    const tokens = this.issueTokens(user.id)

    return { user, ...tokens }
}

addRefreshTokenToResponse(res: Response, refreshToken: string) {
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

removeRefreshTokenFromResponse(res: Response) {
    res.cookie(this.REFRESH_TOKEN_NAME, '', {
        httpOnly: true,
        domain: this.configService.get('SERVER_DOMAIN'),
        expires: new Date(0),
        secure: true,
        sameSite: 'none'
    })
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

  async requestEmailVerification(email: string) {
    const user = await this.userService.findByEmail(email);

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

  async confirmEmailVerification(token: string) {
    if (!token) {
      throw new BadRequestException('Токен не передан');
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
      throw new BadRequestException('Невалидный или истекший токен');
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

  async requestPasswordReset(email: string) {
    const user = await this.userService.findByEmail(email);

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

  async confirmPasswordReset(token: string, newPassword: string) {
    if (!token) {
      throw new BadRequestException('Токен не передан');
    }

    if (!newPassword) {
      throw new BadRequestException('Пароль не передан');
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
      throw new BadRequestException('Невалидный или истекший токен');
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


}
