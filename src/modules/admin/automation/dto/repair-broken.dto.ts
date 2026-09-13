import { IsIn, IsOptional } from 'class-validator';

export class RepairBrokenDto {
  @IsOptional()
  @IsIn(['ALL', 'MOVIES', 'SERIES', 'ANIME'])
  contentType?: 'ALL' | 'MOVIES' | 'SERIES' | 'ANIME';
}
