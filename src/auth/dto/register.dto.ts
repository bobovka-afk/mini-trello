import {
  IsString,
  MinLength,
  MaxLength,
  IsEmail,
  IsNotEmpty,
} from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Имя должно содержать не менее 3 символов' })
  @MaxLength(18, { message: 'Имя не более 18 символов' })
  name: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов' })
  @MaxLength(72, { message: 'Пароль не более 72 символов' })
  password: string;
}