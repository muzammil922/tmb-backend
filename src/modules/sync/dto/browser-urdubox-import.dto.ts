import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, ValidateIf, ValidateNested } from 'class-validator';

export class BrowserUrduboxItemDto {
  @IsInt()
  tmdbId: number;

  @IsString()
  upstreamId: string;

  @IsIn(['movie', 'series'])
  type: 'movie' | 'series';
}

export class BrowserUrduboxBatchDto {
  @IsString()
  jobId: string;

  @ValidateIf((o) => !o.finalize)
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => BrowserUrduboxItemDto)
  items: BrowserUrduboxItemDto[];

  @IsOptional()
  @IsBoolean()
  finalize?: boolean;
}
