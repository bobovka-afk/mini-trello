import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Min } from 'class-validator';

export class MoveListDto {
  @ApiProperty({
    description: 'New list index within the board (0-based)',
    example: 0,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  position: number;
}
