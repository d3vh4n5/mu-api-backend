import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class ManifestFileDto {
  @IsString()
  @MinLength(1)
  path!: string;

  @IsInt()
  @Min(0)
  size!: number;

  @Matches(/^[0-9a-f]{64}$/i)
  sha256!: string;
}

export class ManifestDto {
  @IsString()
  version!: string;

  @IsInt()
  @Min(0)
  file_count!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ManifestFileDto)
  files!: ManifestFileDto[];
}

export class PublishDto {
  @ValidateNested()
  @Type(() => ManifestDto)
  manifest!: ManifestDto;

  /** Rutas a borrar de Client/ (modo espejo). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  delete?: string[];

  /** Archivos subidos que no van en el manifest (hoy solo launcher.exe). */
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  extraFiles?: string[];
}
