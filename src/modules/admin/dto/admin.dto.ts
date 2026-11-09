import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Length, Max, Min } from 'class-validator';

export class SearchDto {
  @IsString()
  @Length(2, 50, { message: 'La búsqueda debe tener entre 2 y 50 caracteres' })
  q: string;
}

export class ReasonDto {
  @IsString()
  @Length(3, 255, { message: 'Indicá un motivo (3 a 255 caracteres)' })
  reason: string;
}

export class OptionalReasonDto {
  @IsOptional()
  @IsString()
  @Length(0, 255)
  reason?: string;
}

export class SetVipDto extends OptionalReasonDto {
  @IsInt()
  @Min(0)
  @Max(3)
  level: number;

  /** Duración en días (requerida si level > 0). */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  days?: number;
}

export class AuditQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  target?: string;
}
