process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/tmb';
const { PrismaClient, MovieStatus, ContentType, ContentSource, PlaybackMode } = require('@prisma/client');
const { autoCategorizeSeries, ensureDefaultCategories } = require('../dist/modules/admin/categories/category-helper');

const prisma = new PrismaClient();

const SAMPLE_SERIES = [
  {
    tmdbId: 1396,
    title: 'Breaking Bad',
    originalTitle: 'Breaking Bad',
    overview:
      'Walter White, a New Mexico chemistry teacher diagnosed with stage III cancer, begins manufacturing and selling methamphetamine with a former student in order to secure his family financial future.',
    posterPath: '/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
    backdropPath: '/tsRy63Mu5cu8etL1X7ZLyf7UP1M.jpg',
    firstAirDate: new Date('2008-01-20'),
    lastAirDate: new Date('2013-09-29'),
    numberOfSeasons: 5,
    numberOfEpisodes: 62,
    rating: 9.5,
    voteCount: 14200,
    language: 'en',
    status: MovieStatus.ACTIVE,
    contentType: ContentType.SERIES,
    contentSource: ContentSource.MOVIESAPI,
    playbackMode: PlaybackMode.EMBED,
    genres: ['Drama', 'Crime', 'Thriller'],
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        episodes: [
          { episodeNumber: 1, title: 'Pilot', overview: 'Diagnosed with terminal lung cancer, a chemistry teacher decides to make and sell meth.' },
          { episodeNumber: 2, title: 'Cat\'s in the Bag...', overview: 'Walt and Jesse attempt to dispose of the two bodies in the RV.' },
          { episodeNumber: 3, title: '...And the Bag\'s in the River', overview: 'Walt wrestles with whether to let Krazy-8 live or die.' },
          { episodeNumber: 4, title: 'Cancer Man', overview: 'Walt reveals the truth about his diagnosis to his family.' },
          { episodeNumber: 5, title: 'Gray Matter', overview: 'Walt rejects an offer for financial assistance from his former colleagues.' },
          { episodeNumber: 6, title: 'Crazy Handful of Nothin\'', overview: 'Walt transforms into his alter ego, Heisenberg.' },
          { episodeNumber: 7, title: 'A No-Rough-Stuff-Type Deal', overview: 'Walt and Jesse strike a dangerous deal with violent drug distributor Tuco.' },
        ],
      },
      {
        seasonNumber: 2,
        name: 'Season 2',
        episodes: [
          { episodeNumber: 1, title: 'Seven Thirty-Seven', overview: 'Walt and Jesse realize just how volatile their distributor is.' },
          { episodeNumber: 2, title: 'Grilled', overview: 'Walt and Jesse find themselves trapped in a desert shack with Tuco.' },
          { episodeNumber: 3, title: 'Bit by a Dead Bee', overview: 'Walt devises an alibi to explain his mysterious disappearance.' },
          { episodeNumber: 4, title: 'Down', overview: 'Jesse finds himself evicted and homeless after his parents discover his lab.' },
        ],
      },
    ],
  },
  {
    tmdbId: 66732,
    title: 'Stranger Things',
    originalTitle: 'Stranger Things',
    overview:
      'When a young boy vanishes, a small town uncovers a mystery involving secret experiments, terrifying supernatural forces and one strange little girl.',
    posterPath: '/49WJfeN0moxb9IPfGn8AIqMGskD.jpg',
    backdropPath: '/56v2KjBlU4XaOv9rVYEQypROD7P.jpg',
    firstAirDate: new Date('2016-07-15'),
    lastAirDate: new Date('2022-07-01'),
    numberOfSeasons: 4,
    numberOfEpisodes: 34,
    rating: 8.6,
    voteCount: 16800,
    language: 'en',
    status: MovieStatus.ACTIVE,
    contentType: ContentType.SERIES,
    contentSource: ContentSource.MOVIESAPI,
    playbackMode: PlaybackMode.EMBED,
    genres: ['Sci-Fi', 'Drama', 'Mystery'],
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        episodes: [
          { episodeNumber: 1, title: 'Chapter One: The Vanishing of Will Byers', overview: 'A young boy vanishes near a top-secret government laboratory.' },
          { episodeNumber: 2, title: 'Chapter Two: The Weirdo on Maple Street', overview: 'Lucas, Mike and Dustin try to talk to the girl they found in the woods.' },
          { episodeNumber: 3, title: 'Chapter Three: Holly, Jolly', overview: 'An increasingly concerned Joyce believes Will is communicating with her.' },
          { episodeNumber: 4, title: 'Chapter Four: The Body', overview: 'Refusing to believe Will is dead, Joyce tries to connect with her son.' },
          { episodeNumber: 5, title: 'Chapter Five: The Flea and the Acrobat', overview: 'Hopper sneaks into the lab while the kids figure out how to reach the Upside Down.' },
        ],
      },
      {
        seasonNumber: 2,
        name: 'Season 2',
        episodes: [
          { episodeNumber: 1, title: 'Chapter One: MADMAX', overview: 'As the town preps for Halloween, a high-scoring rival shakes up things.' },
          { episodeNumber: 2, title: 'Chapter Two: Trick or Treat, Freak', overview: 'Will sees something terrible on trick-or-treat night.' },
        ],
      },
    ],
  },
  {
    tmdbId: null,
    upstreamId: 'terebin-pk-drama',
    title: 'Tere Bin (Urdu Drama Serial)',
    originalTitle: 'Tere Bin',
    overview:
      'A clash of pride and fiery passion as Meerab and Murtasim are bound together by an arranged marriage in a wealthy feudal Pakistani household.',
    posterPath: '/terebin-poster.jpg',
    backdropPath: '/terebin-backdrop.jpg',
    firstAirDate: new Date('2022-12-28'),
    lastAirDate: new Date('2023-07-06'),
    numberOfSeasons: 1,
    numberOfEpisodes: 47,
    rating: 9.1,
    voteCount: 3400,
    language: 'ur',
    status: MovieStatus.ACTIVE,
    contentType: ContentType.SERIES,
    contentSource: ContentSource.URDBOX,
    playbackMode: PlaybackMode.URDBOX,
    genres: ['Drama', 'Romance'],
    seasons: [
      {
        seasonNumber: 1,
        name: 'Complete Season',
        episodes: [
          { episodeNumber: 1, title: 'Episode 1: The Encounter', overview: 'Meerab dreams of pursuing higher education while Murtasim assumes family responsibility.', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4' },
          { episodeNumber: 2, title: 'Episode 2: Clash of Wills', overview: 'Tension mounts between Murtasim and Meerab at the family gathering.', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4' },
          { episodeNumber: 3, title: 'Episode 3: The Proposal', overview: 'Family elders propose a matrimonial alliance that shocks Meerab.', videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4' },
          { episodeNumber: 4, title: 'Episode 4: Defiance', overview: 'Meerab refuses to conform to ancestral expectations, defying Murtasim.' },
          { episodeNumber: 5, title: 'Episode 5: The Bond', overview: 'Unexpected circumstances compel them to sign the marriage contract.' },
        ],
      },
    ],
  },
  {
    tmdbId: 1429,
    title: 'Attack on Titan (Shingeki no Kyojin)',
    originalTitle: '進撃の巨人',
    overview:
      'After his hometown is destroyed and his mother is killed, young Eren Jaeger vows to cleanse the earth of the giant humanoid Titans that have brought humanity to the brink of extinction.',
    posterPath: '/hTP1DtLGFamjfu8WqjnuQdP1n4i.jpg',
    backdropPath: '/yDHYTfA3R0jFYba16jBB1ef8oIt.jpg',
    firstAirDate: new Date('2013-04-07'),
    lastAirDate: new Date('2023-11-05'),
    numberOfSeasons: 4,
    numberOfEpisodes: 89,
    rating: 9.1,
    voteCount: 6100,
    language: 'ja',
    status: MovieStatus.ACTIVE,
    contentType: ContentType.ANIME,
    contentSource: ContentSource.MOVIESAPI,
    playbackMode: PlaybackMode.EMBED,
    genres: ['Animation', 'Action', 'Fantasy'],
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        episodes: [
          { episodeNumber: 1, title: 'To You, in 2000 Years: The Fall of Shiganshina, Part 1', overview: 'Humanity lives inside concentric walls protected from giant Titans, until a Colossal Titan appears.' },
          { episodeNumber: 2, title: 'That Day: The Fall of Shiganshina, Part 2', overview: 'Following the breach of Wall Maria, Eren, Mikasa and Armin flee as refugees.' },
          { episodeNumber: 3, title: 'A Dim Light Amid Despair: Humanity\'s Comeback, Part 1', overview: 'Eren and his companions join the 104th Training Corps cadet battalion.' },
          { episodeNumber: 4, title: 'The Night of the Graduation Ceremony', overview: 'Five years after the fall of Wall Maria, Eren and his squad graduate from military training.' },
          { episodeNumber: 5, title: 'First Battle: The Struggle for Trost, Part 1', overview: 'The Colossal Titan breaches Wall Rose, thrusting new recruits into instant warfare.' },
        ],
      },
      {
        seasonNumber: 2,
        name: 'Season 2',
        episodes: [
          { episodeNumber: 1, title: 'Beast Titan', overview: 'Without their gear, Section Commander Miche leads scouts to warn civilian villages.' },
          { episodeNumber: 2, title: 'I\'m Home', overview: 'Sasha sprints to her home village to warn her family of approaching Titans.' },
        ],
      },
    ],
  },
  {
    tmdbId: 13916,
    title: 'Death Note',
    originalTitle: 'DEATH NOTE',
    overview:
      'Light Yagami, a bright student who stumbles upon a mystical notebook that has the power to kill anyone whose name is written in it, embarks on a secret crusade to rid the world of criminals.',
    posterPath: '/iigTJJskR1PcjjczGSgx5v98dmU.jpg',
    backdropPath: '/96rt5P1vP062l5lQ6x4N2mK7YdE.jpg',
    firstAirDate: new Date('2006-10-04'),
    lastAirDate: new Date('2007-06-27'),
    numberOfSeasons: 1,
    numberOfEpisodes: 37,
    rating: 8.8,
    voteCount: 4200,
    language: 'ja',
    status: MovieStatus.ACTIVE,
    contentType: ContentType.ANIME,
    contentSource: ContentSource.MOVIESAPI,
    playbackMode: PlaybackMode.EMBED,
    genres: ['Animation', 'Mystery', 'Crime', 'Thriller'],
    seasons: [
      {
        seasonNumber: 1,
        name: 'Season 1',
        episodes: [
          { episodeNumber: 1, title: 'Rebirth', overview: 'Brilliant student Light Yagami discovers a supernatural notebook dropped by a Shinigami named Ryuk.' },
          { episodeNumber: 2, title: 'Confrontation', overview: 'As criminals around the world die mysteriously, the world-renowned detective L vows to catch Kira.' },
          { episodeNumber: 3, title: 'Dealings', overview: 'Ryuk informs Light that he is being followed by an investigator.' },
          { episodeNumber: 4, title: 'Pursuit', overview: 'Light tests the boundaries and rules of the Death Note to eliminate his tail.' },
          { episodeNumber: 5, title: 'Tactics', overview: 'Light meets with FBI agent Raye Penber on a train.' },
          { episodeNumber: 6, title: 'Unraveling', overview: 'L gathers the remaining Japanese task force officers to coordinate the Kira investigation.' },
        ],
      },
    ],
  },
  {
    tmdbId: 85937,
    title: 'Demon Slayer: Kimetsu no Yaiba',
    originalTitle: '鬼滅の刃',
    overview:
      'A family is attacked by demons and only two members survive - Tanjiro and his sister Nezuko, who is turning into a demon slowly. Tanjiro sets out to become a demon slayer to avenge his family and cure his sister.',
    posterPath: '/xUfRZu2mi8jH6SzQEJGP6tjBuYj.jpg',
    backdropPath: '/nTvM4mhqZlHIvUkIvdikW19Q6iP.jpg',
    firstAirDate: new Date('2019-04-06'),
    lastAirDate: new Date('2024-06-30'),
    numberOfSeasons: 4,
    numberOfEpisodes: 63,
    rating: 8.7,
    voteCount: 6800,
    language: 'ja',
    status: MovieStatus.ACTIVE,
    contentType: ContentType.ANIME,
    contentSource: ContentSource.MOVIESAPI,
    playbackMode: PlaybackMode.EMBED,
    genres: ['Animation', 'Action', 'Fantasy'],
    seasons: [
      {
        seasonNumber: 1,
        name: 'Tanjiro Kamado, Unwavering Resolve Arc',
        episodes: [
          { episodeNumber: 1, title: 'Cruelty', overview: 'Tanjiro returns home to find his family slaughtered and his sister transformed into a demon.' },
          { episodeNumber: 2, title: 'Trainer Sakonji Urokodaki', overview: 'Giyu Tomioka directs Tanjiro to Mount Sagiri to seek out master swordsman Urokodaki.' },
          { episodeNumber: 3, title: 'Sabito and Makomo', overview: 'To participate in Final Selection, Tanjiro must slice a massive boulder with his katana.' },
          { episodeNumber: 4, title: 'Final Selection', overview: 'Tanjiro enters Mount Fujikasane to survive seven days surrounded by captured demons.' },
        ],
      },
    ],
  },
];

