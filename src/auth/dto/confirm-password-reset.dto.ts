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
	@MinLength(6)
	@MaxLength(72)
	newPassword: string;
}

