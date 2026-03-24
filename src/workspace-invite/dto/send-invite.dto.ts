import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '../../generated/prisma/enums';

export class SendInviteDto {
  @IsEmail({}, { message: 'Некорректный email' })
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER], {
    message: 'Можно выбрать только ADMIN или MEMBER',
  })
  role: WorkspaceRole;
}
