import { IsBoolean } from 'class-validator';

export class SetCardCompletionDto {
  @IsBoolean()
  isCompleted: boolean;
}
