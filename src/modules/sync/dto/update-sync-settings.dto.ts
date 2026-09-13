import { IsBoolean, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class UpdateSyncSettingsDto {
  @IsOptional()
  @IsBoolean()
  moviesApiEnabled?: boolean;

  @IsOptional()
  @IsBoolean()
  imdb3Enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  automationEnabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(168)
  syncIntervalHours?: number;

  @IsOptional()
  @IsInt()
  lastImdb3Id?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(25)
  imdb3DailyCount?: number;

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
