import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSyncSettingsDto {
  @IsOptional()
  @IsBoolean()
  urduboxEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  moviesApiEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  automationEnabled?: boolean;

  @IsOptional()
  @IsString()
  scheduleStart?: string | null;

  @IsOptional()
  @IsString()
  scheduleEnd?: string | null;

  @IsOptional()
  @IsString()
  cronExpression?: string | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  maxPagesPerRun?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  resultsPerPage?: number;
}
