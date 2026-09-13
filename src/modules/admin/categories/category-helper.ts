import { PrismaService } from '../../../prisma/prisma.service';

export const DEFAULT_CATEGORIES = [
  { name: '🔥 Trending Now', slug: 'trending', description: 'Top trending and highly-rated movies' },
  { name: '💥 Action & Blockbusters', slug: 'action', description: 'High-octane action and blockbuster movies' },
  { name: '🚀 Sci-Fi & Mind Bending', slug: 'sci-fi', description: 'Futuristic, space and mind-bending science fiction' },
  { name: '🎭 Drama & Stories', slug: 'drama', description: 'Gripping dramas and emotional stories' },
  { name: '😂 Comedy & Laughs', slug: 'comedy', description: 'Side-splitting comedies for family and friends' },
  { name: '🔍 Crime & Mystery', slug: 'crime', description: 'Thrilling crime investigations and mystery thrillers' },
  { name: '🗺️ Adventure & Exploration', slug: 'adventure', description: 'Exciting expeditions, fantasy, and adventure' },
  { name: '🎨 Animation & Family', slug: 'animation', description: 'Animated hits and family entertainment' },
  { name: '👻 Horror & Suspense', slug: 'horror', description: 'Spooky thrills, paranormal, and psychological horror' },
  { name: '❤️ Romance & Love', slug: 'romance', description: 'Heartwarming romances and love stories' },
  { name: '⚡ Thriller & Suspense', slug: 'thriller', description: 'Edge-of-the-seat thrillers and tension' },
  { name: '📺 Web Series & Shows', slug: 'web-series', description: 'Binge-worthy web series, drama serials, and TV shows with full episodes' },
  { name: '⛩️ Anime Series & Movies', slug: 'anime', description: 'Top Japanese anime series, movies, and animated sagas' },
  { name: '🎬 Bollywood Hits', slug: 'bollywood', description: 'Popular Hindi and Indian cinema' },
  { name: '🎬 Hindi Dubbed', slug: 'hindi-dubbed', description: 'Popular international movies dubbed in Hindi' },
  { name: '🍿 Hollywood Masterpieces', slug: 'hollywood', description: 'Critically acclaimed Hollywood masterworks' },
];

export async function ensureDefaultCategories(prisma: PrismaService) {
  for (const cat of DEFAULT_CATEGORIES) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }
}

export async function autoCategorizeMovie(prisma: PrismaService, movieId: string) {
  const movie = await prisma.movie.findUnique({
    where: { id: movieId },
    include: {
      genres: { include: { genre: true } },
    },
  });

  if (!movie) return;

  const matchedSlugs = new Set<string>();
  const genreNames = movie.genres.map((g) => g.genre.name.toLowerCase());

  // Genre mappings
  if (genreNames.some((g) => g.includes('action'))) matchedSlugs.add('action');
  if (genreNames.some((g) => g.includes('sci-fi') || g.includes('science fiction'))) matchedSlugs.add('sci-fi');
  if (genreNames.some((g) => g.includes('drama'))) matchedSlugs.add('drama');
  if (genreNames.some((g) => g.includes('comedy'))) matchedSlugs.add('comedy');
  if (genreNames.some((g) => g.includes('crime') || g.includes('mystery'))) matchedSlugs.add('crime');
  if (genreNames.some((g) => g.includes('adventure'))) matchedSlugs.add('adventure');
  if (genreNames.some((g) => g.includes('animation') || g.includes('family'))) matchedSlugs.add('animation');
  if (genreNames.some((g) => g.includes('horror'))) matchedSlugs.add('horror');
  if (genreNames.some((g) => g.includes('romance'))) matchedSlugs.add('romance');
  if (genreNames.some((g) => g.includes('thriller'))) matchedSlugs.add('thriller');

  // Source, language, and title heuristics
  const titleLower = movie.title.toLowerCase();
  const overviewLower = (movie.overview || '').toLowerCase();

  if (
    movie.language === 'hi' ||
    titleLower.includes('hindi') ||
    titleLower.includes('bollywood') ||
    overviewLower.includes('bollywood')
  ) {
    matchedSlugs.add('bollywood');
    matchedSlugs.add('hindi-dubbed');
  }

  if (
    movie.language === 'hi' &&
    (titleLower.includes('dubbed') || overviewLower.includes('hindi dubbed'))
  ) {
    matchedSlugs.add('hindi-dubbed');
  }

  if (movie.language === 'en' || !movie.language) {
    matchedSlugs.add('hollywood');
  }

  if (movie.syncPreset) {
    matchedSlugs.add(movie.syncPreset);
  }

  if (movie.featured || (movie.rating && movie.rating >= 7.0)) {
    matchedSlugs.add('trending');
  }

  // Link movie to all matched categories
  for (const slug of matchedSlugs) {
    const category = await prisma.category.findUnique({ where: { slug } });
    if (category) {
      await prisma.categoryMovie.upsert({
        where: {
          categoryId_movieId: {
            categoryId: category.id,
            movieId: movie.id,
          },
        },
        update: {},
        create: {
          categoryId: category.id,
          movieId: movie.id,
        },
      });
    }
  }
}

