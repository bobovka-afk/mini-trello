import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class MoveCardDto {
  @ApiProperty({
    example: 12,
    description: 'Target list id',
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toListId: number;

  @ApiProperty({
    example: 0,
    description: 'New card position in target list',
    minimum: 0,
    maximum: 100000,
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  position: number;
}
