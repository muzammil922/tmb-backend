-- Add new enum values
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'ANIME';
ALTER TYPE "ContentSource" ADD VALUE IF NOT EXISTS 'IMDB3';
ALTER TYPE "ContentSource" ADD VALUE IF NOT EXISTS 'TMDB';
ALTER TYPE "ContentSource" ADD VALUE IF NOT EXISTS 'MANUAL';

-- Add new columns to SyncSettings
ALTER TABLE "SyncSettings" ADD COLUMN IF NOT EXISTS "imdb3Enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "SyncSettings" ADD COLUMN IF NOT EXISTS "syncIntervalHours" INTEGER NOT NULL DEFAULT 24;
ALTER TABLE "SyncSettings" ADD COLUMN IF NOT EXISTS "lastScheduledSyncAt" TIMESTAMP(3);
ALTER TABLE "SyncSettings" ADD COLUMN IF NOT EXISTS "lastImdb3Id" INTEGER NOT NULL DEFAULT 123290;

-- Add contentType to Series if missing
ALTER TABLE "Series" ADD COLUMN IF NOT EXISTS "contentType" "ContentType" NOT NULL DEFAULT 'SERIES';

-- Create CategorySeries join table
CREATE TABLE IF NOT EXISTS "CategorySeries" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CategorySeries_pkey" PRIMARY KEY ("id")
);

-- Create Season table
CREATE TABLE IF NOT EXISTS "Season" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "name" TEXT,
    "overview" TEXT,
    "posterPath" TEXT,
    "episodeCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Season_pkey" PRIMARY KEY ("id")
);

-- Create Episode table
CREATE TABLE IF NOT EXISTS "Episode" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "seasonNumber" INTEGER NOT NULL,
    "episodeNumber" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "overview" TEXT,
    "stillPath" TEXT,
    "airDate" TIMESTAMP(3),
    "runtime" INTEGER,
    "voteAverage" DOUBLE PRECISION,
    "videoUrl" TEXT,
    "videoProvider" TEXT,
    "upstreamId" TEXT,

    CONSTRAINT "Episode_pkey" PRIMARY KEY ("id")
);

-- Create SeriesGenre table
CREATE TABLE IF NOT EXISTS "SeriesGenre" (
    "seriesId" TEXT NOT NULL,
    "genreId" TEXT NOT NULL,

    CONSTRAINT "SeriesGenre_pkey" PRIMARY KEY ("seriesId","genreId")
);

-- Create SeriesCast table
CREATE TABLE IF NOT EXISTS "SeriesCast" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "tmdbPersonId" INTEGER,
    "name" TEXT NOT NULL,
    "character" TEXT,
    "profilePath" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "SeriesCast_pkey" PRIMARY KEY ("id")
);

-- Create Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "CategorySeries_categoryId_seriesId_key" ON "CategorySeries"("categoryId", "seriesId");
CREATE UNIQUE INDEX IF NOT EXISTS "Season_seriesId_seasonNumber_key" ON "Season"("seriesId", "seasonNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "Episode_seasonId_episodeNumber_key" ON "Episode"("seasonId", "episodeNumber");

-- Add Foreign Keys
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CategorySeries_categoryId_fkey') THEN
        ALTER TABLE "CategorySeries" ADD CONSTRAINT "CategorySeries_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'CategorySeries_seriesId_fkey') THEN
        ALTER TABLE "CategorySeries" ADD CONSTRAINT "CategorySeries_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Season_seriesId_fkey') THEN
        ALTER TABLE "Season" ADD CONSTRAINT "Season_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Episode_seriesId_fkey') THEN
        ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Episode_seasonId_fkey') THEN
        ALTER TABLE "Episode" ADD CONSTRAINT "Episode_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SeriesGenre_seriesId_fkey') THEN
        ALTER TABLE "SeriesGenre" ADD CONSTRAINT "SeriesGenre_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SeriesGenre_genreId_fkey') THEN
        ALTER TABLE "SeriesGenre" ADD CONSTRAINT "SeriesGenre_genreId_fkey" FOREIGN KEY ("genreId") REFERENCES "Genre"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SeriesCast_seriesId_fkey') THEN
        ALTER TABLE "SeriesCast" ADD CONSTRAINT "SeriesCast_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "Series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
