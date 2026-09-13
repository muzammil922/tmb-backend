import { IsIn, IsOptional, IsString } from 'class-validator';

export class BulkDeleteDto {
  @IsOptional()
  @IsIn(['PENDING', 'WORKING', 'BROKEN'])
  playbackStatus?: 'PENDING' | 'WORKING' | 'BROKEN';

  @IsOptional()
  @IsString()
  contentSource?: string;

  @IsOptional()
  @IsString()
  syncPreset?: string;

  @IsOptional()
  @IsString()
  contentType?: string;
}
