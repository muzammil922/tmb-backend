import { IsIn, IsOptional } from 'class-validator';

export class RunSyncDto {
  @IsOptional()
  @IsIn(['URDBOX', 'MOVIESAPI', 'ALL'])
  source?: 'URDBOX' | 'MOVIESAPI' | 'ALL';
}
