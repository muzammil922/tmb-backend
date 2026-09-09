process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tmb';
const { PrismaClient, UserRole, MovieStatus, MovieSource, ContentSource, PlaybackMode } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

const REAL_MOVIES = [
  {
    tmdbId: 693134,
    title: 'Dune: Part Two',
    originalTitle: 'Dune: Part Two',
    overview:
      'Follow the mythic journey of Paul Atreides as he unites with Chani and the Fremen while on a warpath of revenge against the conspirators who destroyed his family.',
    posterPath: '/1pdfLvkbY9ohJlCjQH2CZjjYVvJ.jpg',
    backdropPath: '/xOMo8BRK7PfcJv9JCnx7s520Wio.jpg',
    releaseDate: new Date('2024-03-01'),
    runtime: 166,
    rating: 8.6,
    voteCount: 5200,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: true,
    trailerKey: 'Way9Dexny3w',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Sci-Fi', 'Adventure', 'Action'],
    cast: [
      { name: 'Timothée Chalamet', character: 'Paul Atreides', profilePath: '/BE2sdjpgsa2rNTFa66f7upkaOP.jpg', order: 1 },
      { name: 'Zendaya', character: 'Chani', profilePath: '/so3GqzGzbWs9pqA9CL5tN4bpU6c.jpg', order: 2 },
      { name: 'Rebecca Ferguson', character: 'Lady Jessica', profilePath: '/6NRiQIbZw8Fgi0q04v0d6m3n3e2.jpg', order: 3 },
      { name: 'Javier Bardem', character: 'Stilgar', profilePath: '/g4gB3p0d9h383s02a9s99s9.jpg', order: 4 },
    ],
  },
  {
    tmdbId: 872585,
    title: 'Oppenheimer',
    originalTitle: 'Oppenheimer',
    overview:
      'The story of J. Robert Oppenheimer’s role in the development of the atomic bomb during World War II, exploring the deep moral dilemma and geopolitical upheaval.',
    posterPath: '/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg',
    backdropPath: '/rLb2cwF3Pazuxaj0sRXQ037tGI1.jpg',
    releaseDate: new Date('2023-07-21'),
    runtime: 180,
    rating: 8.9,
    voteCount: 7800,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: true,
    trailerKey: 'uYPbbksJxIg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Drama', 'History'],
    cast: [
      { name: 'Cillian Murphy', character: 'J. Robert Oppenheimer', profilePath: '/360RzNa5XHGXGj252NcrQ6Bq9A3.jpg', order: 1 },
      { name: 'Emily Blunt', character: 'Kitty Oppenheimer', profilePath: '/nPJXaRMvuFLvgm17bm49WSS12xU.jpg', order: 2 },
      { name: 'Robert Downey Jr.', character: 'Lewis Strauss', profilePath: '/5qHNjhtjMD4YWH3ag0SCvPd8a6q.jpg', order: 3 },
    ],
  },
  {
    tmdbId: 533535,
    title: 'Deadpool & Wolverine',
    originalTitle: 'Deadpool & Wolverine',
    overview:
      'A listless Wade Wilson toils away in civilian life with his days as the morally flexible mercenary behind him. But when an existential threat emerges, he reluctantly suits up with an even more reluctant Wolverine.',
    posterPath: '/8cdWjvZQUExUUTzyp4t6EDMubfO.jpg',
    backdropPath: '/yD3D1F3xJ8vGZz4u6k9p0o1i2.jpg',
    releaseDate: new Date('2024-07-26'),
    runtime: 128,
    rating: 8.1,
    voteCount: 4200,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: '73_1biulkYk',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Action', 'Comedy', 'Sci-Fi'],
    cast: [
      { name: 'Ryan Reynolds', character: 'Wade Wilson / Deadpool', order: 1 },
      { name: 'Hugh Jackman', character: 'Logan / Wolverine', order: 2 },
    ],
  },
  {
    tmdbId: 157336,
    title: 'Interstellar',
    originalTitle: 'Interstellar',
    overview:
      'The adventures of a group of explorers who make use of a newly discovered wormhole to surpass the limitations on human space travel and conquer the vast distances involved in an interstellar voyage.',
    posterPath: '/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg',
    backdropPath: '/xJHokMbljvjADYdit5fK5VQsXEG.jpg',
    releaseDate: new Date('2014-11-07'),
    runtime: 169,
    rating: 8.7,
    voteCount: 34500,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: 'zSWdZVtXT7E',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Adventure', 'Drama', 'Sci-Fi'],
    cast: [
      { name: 'Matthew McConaughey', character: 'Cooper', order: 1 },
      { name: 'Anne Hathaway', character: 'Brand', order: 2 },
      { name: 'Jessica Chastain', character: 'Murph', order: 3 },
    ],
  },
  {
    tmdbId: 569094,
    title: 'Spider-Man: Across the Spider-Verse',
    originalTitle: 'Spider-Man: Across the Spider-Verse',
    overview:
      'After reuniting with Gwen Stacy, Brooklyn’s full-time, friendly neighborhood Spider-Man is catapulted across the Multiverse, where he encounters a team of Spider-People charged with protecting its very existence.',
    posterPath: '/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg',
    backdropPath: '/4HodYYKEIsGOdinkGi2Ucz6X9i0.jpg',
    releaseDate: new Date('2023-06-02'),
    runtime: 140,
    rating: 8.8,
    voteCount: 6500,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: 'cqGjhVJWtEg',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Animation', 'Action', 'Adventure'],
    cast: [
      { name: 'Shameik Moore', character: 'Miles Morales (voice)', order: 1 },
      { name: 'Hailee Steinfeld', character: 'Gwen Stacy (voice)', order: 2 },
    ],
  },
  {
    tmdbId: 155,
    title: 'The Dark Knight',
    originalTitle: 'The Dark Knight',
    overview:
      'Batman raises the stakes in his war on crime. With the help of Lt. Jim Gordon and District Attorney Harvey Dent, Batman sets out to dismantle the remaining criminal organizations that plague the streets.',
    posterPath: '/qJ2tW6WMUDux911r6m7haRef0WH.jpg',
    backdropPath: '/dqK9Hag1054tghRQSqLSfrkvQnA.jpg',
    releaseDate: new Date('2008-07-18'),
    runtime: 152,
    rating: 9.0,
    voteCount: 31200,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: 'EXeTwQWrcwY',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyBlazes.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Action', 'Crime', 'Drama'],
    cast: [
      { name: 'Christian Bale', character: 'Bruce Wayne / Batman', order: 1 },
      { name: 'Heath Ledger', character: 'Joker', order: 2 },
      { name: 'Aaron Eckhart', character: 'Harvey Dent', order: 3 },
    ],
  },
  {
    tmdbId: 27205,
    title: 'Inception',
    originalTitle: 'Inception',
    overview:
      'Cobb, a skilled thief who commits corporate espionage by infiltrating the subconscious of his targets, is offered a chance to regain his old life in exchange for a nearly impossible task: "inception".',
    posterPath: '/ljsZTbVsrQSqZgWeep2B1QiDKuh.jpg',
    backdropPath: '/8ZTVqvKDQ8emSGUEMjsS4yHAwrp.jpg',
    releaseDate: new Date('2010-07-16'),
    runtime: 148,
    rating: 8.8,
    voteCount: 35400,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: 'YoHD9XEInc0',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Action', 'Sci-Fi', 'Adventure'],
    cast: [
      { name: 'Leonardo DiCaprio', character: 'Dom Cobb', order: 1 },
      { name: 'Joseph Gordon-Levitt', character: 'Arthur', order: 2 },
      { name: 'Elliot Page', character: 'Ariadne', order: 3 },
    ],
  },
  {
    tmdbId: 558449,
    title: 'Gladiator II',
    originalTitle: 'Gladiator II',
    overview:
      'Years after witnessing the death of the revered hero Maximus at the hands of his uncle, Lucius must enter the Colosseum after his home is conquered by tyrannical Emperors.',
    posterPath: '/2cxhvwyEwRlysAmRH4iodkvo0z5.jpg',
    backdropPath: '/euYIWhGvdaRhuPZy299M9gnEnRi.jpg',
    releaseDate: new Date('2024-11-15'),
    runtime: 148,
    rating: 8.2,
    voteCount: 2300,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: '4rgYUipGJNo',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/WeAreGoingOnBullrun.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Action', 'Adventure', 'Drama'],
    cast: [
      { name: 'Paul Mescal', character: 'Lucius', order: 1 },
      { name: 'Pedro Pascal', character: 'Marcus Acacius', order: 2 },
      { name: 'Denzel Washington', character: 'Macrinus', order: 3 },
    ],
  },
  {
    tmdbId: 76600,
    title: 'Avatar: The Way of Water',
    originalTitle: 'Avatar: The Way of Water',
    overview:
      'Set more than a decade after the events of the first film, learn the story of the Sully family, the trouble that follows them, and the battles they fight to stay alive.',
    posterPath: '/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
    backdropPath: '/s16H6tpK2utvwDtzZ8Qy4qm5Emw.jpg',
    releaseDate: new Date('2022-12-16'),
    runtime: 192,
    rating: 8.4,
    voteCount: 11200,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: 'd9MyW72ELq0',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Sci-Fi', 'Adventure', 'Action'],
    cast: [
      { name: 'Sam Worthington', character: 'Jake Sully', order: 1 },
      { name: 'Zoe Saldaña', character: 'Neytiri', order: 2 },
    ],
  },
  {
    tmdbId: 414906,
    title: 'The Batman',
    originalTitle: 'The Batman',
    overview:
      'In his second year of fighting crime, Batman uncovers corruption in Gotham City that connects to his own family while facing a serial killer known as the Riddler.',
    posterPath: '/74xTEgt7R36Fpooo50r9T25onhq.jpg',
    backdropPath: '/tRS6jvPM9qPrrnx2KRx3ew96Yot.jpg',
    releaseDate: new Date('2022-03-04'),
    runtime: 176,
    rating: 8.1,
    voteCount: 9500,
    language: 'en',
    status: MovieStatus.ACTIVE,
    source: MovieSource.TMDB,
    featured: false,
    trailerKey: 'mqqft2x_Aa4',
    videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    contentSource: ContentSource.HOSTED,
    playbackMode: PlaybackMode.HOSTED,
    genres: ['Crime', 'Mystery', 'Action'],
    cast: [
      { name: 'Robert Pattinson', character: 'Bruce Wayne / The Batman', order: 1 },
      { name: 'Zoë Kravitz', character: 'Selina Kyle / Catwoman', order: 2 },
      { name: 'Paul Dano', character: 'Edward Nashton / The Riddler', order: 3 },
    ],
  },
];

