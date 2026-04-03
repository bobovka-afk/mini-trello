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
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ConfirmPasswordResetDto } from './dto/confirm-password-reset.dto';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  @Post('register')
  @HttpCode(200)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 200, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid registration data' })
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  @Post('login')
  @HttpCode(200)
  @ApiOperation({ summary: 'Authenticate user with email and password' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
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
	@ApiOperation({ summary: 'Issue new tokens using refresh cookie' })
	@ApiResponse({ status: 200, description: 'New access token issued' })
	@ApiResponse({ status: 401, description: 'Refresh token is missing or invalid' })
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
	@ApiOperation({ summary: 'Clear refresh token cookie' })
	@ApiResponse({ status: 200, description: 'User logged out successfully' })
	logout(@Res({ passthrough: true }) res: Response) {
		this.authService.removeRefreshTokenFromResponse(res)
		return true
	}

	@Post('email/verification/request')
	@HttpCode(200)
	@ApiOperation({ summary: 'Send email verification message' })
	@ApiResponse({ status: 200, description: 'Email verification request accepted' })
	requestEmailVerification(@Body() dto: ForgotPasswordDto) {
		return this.authService.requestEmailVerification(dto.email);
	}

	@Get('email/verification/confirm')
	@ApiOperation({ summary: 'Confirm email verification token' })
	@ApiQuery({
		name: 'token',
		required: true,
		example: '4b3bc6b2f0b84d8e91fd0d2cb1ad4e5b',
		description: 'Email verification token',
	})
	@ApiResponse({ status: 200, description: 'Email verification processed' })
	@ApiResponse({ status: 302, description: 'Redirects to client after verification' })
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
	@ApiOperation({ summary: 'Send password reset email' })
	@ApiResponse({ status: 200, description: 'Password reset request accepted' })
	requestPasswordReset(@Body() dto: ForgotPasswordDto) {
		return this.authService.requestPasswordReset(dto.email);
	}

	@Post('password/reset/confirm')
	@HttpCode(200)
	@ApiOperation({ summary: 'Confirm password reset token' })
	@ApiResponse({ status: 200, description: 'Password reset completed' })
	@ApiResponse({ status: 400, description: 'Token is invalid or expired' })
	confirmPasswordReset(@Body() dto: ConfirmPasswordResetDto) {
		return this.authService.confirmPasswordReset(dto.token, dto.newPassword);
	}


  @Get('google')
	@UseGuards(AuthGuard('google'))
	@ApiOperation({ summary: 'Start Google OAuth flow' })
	@ApiResponse({ status: 302, description: 'Redirects user to Google OAuth' })
	async googleAuth() {}

	@Get('google/callback')
	@UseGuards(AuthGuard('google'))
	@ApiOperation({ summary: 'Handle Google OAuth callback' })
	@ApiResponse({ status: 302, description: 'Redirects user back to the client application' })
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