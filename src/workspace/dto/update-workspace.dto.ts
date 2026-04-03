import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateWorkspaceDto {
  @ApiPropertyOptional({
    example: 'Product team',
    description: 'Updated workspace name',
    minLength: 3,
    maxLength: 18,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(18)
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated description for the workspace',
    description: 'Updated workspace description',
    minLength: 3,
    maxLength: 255,
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string | null;
}
