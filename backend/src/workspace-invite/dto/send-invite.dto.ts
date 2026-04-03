import { IsEmail, IsIn, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';
import { WorkspaceRole } from '../../generated/prisma/enums';
import { ApiProperty } from '@nestjs/swagger';

export class SendInviteDto {
  @ApiProperty({
    example: 'member@example.com',
    description: 'Email of the invited user',
  })
  @IsEmail({})
  @IsNotEmpty()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  email: string;

  @ApiProperty({
    enum: [WorkspaceRole.ADMIN, WorkspaceRole.MEMBER],
    example: WorkspaceRole.MEMBER,
    description: 'Role to assign after invite acceptance',
  })
  @IsIn([WorkspaceRole.ADMIN, WorkspaceRole.MEMBER])
  role: WorkspaceRole;
}
