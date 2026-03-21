import {
    IsString,
    MinLength,
    MaxLength,
    IsNotEmpty,
    IsOptional,
  } from 'class-validator';
  
  export class CreateWorkspaceDto {

    @IsString()
    @IsNotEmpty()
    @MinLength(3, { message: 'Имя должно содержать не менее 3 символов' })
    @MaxLength(18, { message: 'Имя не более 18 символов' })
    name: string;

    @IsString()
    @IsOptional()
    @MinLength(3, { message: 'Описание должно содержать не менее 3 символов' })
    @MaxLength(255, { message: 'Описание не более 255 символов' })
    description: string;
  

  }