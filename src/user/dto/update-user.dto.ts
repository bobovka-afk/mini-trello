import { IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto {
  @ApiProperty({
    example: 'Igor Petrov',
    description: 'Updated display name',
    minLength: 3,
    maxLength: 18,
  })
  @IsString()
  @MinLength(3)
  @MaxLength(18)
  name: string;
}
