import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class AddPointsDto {
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  strength?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  dexterity?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  vitality?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  energy?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(32767)
  leadership?: number;
}
