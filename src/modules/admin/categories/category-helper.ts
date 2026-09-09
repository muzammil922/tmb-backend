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
  { name: '🌟 UrduBox Exclusives', slug: 'urdubox', description: 'Exclusive Pakistani and Urdu dubbed releases' },
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
    movie.contentSource === 'URDBOX' ||
    movie.playbackMode === 'URDBOX' ||
    titleLower.includes('urdu') ||
    overviewLower.includes('urdu')
  ) {
    matchedSlugs.add('urdubox');
  }

  if (
    movie.language === 'hi' ||
    titleLower.includes('hindi') ||
    titleLower.includes('dubbed') ||
    overviewLower.includes('hindi dubbed')
  ) {
    matchedSlugs.add('hindi-dubbed');
  }

  if (movie.language === 'en' || !movie.language) {
    matchedSlugs.add('hollywood');
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
