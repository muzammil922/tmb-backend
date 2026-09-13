-- CreateEnum
CREATE TYPE "PlaybackStatus" AS ENUM ('PENDING', 'WORKING', 'BROKEN');

-- AlterTable Movie
ALTER TABLE "Movie" ADD COLUMN "playbackStatus" "PlaybackStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Movie" ADD COLUMN "playbackCheckedAt" TIMESTAMP(3);
ALTER TABLE "Movie" ADD COLUMN "syncPreset" TEXT;

-- AlterTable Series
ALTER TABLE "Series" ADD COLUMN "playbackStatus" "PlaybackStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Series" ADD COLUMN "playbackCheckedAt" TIMESTAMP(3);
ALTER TABLE "Series" ADD COLUMN "syncPreset" TEXT;

-- AlterTable SyncSettings
ALTER TABLE "SyncSettings" DROP COLUMN IF EXISTS "urduboxEnabled";

-- Cleanup UrduBox content
DELETE FROM "Movie" WHERE "contentSource" = 'URDBOX' OR "playbackMode" = 'URDBOX';
DELETE FROM "Series" WHERE "contentSource" = 'URDBOX' OR "playbackMode" = 'URDBOX';
