import { IsOptional, IsString, MaxLength, MinLength, IsEnum } from 'class-validator';
import { ListColorPreset } from '../../generated/prisma/enums';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateListDto {
  @ApiPropertyOptional({
    example: 'Done',
    description: 'Updated list name',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    enum: ListColorPreset,
    example: ListColorPreset.GREEN,
    description: 'Color preset for the list',
  })
  @IsOptional()
  @IsEnum(ListColorPreset)
  colorPreset?: ListColorPreset;

}
