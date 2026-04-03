import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateBoardDto {
  @ApiPropertyOptional({
    example: 'Sprint backlog',
    description: 'Updated board name',
    minLength: 3,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @ApiPropertyOptional({
    example: 'Updated board description',
    description: 'Updated board description',
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
