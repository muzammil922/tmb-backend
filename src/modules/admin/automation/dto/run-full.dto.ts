import { IsArray, IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';

export class RunFullDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  presets?: string[];

  @IsOptional()
  @IsBoolean()
  skipBroken?: boolean;

  @IsOptional()
  @IsIn(['ALL', 'MOVIES', 'SERIES'])
  contentType?: 'ALL' | 'MOVIES' | 'SERIES';
}
