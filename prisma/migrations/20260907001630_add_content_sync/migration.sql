-- CreateEnum
CREATE TYPE "ContentType" AS ENUM ('MOVIE', 'SERIES');

-- CreateEnum
CREATE TYPE "ContentSource" AS ENUM ('URDBOX', 'MOVIESAPI', 'TMDB_ONLY', 'HOSTED');

-- CreateEnum
CREATE TYPE "PlaybackMode" AS ENUM ('URDBOX', 'EMBED', 'HOSTED');

-- CreateEnum
CREATE TYPE "SyncStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Movie" ADD COLUMN     "contentSource" "ContentSource",
ADD COLUMN     "playbackMode" "PlaybackMode",
ADD COLUMN     "upstreamId" TEXT,
ADD COLUMN     "upstreamSyncedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "SyncSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "urduboxEnabled" BOOLEAN NOT NULL DEFAULT false,
    "moviesApiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "automationEnabled" BOOLEAN NOT NULL DEFAULT false,
    "scheduleStart" TEXT,
    "scheduleEnd" TEXT,
    "cronExpression" TEXT,
    "maxPagesPerRun" INTEGER NOT NULL DEFAULT 10,
    "resultsPerPage" INTEGER NOT NULL DEFAULT 50,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SyncSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncJob" (
    "id" TEXT NOT NULL,
    "source" "ContentSource" NOT NULL,
    "status" "SyncStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "upstreamId" TEXT,
    "title" TEXT,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "contentType" "ContentType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Series" (
    "id" TEXT NOT NULL,
    "tmdbId" INTEGER,
    "upstreamId" TEXT,
    "title" TEXT NOT NULL,
    "originalTitle" TEXT,
    "overview" TEXT,
    "posterPath" TEXT,
    "backdropPath" TEXT,
    "firstAirDate" TIMESTAMP(3),
    "lastAirDate" TIMESTAMP(3),
    "numberOfSeasons" INTEGER,
    "numberOfEpisodes" INTEGER,
    "rating" DOUBLE PRECISION,
    "voteCount" INTEGER,
    "language" TEXT,
    "status" "MovieStatus" NOT NULL DEFAULT 'DRAFT',
    "contentSource" "ContentSource",
    "playbackMode" "PlaybackMode",
    "upstreamSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Series_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Series_tmdbId_key" ON "Series"("tmdbId");

-- AddForeignKey
ALTER TABLE "SyncLog" ADD CONSTRAINT "SyncLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "SyncJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default sync settings
INSERT INTO "SyncSettings" ("id", "urduboxEnabled", "moviesApiEnabled", "automationEnabled", "maxPagesPerRun", "resultsPerPage", "updatedAt")
VALUES ('default', false, false, false, 10, 50, CURRENT_TIMESTAMP);
