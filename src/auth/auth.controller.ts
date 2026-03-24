import {
	Body,
	Controller,
	Get,
	Post,
	Query,
	Req,
	UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { Res } from '@nestjs/common';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './guards/auth.guard';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(200)
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { refreshToken, ...response } = await this.authService.login(loginDto);
    this.authService.addRefreshTokenToResponse(res, refreshToken);
    return response;
  }

 	@HttpCode(200)
	@Post('login/access-token')
	async getNewTokens(
		@Req() req: Request,
		@Res({ passthrough: true }) res: Response
	) {
		const refreshTokenFromCookies = req.cookies[
			this.authService.REFRESH_TOKEN_NAME
		] as string | undefined

		if (!refreshTokenFromCookies) {
			this.authService.removeRefreshTokenFromResponse(res)
			throw new UnauthorizedException({
				code: 'REFRESH_TOKEN_REQUIRED',
				message: 'Refresh token is missing or invalid',
			})
		}

		const { refreshToken, ...response } =
			await this.authService.getNewTokens(refreshTokenFromCookies)
		this.authService.addRefreshTokenToResponse(res, refreshToken)
		return response
	}


	@HttpCode(200)
	@Post('logout')
	logout(@Res({ passthrough: true }) res: Response) {
		this.authService.removeRefreshTokenFromResponse(res)
		return true
	}

	@Post('email/verification/request')
	@HttpCode(200)
	requestEmailVerification(@Body() dto: ForgotPasswordDto) {
		return this.authService.requestEmailVerification(dto.email);
	}

	@Get('email/verification/confirm')
	async confirmEmailVerification(
		@Query('token') token: string,
		@Res() res: Response,
	) {
		let status = 'invalid';
		try {
			await this.authService.confirmEmailVerification(token);
			status = 'success';
		} catch {
			status = 'invalid';
		}

		const clientUrl = this.configService.get<string>('CLIENT_URL') || '';
		if (clientUrl) {
			return res.redirect(`${clientUrl}/email-verified?status=${status}`);
		}

		return res.json({ status });
	}

	@Post('password/reset/request')
	@HttpCode(200)
	requestPasswordReset(@Body() dto: ForgotPasswordDto) {
		return this.authService.requestPasswordReset(dto.email);
	}

	@Post('password/reset/confirm')
	@HttpCode(200)
	confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
		return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
	}


  @Get('google')
	@UseGuards(AuthGuard('google'))
	async googleAuth() {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	async googleAuthCallback(
		@Req() req: { user: { email: string; name: string; picture: string } },
		@Res({ passthrough: true }) res: Response
	) {
		const { refreshToken, ...response } =
			await this.authService.validateOAuthLogin(req)
		this.authService.addRefreshTokenToResponse(res, refreshToken)
		const clientUrl = this.configService.get<string>('CLIENT_URL') || ''
		res.redirect(
			`${clientUrl}/dashboard?accessToken=${response.accessToken}`
		)
	}

}