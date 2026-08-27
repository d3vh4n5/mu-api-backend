import { IsBoolean, IsOptional } from 'class-validator';

export class ServerResetDto {
  @IsBoolean()
  @IsOptional()
  resetCharacters?: boolean;

  @IsBoolean()
  @IsOptional()
  resetMembInfo?: boolean;

  @IsBoolean()
  @IsOptional()
  resetWarehouses?: boolean;

  @IsBoolean()
  @IsOptional()
  resetGuilds?: boolean;

  @IsBoolean()
  @IsOptional()
  resetRankings?: boolean;

  @IsBoolean()
  @IsOptional()
  resetSocialData?: boolean;
}
