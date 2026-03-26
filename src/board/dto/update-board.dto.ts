import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateBoardDto {
  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  description?: string;

}
