import { IsOptional, IsString, MaxLength, MinLength, IsEnum } from 'class-validator';
import { ListColorPreset } from '../../generated/prisma/enums';

export class UpdateListDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsEnum(ListColorPreset)
  colorPreset?: ListColorPreset;

}
