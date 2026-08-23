/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10)
  username: string;

  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(10)
  password?: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10)
  name: string;

  @IsString()
  @IsEmail()
  @MaxLength(50)
  email: string;
}
