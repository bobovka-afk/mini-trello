import { IsString, MinLength, MaxLength } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(18)
  name: string;
}
