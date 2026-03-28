import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class MoveCardDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  toListId: number;

  /** Индекс в целевом списке (0 — в начало, length — в конец). */
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  position: number;
}
