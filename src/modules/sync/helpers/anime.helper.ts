export interface AnimeDetectInput {
  original_language?: string | null;
  origin_country?: string[] | null;
  genre_ids?: number[];
  genres?: { id: number }[];
  contentType?: string | null;
}

export function isAnimeContent(item: AnimeDetectInput, details?: AnimeDetectInput | null): boolean {
  const d = details ?? item;
  if (d.contentType === 'ANIME') return true;

  const lang = d.original_language;
  const countries = d.origin_country ?? [];
  const genreIds = d.genre_ids ?? (d.genres ?? []).map((g) => g.id);
  const hasAnimation = genreIds.includes(16);

  return hasAnimation && (lang === 'ja' || countries.includes('JP'));
}
