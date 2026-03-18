import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Пароль должен содержать не менее 6 символов' })
  @MaxLength(72, { message: 'Пароль не более 72 символов' })
  newPassword: string;
}
