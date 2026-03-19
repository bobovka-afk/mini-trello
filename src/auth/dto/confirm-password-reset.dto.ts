import {
	IsNotEmpty,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';

export class ConfirmPasswordResetDto {
	@IsString()
	@IsNotEmpty()
	token: string;

	@IsString()
	@IsNotEmpty()
	@MinLength(6, { message: 'Пароль должен содержать не менее 6 символов' })
	@MaxLength(72, { message: 'Пароль не более 72 символов' })
	newPassword: string;
}

