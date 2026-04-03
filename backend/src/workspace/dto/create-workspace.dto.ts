import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkspaceDto {
  @ApiProperty({
    example: 'Product team',
    description: 'Workspace name',
    minLength: 3,
    maxLength: 18,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(18)
  name: string;

  @ApiPropertyOptional({
    example: 'Main workspace for product planning',
    description: 'Workspace description',
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
