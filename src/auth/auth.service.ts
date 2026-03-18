import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { UserService } from '../user/user.service';
import { JwtService } from '@nestjs/jwt';
import { Response } from 'express';
import { User } from '../generated/prisma/client';
import { ConfigService } from '@nestjs/config';


@Injectable()
export class AuthService {
  private readonly EXPIRE_DAY_REFRESH_TOKEN = 7
  public readonly REFRESH_TOKEN_NAME = 'refreshToken'

  constructor(
    private readonly userService: UserService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(registerDto: RegisterDto) {
    const oldUser = await this.userService.findByEmail(registerDto.email);
    if (oldUser) {
      throw new BadRequestException('Пользователь с таким email уже существует');
    }
    return this.userService.create(registerDto);
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


}
