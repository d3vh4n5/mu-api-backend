import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUrl,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export const NEWS_CATEGORIES = ['novedad', 'evento', 'mantenimiento'] as const;
export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Alta de noticia (también la base de la edición). */
export class CreateNewsDto {
  @Transform(trim)
  @IsString()
  @Length(3, 120, { message: 'El título debe tener entre 3 y 120 caracteres' })
  title: string;

  /** Resumen corto para listados. Vacío = se arma con el inicio del contenido. */
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(0, 300, { message: 'El resumen admite hasta 300 caracteres' })
  summary?: string;

  /** Markdown. La web lo convierte a HTML filtrado. */
  @IsString()
  @Length(1, 20000, {
    message: 'El contenido debe tener entre 1 y 20000 caracteres',
  })
  content: string;

  @IsIn(NEWS_CATEGORIES, { message: 'Categoría inválida' })
  category: NewsCategory;

  @IsOptional()
  @Transform(trim)
  @ValidateIf((_, value) => value !== '' && value !== null)
  @IsUrl(
    { protocols: ['https', 'http'], require_protocol: true },
    { message: 'La imagen debe ser una URL http(s)' },
  )
  @Length(0, 500)
  imageUrl?: string | null;

  @IsBoolean()
  published: boolean;

  @IsBoolean()
  pinned: boolean;

  /** Fecha visible (ISO). Sin fecha, al publicar se usa el momento actual. */
  @IsOptional()
  @ValidateIf((_, value) => value !== null)
  @IsISO8601({}, { message: 'Fecha de publicación inválida' })
  publishedAt?: string | null;
}

export class UpdateNewsDto extends CreateNewsDto {}

export class NewsListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
