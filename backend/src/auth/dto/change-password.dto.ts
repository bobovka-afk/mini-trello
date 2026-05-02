import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'oldPassword123',
    description: 'Current user password (required when password already exists)',
    required: false,
    minLength: 6,
    maxLength: 72,
  })
  @IsOptional()
  @IsString()
  @MinLength(6)
  @MaxLength(72)
  currentPassword?: string;

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
