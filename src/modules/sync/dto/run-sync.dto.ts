import { IsIn, IsOptional } from 'class-validator';

export class RunSyncDto {
  @IsOptional()
  @IsIn(['URDBOX', 'MOVIESAPI', 'IMDB3', 'ALL'])
  source?: 'URDBOX' | 'MOVIESAPI' | 'IMDB3' | 'ALL';
}