export async function autoCategorizeSeries(prisma: PrismaService, seriesId: string) {
  const series = await prisma.series.findUnique({
    where: { id: seriesId },
    include: {
      genres: { include: { genre: true } },
    },
  });

  if (!series) return;

  const matchedSlugs = new Set<string>();
  matchedSlugs.add('web-series');

  const genreNames = series.genres?.map((g) => g.genre.name.toLowerCase()) || [];
  const titleLower = series.title.toLowerCase();
  const overviewLower = (series.overview || '').toLowerCase();

  // Anime detection
  if (
    series.language === 'ja' ||
    series.contentType === 'ANIME' ||
    titleLower.includes('anime') ||
    overviewLower.includes('anime') ||
    (genreNames.some((g) => g.includes('animation')) && (series.language === 'ja' || titleLower.includes('naruto') || titleLower.includes('titan') || titleLower.includes('dragon') || titleLower.includes('jujutsu') || titleLower.includes('slayer')))
  ) {
    matchedSlugs.add('anime');
    matchedSlugs.add('animation');
  }

  // Genre mappings
  if (genreNames.some((g) => g.includes('action'))) matchedSlugs.add('action');
  if (genreNames.some((g) => g.includes('sci-fi') || g.includes('science fiction'))) matchedSlugs.add('sci-fi');
  if (genreNames.some((g) => g.includes('drama'))) matchedSlugs.add('drama');
  if (genreNames.some((g) => g.includes('comedy'))) matchedSlugs.add('comedy');
  if (genreNames.some((g) => g.includes('crime') || g.includes('mystery'))) matchedSlugs.add('crime');
  if (genreNames.some((g) => g.includes('adventure'))) matchedSlugs.add('adventure');
  if (genreNames.some((g) => g.includes('animation') || g.includes('family'))) matchedSlugs.add('animation');
  if (genreNames.some((g) => g.includes('horror'))) matchedSlugs.add('horror');
  if (genreNames.some((g) => g.includes('romance'))) matchedSlugs.add('romance');
  if (genreNames.some((g) => g.includes('thriller'))) matchedSlugs.add('thriller');

  if (series.language === 'hi' || titleLower.includes('bollywood') || titleLower.includes('hindi')) {
    matchedSlugs.add('bollywood');
    matchedSlugs.add('hindi-dubbed');
  }

  if (series.syncPreset) {
    matchedSlugs.add(series.syncPreset);
  }

  if (series.rating && series.rating >= 7.0) {
    matchedSlugs.add('trending');
  }

  // Link series to matched categories
  for (const slug of matchedSlugs) {
    const category = await prisma.category.findUnique({ where: { slug } });
    if (category) {
      await prisma.categorySeries.upsert({
        where: {
          categoryId_seriesId: {
            categoryId: category.id,
            seriesId: series.id,
          },
        },
        update: {},
        create: {
          categoryId: category.id,
          seriesId: series.id,
        },
      });
    }
  }
}

