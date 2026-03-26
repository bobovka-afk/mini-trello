import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({})
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(18)
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(72)
  password: string;
}