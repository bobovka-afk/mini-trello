import { IsString, MinLength, MaxLength, IsOptional } from 'class-validator';
import { AtLeastOneOf } from './at-least-one-of.decorator';

export class UpdateWorkspaceDto {
  /** Служебное поле: проверка «хотя бы name или description» (не передавать с клиента). */
  @AtLeastOneOf(['name', 'description'], {
    message: 'Укажите хотя бы одно поле: name или description',
  })
  private readonly _atLeastOne?: undefined;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Имя должно содержать не менее 3 символов' })
  @MaxLength(18, { message: 'Имя не более 18 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3, { message: 'Описание должно содержать не менее 3 символов' })
  @MaxLength(255, { message: 'Описание не более 255 символов' })
  description?: string;
}