import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class RunSyncDto {
  @IsOptional()
  @IsIn(['MOVIESAPI', 'IMDB3', 'ALL'])
  source?: 'MOVIESAPI' | 'IMDB3' | 'ALL';

  @IsOptional()
  @IsIn(['ALL', 'MOVIES', 'SERIES'])
  contentType?: 'ALL' | 'MOVIES' | 'SERIES';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  presets?: string[];

  @IsOptional()
  @IsBoolean()
  skipBroken?: boolean;
}
