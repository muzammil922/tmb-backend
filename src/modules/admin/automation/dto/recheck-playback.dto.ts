import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class RecheckPlaybackDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  movieIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seriesIds?: string[];

  @IsOptional()
  @IsBoolean()
  allBroken?: boolean;

  @IsOptional()
  @IsIn(['PENDING', 'WORKING', 'BROKEN'])
  playbackStatus?: 'PENDING' | 'WORKING' | 'BROKEN';
}
