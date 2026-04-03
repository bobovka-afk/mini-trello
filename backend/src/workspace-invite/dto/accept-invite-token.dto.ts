import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AcceptInviteTokenDto {
  @ApiProperty({
    example: '2c1fd3b7c6f749f0a2d6d8f5d0d11c28',
    description: 'Workspace invite token',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
