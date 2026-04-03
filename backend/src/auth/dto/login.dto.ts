import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'User email address',
  })
  @IsEmail({})
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({
    example: 'qwerty123',
    description: 'User password',
    minLength: 6,
    maxLength: 72,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}