async function run() {
  console.log('Ensuring default categories...');
  await ensureDefaultCategories(prisma);

  console.log('Seeding Real Web Series and Anime...');
  for (const sData of SAMPLE_SERIES) {
    const { seasons, genres, ...seriesFields } = sData;

    // Upsert Series
    let series;
    if (seriesFields.tmdbId) {
      series = await prisma.series.upsert({
        where: { tmdbId: seriesFields.tmdbId },
        update: seriesFields,
        create: seriesFields,
      });
    } else {
      series = await prisma.series.upsert({
        where: { id: `series-${seriesFields.upstreamId}` },
        update: seriesFields,
        create: { id: `series-${seriesFields.upstreamId}`, ...seriesFields },
      });
    }

    // Attach Genres
    for (const gName of genres) {
      let genre = await prisma.genre.findFirst({ where: { name: gName } });
      if (!genre) {
        genre = await prisma.genre.create({ data: { name: gName } });
      }
      await prisma.seriesGenre.upsert({
        where: {
          seriesId_genreId: {
            seriesId: series.id,
            genreId: genre.id,
          },
        },
        update: {},
        create: {
          seriesId: series.id,
          genreId: genre.id,
        },
      });
    }

    // Attach Seasons & Episodes
    for (const s of seasons) {
      const season = await prisma.season.upsert({
        where: {
          seriesId_seasonNumber: {
            seriesId: series.id,
            seasonNumber: s.seasonNumber,
          },
        },
        update: {
          name: s.name,
          episodeCount: s.episodes.length,
        },
        create: {
          seriesId: series.id,
          seasonNumber: s.seasonNumber,
          name: s.name,
          episodeCount: s.episodes.length,
        },
      });

      for (const ep of s.episodes) {
        await prisma.episode.upsert({
          where: {
            seasonId_episodeNumber: {
              seasonId: season.id,
              episodeNumber: ep.episodeNumber,
            },
          },
          update: {
            title: ep.title,
            overview: ep.overview,
            videoUrl: ep.videoUrl || null,
          },
          create: {
            seriesId: series.id,
            seasonId: season.id,
            seasonNumber: s.seasonNumber,
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            overview: ep.overview,
            videoUrl: ep.videoUrl || null,
            stillPath: series.backdropPath,
          },
        });
      }
    }

    // Auto Categorize Series
    await autoCategorizeSeries(prisma, series.id);
    console.log(`✓ Seeded Series: "${series.title}" [${series.contentType}] with seasons and episodes`);
  }

  const [seriesCount, seasonCount, episodeCount, catSeriesCount] = await Promise.all([
    prisma.series.count(),
    prisma.season.count(),
    prisma.episode.count(),
    prisma.categorySeries.count(),
  ]);

  console.log(`\n========================================`);
  console.log(`Total Series in DB: ${seriesCount}`);
  console.log(`Total Seasons in DB: ${seasonCount}`);
  console.log(`Total Episodes in DB: ${episodeCount}`);
  console.log(`Total Series-Category Links: ${catSeriesCount}`);
  console.log(`========================================\n`);

  await prisma.$disconnect();
  process.exit(0);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