async function seed() {
  console.log('Seeding admin user and real movies...');

  // 1. Admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tmb.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';
  const hashedPassword = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { password: hashedPassword, role: UserRole.ADMIN },
    create: {
      name: 'TMB Admin',
      email: adminEmail,
      password: hashedPassword,
      role: UserRole.ADMIN,
    },
  });
  console.log('✓ Admin user verified:', adminEmail);

  // 2. Genres
  const genreMap = new Map();
  const allGenreNames = Array.from(new Set(REAL_MOVIES.flatMap((m) => m.genres)));
  for (const name of allGenreNames) {
    const genre = await prisma.genre.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    genreMap.set(name, genre.id);
  }
  console.log(`✓ ${genreMap.size} Genres created`);

  // 3. Movies
  const createdMovies = [];
  for (const m of REAL_MOVIES) {
    const { genres, cast, ...movieData } = m;
    const movie = await prisma.movie.upsert({
      where: { tmdbId: m.tmdbId },
      update: {
        ...movieData,
      },
      create: {
        ...movieData,
      },
    });

    createdMovies.push(movie);

    // Link genres
    if (genres) {
      for (const gName of genres) {
        const genreId = genreMap.get(gName);
        if (genreId) {
          await prisma.movieGenre.upsert({
            where: {
              movieId_genreId: { movieId: movie.id, genreId },
            },
            update: {},
            create: { movieId: movie.id, genreId },
          });
        }
      }
    }

    // Link cast
    if (cast) {
      await prisma.movieCast.deleteMany({ where: { movieId: movie.id } });
      for (const c of cast) {
        await prisma.movieCast.create({
          data: {
            movieId: movie.id,
            name: c.name,
            character: c.character,
            profilePath: c.profilePath,
            order: c.order,
          },
        });
      }
    }
  }
  console.log(`✓ ${createdMovies.length} Real Movies seeded into PostgreSQL database`);

  // 4. Homepage Sections (Manual Mode with Real Movies mapped)
  const sectionsData = [
    { title: '🔥 Trending Now', type: 'trending', order: 1, movies: createdMovies.slice(0, 5) },
    { title: '⭐ Top Rated Masterpieces', type: 'top-rated', order: 2, movies: createdMovies.slice(1, 6) },
    { title: '💥 Action & Blockbusters', type: 'action', order: 3, movies: [createdMovies[2], createdMovies[5], createdMovies[6], createdMovies[7], createdMovies[9]] },
    { title: '🚀 Sci-Fi & Mind Bending', type: 'scifi', order: 4, movies: [createdMovies[0], createdMovies[3], createdMovies[4], createdMovies[6], createdMovies[8]] },
  ];

  for (const s of sectionsData) {
    const section = await prisma.homepageSection.upsert({
      where: { id: `sec-${s.type}` },
      update: {
        title: s.title,
        order: s.order,
        isActive: true,
        mode: 'MANUAL',
      },
      create: {
        id: `sec-${s.type}`,
        title: s.title,
        type: s.type,
        order: s.order,
        isActive: true,
        mode: 'MANUAL',
      },
    });

    // Map movies to homepage section
    await prisma.homepageSectionMovie.deleteMany({ where: { sectionId: section.id } });
    for (let i = 0; i < s.movies.length; i++) {
      await prisma.homepageSectionMovie.create({
        data: {
          sectionId: section.id,
          movieId: s.movies[i].id,
          order: i + 1,
        },
      });
    }
  }

  console.log('✓ Homepage sections with real movie links successfully populated!');
}

seed()
  .catch((err) => {
    console.error('Seed error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
