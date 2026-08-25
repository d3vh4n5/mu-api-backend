import { IsString, MinLength } from 'class-validator';

export class GetVersionDto {
  @IsString()
  @MinLength(5)
  version: string;
}
