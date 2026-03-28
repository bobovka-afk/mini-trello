import { IsNotEmpty, IsString } from 'class-validator';

export class AcceptInviteTokenDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
