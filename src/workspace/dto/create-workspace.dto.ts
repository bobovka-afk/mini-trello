import {
  IsString,
  MinLength,
  MaxLength,
  IsNotEmpty,
  IsOptional,
} from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  @MaxLength(18)
  name: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string | null;
}
