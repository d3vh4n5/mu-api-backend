/* eslint-disable @typescript-eslint/no-unsafe-call */
import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  username: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  password?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsString()
  @IsEmail()
  email: string;
}
