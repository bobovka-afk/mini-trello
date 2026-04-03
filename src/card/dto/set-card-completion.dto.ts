import { IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SetCardCompletionDto {
  @ApiProperty({
    example: true,
    description: 'Completion state of the card',
  })
  @IsBoolean()
  isCompleted: boolean;
}
