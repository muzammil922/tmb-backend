import { ContentSource, PlaybackMode, PlaybackStatus, Prisma } from '@prisma/client';

export const excludeUrduBoxFilter: Prisma.MovieWhereInput = {
  NOT: [
    { contentSource: ContentSource.URDBOX },
    { playbackMode: PlaybackMode.URDBOX },
  ],
};

export const excludeUrduBoxSeriesFilter: Prisma.SeriesWhereInput = {
  NOT: [
    { contentSource: ContentSource.URDBOX },
    { playbackMode: PlaybackMode.URDBOX },
  ],
};

export const publicMovieFilter: Prisma.MovieWhereInput = {
  ...excludeUrduBoxFilter,
  playbackStatus: { not: PlaybackStatus.BROKEN },
};

export const publicSeriesFilter: Prisma.SeriesWhereInput = {
  ...excludeUrduBoxSeriesFilter,
  playbackStatus: { not: PlaybackStatus.BROKEN },
};
