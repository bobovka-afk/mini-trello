import { IsEmail, IsNotEmpty } from 'class-validator';

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @IsNotEmpty()
  email: string;
}
