import { IsIn, IsInt, IsOptional, IsString, IsUrl } from 'class-validator';

export class PublishOwnDto {
  @IsIn(['embed', 'hosted'])
  mode: 'embed' | 'hosted';

  @IsOptional()
  @IsUrl()
  videoUrl?: string;

  @IsOptional()
  @IsString()
  videoProvider?: string;

  @IsOptional()
  @IsInt()
  videoDuration?: number;
}
