import {
	IsNotEmpty,
	IsString,
	MaxLength,
	MinLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConfirmPasswordResetDto {
	@ApiProperty({
		example: '4b3bc6b2f0b84d8e91fd0d2cb1ad4e5b',
		description: 'Password reset token',
	})
	@IsString()
	@IsNotEmpty()
	token: string;

	@ApiProperty({
		example: 'newStrongPassword123',
		description: 'New user password',
		minLength: 6,
		maxLength: 72,
	})
	@IsString()
	@IsNotEmpty()
	@MinLength(6)
	@MaxLength(72)
	newPassword: string;
}

