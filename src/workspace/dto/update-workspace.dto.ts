import {
  IsString,
  MinLength,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(18)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string | null;
}
