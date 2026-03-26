import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '../../generated/prisma/enums';

export class SendInviteDto {
  @IsEmail({})
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER])
  role: WorkspaceRole;
}
