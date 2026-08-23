import { PartialType } from '@nestjs/mapped-types';
import { CreateDataExportDto } from './create-data-export.dto';

export class UpdateDataExportDto extends PartialType(CreateDataExportDto) {}
