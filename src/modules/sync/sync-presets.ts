export type SyncPresetId =
  | 'trending'
  | 'netflix'
  | 'prime'
  | 'hulu'
  | 'disney'
  | 'bollywood'
  | 'hollywood'
  | 'anime';

export interface SyncPreset {
  id: SyncPresetId;
  label: string;
  movieDiscover?: Record<string, string | number>;
  tvDiscover?: Record<string, string | number>;
  useTrendingMovies?: boolean;
  useTrendingTv?: boolean;
}

const WATCH_REGION = process.env.TMDB_WATCH_REGION || 'US';

export const SYNC_PRESETS: Record<SyncPresetId, SyncPreset> = {
  trending: {
    id: 'trending',
    label: 'Trending',
    useTrendingMovies: true,
    useTrendingTv: true,
  },
  netflix: {
    id: 'netflix',
    label: 'Netflix',
    movieDiscover: {
      with_watch_providers: '8',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_watch_providers: '8',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
  },
  prime: {
    id: 'prime',
    label: 'Prime Video',
    movieDiscover: {
      with_watch_providers: '9',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_watch_providers: '9',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
  },
  hulu: {
    id: 'hulu',
    label: 'Hulu',
    movieDiscover: {
      with_watch_providers: '15',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_watch_providers: '15',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
  },
  disney: {
    id: 'disney',
    label: 'Disney+',
    movieDiscover: {
      with_watch_providers: '337',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_watch_providers: '337',
      watch_region: WATCH_REGION,
      sort_by: 'popularity.desc',
    },
  },
  bollywood: {
    id: 'bollywood',
    label: 'Bollywood',
    movieDiscover: {
      with_original_language: 'hi',
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_original_language: 'hi',
      sort_by: 'popularity.desc',
    },
  },
  hollywood: {
    id: 'hollywood',
    label: 'Hollywood',
    movieDiscover: {
      with_original_language: 'en',
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_original_language: 'en',
      sort_by: 'popularity.desc',
    },
  },
  anime: {
    id: 'anime',
    label: 'Anime',
    movieDiscover: {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
    },
    tvDiscover: {
      with_genres: '16',
      with_original_language: 'ja',
      sort_by: 'popularity.desc',
    },
  },
};

export const DEFAULT_SYNC_PRESETS: SyncPresetId[] = ['trending', 'anime', 'hollywood', 'bollywood'];

export function resolvePresets(presets?: string[]): SyncPresetId[] {
  if (!presets?.length) return DEFAULT_SYNC_PRESETS;
  return presets.filter((p): p is SyncPresetId => p in SYNC_PRESETS);
}
