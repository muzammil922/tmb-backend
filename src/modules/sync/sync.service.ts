import { Injectable, Logger } from '@nestjs/common';
import { ContentSource, ContentType, SyncStatus } from '@prisma/client';
import { CacheService } from '../../common/cache/cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TmdbService } from '../tmdb/tmdb.service';
import { ContentSyncService } from './content-sync.service';
import { MoviesApiClient } from './clients/movies-api.client';
import { Imdb3Client } from './clients/imdb3.client';
import { resolvePresets, SYNC_PRESETS, SyncPresetId } from './sync-presets';

export type SyncRunSource = 'MOVIESAPI' | 'IMDB3' | 'ALL';
export type SyncContentType = 'ALL' | 'MOVIES' | 'SERIES';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private running = false;
  private cancelRequested = false;
  private activeJobId: string | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentSync: ContentSyncService,
    private readonly moviesApi: MoviesApiClient,
    private readonly imdb3: Imdb3Client,
    private readonly cache: CacheService,
    private readonly tmdb: TmdbService,
  ) {}

  async getSettings() {
    try {
      let settings = await this.prisma.syncSettings.findUnique({ where: { id: 'default' } });
      if (!settings) {
        settings = await this.prisma.syncSettings.create({
          data: { id: 'default' },
        });
      }
      return settings;
    } catch (error) {
      this.logger.error('Failed to get sync settings, returning safe fallback:', error);
      return {
        id: 'default',
        moviesApiEnabled: false,
        imdb3Enabled: true,
        automationEnabled: false,
        syncIntervalHours: 24,
        lastScheduledSyncAt: null,
        lastImdb3Id: 123290,
        imdb3DailyCount: 20,
        scheduleStart: null,
        scheduleEnd: null,
        cronExpression: null,
        maxPagesPerRun: 10,
        resultsPerPage: 50,
        updatedAt: new Date(),
      };
    }
  }

  async updateSettings(data: {
    moviesApiEnabled?: boolean;
    imdb3Enabled?: boolean;
    automationEnabled?: boolean;
    syncIntervalHours?: number;
    lastScheduledSyncAt?: Date | null;
    lastImdb3Id?: number;
    imdb3DailyCount?: number;
    scheduleStart?: string | null;
    scheduleEnd?: string | null;
    cronExpression?: string | null;
    maxPagesPerRun?: number;
    resultsPerPage?: number;
  }) {
    try {
      return await this.prisma.syncSettings.upsert({
        where: { id: 'default' },
        update: data,
        create: { id: 'default', ...data },
      });
    } catch (error) {
      this.logger.error('Failed to update sync settings, returning merged object:', error);
      return { id: 'default', ...data, updatedAt: new Date() };
    }
  }

  async listJobs(page = 1) {
    const take = 20;
    const skip = (page - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.syncJob.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.syncJob.count(),
    ]);
    return { data, page, totalPages: Math.ceil(total / take) || 1, totalResults: total };
  }

  async getJobLogs(jobId: string, page = 1) {
    const take = 50;
    const skip = (page - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.syncLog.findMany({
        where: { jobId },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.syncLog.count({ where: { jobId } }),
    ]);
    return { data, page, totalPages: Math.ceil(total / take) || 1, totalResults: total };
  }

  async getStatus() {
    try {
      const [runningJobs, settings] = await Promise.all([
        this.prisma.syncJob.findMany({
          where: { status: SyncStatus.RUNNING },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            source: true,
            imported: true,
            skipped: true,
            failed: true,
            startedAt: true,
          },
        }).catch(() => []),
        this.getSettings(),
      ]);

      let nextSyncRemainingMinutes: number | null = null;
      if (settings?.automationEnabled) {
        const intervalMs = (settings.syncIntervalHours || 24) * 60 * 60 * 1000;
        const last = settings.lastScheduledSyncAt ? new Date(settings.lastScheduledSyncAt).getTime() : 0;
        const elapsed = Date.now() - last;
        if (elapsed >= intervalMs) {
          nextSyncRemainingMinutes = 0;
        } else {
          nextSyncRemainingMinutes = Math.max(1, Math.round((intervalMs - elapsed) / (1000 * 60)));
        }
      }

      return {
        running: this.running || runningJobs.length > 0,
        cancelRequested: this.cancelRequested,
        activeJobId: this.activeJobId,
        runningJobs,
        automation: {
          enabled: settings?.automationEnabled ?? false,
          syncIntervalHours: settings?.syncIntervalHours || 24,
          lastScheduledSyncAt: settings?.lastScheduledSyncAt ?? null,
          nextSyncRemainingMinutes,
          moviesApiEnabled: settings?.moviesApiEnabled ?? false,
          imdb3Enabled: settings?.imdb3Enabled ?? true,
        },
      };
    } catch (error) {
      this.logger.error('Failed to get status, returning fallback:', error);
      return {
        running: false,
        cancelRequested: false,
        activeJobId: null,
        runningJobs: [],
        automation: {
          enabled: false,
          syncIntervalHours: 24,
          lastScheduledSyncAt: null,
          nextSyncRemainingMinutes: null,
          moviesApiEnabled: false,
          imdb3Enabled: true,
        },
      };
    }
  }

  async stopSync() {
    if (this.running) {
      this.cancelRequested = true;
      await this.updateSettings({ automationEnabled: false });
      return { stopped: true, message: 'Stop requested — sync will halt after the current item' };
    }

    const runningJobs = await this.prisma.syncJob.findMany({
      where: { status: SyncStatus.RUNNING },
      select: { id: true },
    });

    if (!runningJobs.length) {
      return { stopped: false, message: 'No sync is currently running' };
    }

    for (const job of runningJobs) {
      await this.forceStopJob(job.id);
    }

    await this.updateSettings({ automationEnabled: false });
    return { stopped: true, message: 'Running jobs force-stopped' };
  }

  async forceStopJob(jobId: string) {
    const job = await this.prisma.syncJob.findUnique({ where: { id: jobId } });
    if (!job || job.status !== SyncStatus.RUNNING) {
      return { stopped: false, message: 'Job is not running' };
    }

    if (this.running) {
      this.cancelRequested = true;
      if (!this.activeJobId) this.activeJobId = jobId;
      return { stopped: true, message: 'Stop requested — halting after current item' };
    }

    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        errorMessage: 'Force stopped by user',
      },
    });

    return { stopped: true, message: 'Job marked as stopped' };
  }

  async stopAutomation() {
    const settings = await this.updateSettings({ automationEnabled: false });
    if (this.running) {
      this.cancelRequested = true;
    }
    return {
      automationEnabled: settings.automationEnabled,
      syncStopRequested: this.running,
      message: this.running
        ? 'Automation disabled and running sync will stop'
        : 'Automation disabled',
    };
  }

  async resetStalledJobs() {
    this.running = false;
    this.cancelRequested = false;
    this.activeJobId = null;
    const result = await this.prisma.syncJob.updateMany({
      where: { status: SyncStatus.RUNNING },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        errorMessage: 'Cleared / reset by admin',
      },
    });
    this.logger.log(`Reset ${result.count} stalled sync jobs.`);
    return { success: true, count: result.count, message: `Reset ${result.count} stalled sync jobs.` };
  }

  async runFullSync(options: {
    presets?: string[];
    skipBroken?: boolean;
    contentType?: SyncContentType;
  } = {}) {
    if (this.running) {
      return { message: 'Sync already running', started: false };
    }

    this.running = true;
    this.cancelRequested = false;
    this.activeJobId = null;

    const settings = await this.getSettings();
    const presets = resolvePresets(options.presets);
    const skipBroken = options.skipBroken !== false;
    const contentType = options.contentType ?? 'ALL';

    const job = await this.prisma.syncJob.create({
      data: { source: ContentSource.MOVIESAPI, status: SyncStatus.RUNNING, startedAt: new Date() },
    });
    this.activeJobId = job.id;

    let imported = 0;
    let skipped = 0;
    let failed = 0;
    let working = 0;
    let broken = 0;
    const byPreset: Record<string, { imported: number; skipped: number; failed: number }> = {};
    const byType: Record<string, number> = { MOVIE: 0, SERIES: 0, ANIME: 0 };

    try {
      const purge = await this.contentSync.purgeUrduBoxContent();
      this.logger.log(`Purged UrduBox content: ${JSON.stringify(purge)}`);

      for (const presetId of presets) {
        if (this.shouldStop()) break;
        byPreset[presetId] = { imported: 0, skipped: 0, failed: 0 };
        const preset = SYNC_PRESETS[presetId];

        for (let page = 1; page <= settings.maxPagesPerRun; page++) {
          if (this.shouldStop()) break;

          if (contentType === 'ALL' || contentType === 'MOVIES') {
            const movieItems = await this.fetchPresetMovies(preset, page);
            for (const item of movieItems) {
              if (this.shouldStop()) break;
              const tmdbId = Number(item.id);
              if (!tmdbId) {
                failed++;
                byPreset[presetId].failed++;
                continue;
              }
              try {
                const result = await this.contentSync.importMovieFromPreset(tmdbId, presetId, job.id, { skipBroken });
                if (result.imported) {
                  imported++;
                  byPreset[presetId].imported++;
                  byType.MOVIE++;
                  if (result.playbackStatus === 'WORKING') working++;
                  else if (result.playbackStatus === 'BROKEN') broken++;
                } else {
                  skipped++;
                  byPreset[presetId].skipped++;
                }
              } catch {
                failed++;
                byPreset[presetId].failed++;
              }
              await this.updateJobProgress(job.id, imported, skipped, failed);
              await this.delay(500);
            }
            if (!movieItems.length) break;
          }

          if (contentType === 'ALL' || contentType === 'SERIES') {
            const tvItems = await this.fetchPresetTv(preset, page);
            for (const item of tvItems) {
              if (this.shouldStop()) break;
              const tmdbId = Number(item.id);
              if (!tmdbId) {
                failed++;
                byPreset[presetId].failed++;
                continue;
              }
              try {
                const result = await this.contentSync.importSeriesFromPreset(tmdbId, presetId, job.id, { skipBroken });
                if (result.imported) {
                  imported++;
                  byPreset[presetId].imported++;
                  const isAnime = presetId === 'anime' || result.series?.contentType === ContentType.ANIME;
                  byType[isAnime ? 'ANIME' : 'SERIES']++;
                  if (result.playbackStatus === 'WORKING') working++;
                  else if (result.playbackStatus === 'BROKEN') broken++;
                } else {
                  skipped++;
                  byPreset[presetId].skipped++;
                }
              } catch {
                failed++;
                byPreset[presetId].failed++;
              }
              await this.updateJobProgress(job.id, imported, skipped, failed);
              await this.delay(500);
            }
            if (!tvItems.length) break;
          }
        }
      }

      const summary = { imported, skipped, failed, working, broken, byPreset, byType, purge };
      if (this.shouldStop()) {
        await this.stopJob(job.id, imported, skipped, failed);
        return { started: true, jobId: job.id, cancelled: true, summary };
      }
      await this.completeJob(job.id, imported, skipped, failed);
      return { started: true, jobId: job.id, cancelled: false, summary };
    } catch (error: any) {
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: SyncStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error?.message ?? 'Unknown error',
          imported,
          skipped,
          failed,
        },
      });
      throw error;
    } finally {
      this.running = false;
      this.cancelRequested = false;
      this.activeJobId = null;
    }
  }

  private async fetchPresetMovies(preset: (typeof SYNC_PRESETS)[SyncPresetId], page: number) {
    if (preset.useTrendingMovies) {
      const res: any = await this.tmdb.trending(page);
      return res.results ?? [];
    }
    if (preset.movieDiscover) {
      const res: any = await this.tmdb.discoverMovies(preset.movieDiscover, page);
      return res.results ?? [];
    }
    return [];
  }

  private async fetchPresetTv(preset: (typeof SYNC_PRESETS)[SyncPresetId], page: number) {
    if (preset.useTrendingTv) {
      const res: any = await this.tmdb.trendingTv(page);
      return res.results ?? [];
    }
    if (preset.tvDiscover) {
      const res: any = await this.tmdb.discoverTv(preset.tvDiscover, page);
      return res.results ?? [];
    }
    return [];
  }

  async runSync(source: SyncRunSource = 'ALL', contentType: SyncContentType = 'ALL') {
    if (this.running) {
      return { message: 'Sync already running', started: false };
    }

    this.running = true;
    this.cancelRequested = false;
    this.activeJobId = null;
    const settings = await this.getSettings();
    const results: any[] = [];

    try {
      if ((source === 'MOVIESAPI' || source === 'ALL') && settings.moviesApiEnabled) {
        if (!this.cancelRequested) {
          results.push(await this.runMoviesApiSync(settings.maxPagesPerRun, settings.resultsPerPage, contentType));
        }
      }
      if ((source === 'IMDB3' || source === 'ALL') && settings.imdb3Enabled && contentType !== 'SERIES') {
        if (!this.cancelRequested) {
          results.push(await this.runImdb3Sync(settings.imdb3DailyCount ?? 20));
        }
      }
      return { started: true, results, cancelled: this.cancelRequested };
    } finally {
      this.running = false;
      this.cancelRequested = false;
      this.activeJobId = null;
    }
  }

  async getJobById(id: string) {
    return this.prisma.syncJob.findUnique({ where: { id } });
  }

  private shouldStop() {
    return this.cancelRequested;
  }

  async runScheduledSync() {
    const settings = await this.getSettings();
    if (!settings.automationEnabled) return { skipped: true, reason: 'automation_disabled' };

    // Check interval (e.g. 24 hours for 1 day, 48 hours for 2 days)
    const intervalHours = settings.syncIntervalHours || 24;
    const intervalMs = intervalHours * 60 * 60 * 1000;
    if (settings.lastScheduledSyncAt) {
      const elapsed = Date.now() - new Date(settings.lastScheduledSyncAt).getTime();
      if (elapsed < intervalMs) {
        const remainingHours = ((intervalMs - elapsed) / (1000 * 60 * 60)).toFixed(1);
        return { skipped: true, reason: 'interval_not_elapsed', remainingHours };
      }
    }

    if (!this.isWithinScheduleWindow(settings.scheduleStart, settings.scheduleEnd)) {
      return { skipped: true, reason: 'outside_schedule_window' };
    }

    // Record lastScheduledSyncAt
    await this.prisma.syncSettings.update({
      where: { id: 'default' },
      data: { lastScheduledSyncAt: new Date() },
    });

    if (!settings.imdb3Enabled) {
      return { skipped: true, reason: 'imdb3_disabled' };
    }

    this.logger.log(
      `Daily automation: scanning ${settings.imdb3DailyCount ?? 20} new IMDB3 IDs from ${settings.lastImdb3Id}`,
    );
    return this.runSync('IMDB3', 'MOVIES');
  }

  private isWithinScheduleWindow(start?: string | null, end?: string | null) {
    if (!start || !end) return true;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMinutes = sh * 60 + (sm || 0);
    const endMinutes = eh * 60 + (em || 0);

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }

  private async runMoviesApiSync(maxPages: number, resultsPerPage: number, contentType: SyncContentType = 'ALL') {
    const job = await this.prisma.syncJob.create({
      data: { source: ContentSource.MOVIESAPI, status: SyncStatus.RUNNING, startedAt: new Date() },
    });
    this.activeJobId = job.id;

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      if (contentType === 'ALL' || contentType === 'MOVIES') {
        for (let page = 1; page <= maxPages; page++) {
          if (this.shouldStop()) break;
          const response = await this.moviesApi.discoverMovies(page, resultsPerPage);
          const items = this.moviesApi.extractItems(response);
          if (!items.length) break;

          for (const item of items) {
            if (this.shouldStop()) break;
            const tmdbId = this.moviesApi.resolveTmdbId(item);
            if (!tmdbId) {
              failed++;
              await this.updateJobProgress(job.id, imported, skipped, failed);
              continue;
            }

            try {
              const result = await this.contentSync.importMovieFromMoviesApi(tmdbId, job.id);
              if (result.imported) imported++;
              else skipped++;
            } catch {
              failed++;
            }
            await this.updateJobProgress(job.id, imported, skipped, failed);
          }

          if (items.length < resultsPerPage) break;
          await this.delay(500);
        }
      }

      if (contentType === 'ALL' || contentType === 'SERIES') {
        for (let page = 1; page <= maxPages; page++) {
          if (this.shouldStop()) break;
          const response = await this.moviesApi.discoverTv(page, resultsPerPage);
          const items = this.moviesApi.extractItems(response);
          if (!items.length) break;

          for (const item of items) {
            if (this.shouldStop()) break;
            const tmdbId = this.moviesApi.resolveTmdbId(item);
            if (!tmdbId) {
              failed++;
              await this.updateJobProgress(job.id, imported, skipped, failed);
              continue;
            }

            try {
              const result = await this.contentSync.importSeriesFromMoviesApi(tmdbId, job.id);
              if (result.imported) imported++;
              else skipped++;
            } catch {
              failed++;
            }
            await this.updateJobProgress(job.id, imported, skipped, failed);
          }

          if (items.length < resultsPerPage) break;
          await this.delay(500);
        }
      }

      if (this.shouldStop()) {
        return this.stopJob(job.id, imported, skipped, failed);
      }
      return this.completeJob(job.id, imported, skipped, failed);
    } catch (error: any) {
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: SyncStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error?.message ?? 'Unknown error',
          imported,
          skipped,
          failed,
        },
      });
      throw error;
    }
  }

  private async runImdb3Sync(count = 25) {
    const job = await this.prisma.syncJob.create({
      data: { source: ContentSource.IMDB3, status: SyncStatus.RUNNING, startedAt: new Date() },
    });
    this.activeJobId = job.id;

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      const settings = await this.getSettings();
      const startId = settings.lastImdb3Id || 123290;
      let highestScannedId = startId;

      for (let i = 0; i < count; i++) {
        if (this.shouldStop()) break;
        const targetId = startId + i;
        highestScannedId = targetId;

        try {
          const result = await this.contentSync.importMovieFromImdb3(targetId, job.id);
          if (result.imported) imported++;
          else skipped++;
        } catch {
          failed++;
        }

        await this.updateJobProgress(job.id, imported, skipped, failed);
        await this.delay(300);
      }

      await this.prisma.syncSettings.update({
        where: { id: 'default' },
        data: { lastImdb3Id: highestScannedId + 1 },
      });

      if (this.shouldStop()) {
        return this.stopJob(job.id, imported, skipped, failed);
      }
      return this.completeJob(job.id, imported, skipped, failed);
    } catch (error: any) {
      await this.prisma.syncJob.update({
        where: { id: job.id },
        data: {
          status: SyncStatus.FAILED,
          completedAt: new Date(),
          errorMessage: error?.message ?? 'Unknown error',
          imported,
          skipped,
          failed,
        },
      });
      throw error;
    }
  }

  async importSingleImdb3Movie(id: number | string) {
    return this.contentSync.importMovieFromImdb3(id);
  }

  async importImdb3Batch(startId: number, count = 10) {
    const results: any[] = [];
    for (let i = 0; i < count; i++) {
      const targetId = startId + i;
      try {
        const res = await this.contentSync.importMovieFromImdb3(targetId);
        results.push({ id: targetId, ...res });
      } catch (err: any) {
        results.push({ id: targetId, action: 'FAIL', message: err?.message || 'failed' });
      }
    }
    return results;
  }

  private async completeJob(
    jobId: string,
    imported: number,
    skipped: number,
    failed: number,
    errorMessage?: string,
  ) {
    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        imported,
        skipped,
        failed,
        errorMessage: errorMessage ?? null,
      },
    });
    this.logger.log(`Sync job ${jobId} completed: imported=${imported} skipped=${skipped} failed=${failed}`);
    return job;
  }

  private async stopJob(jobId: string, imported: number, skipped: number, failed: number) {
    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        imported,
        skipped,
        failed,
        errorMessage: 'Stopped by user',
      },
    });
    this.logger.log(`Sync job ${jobId} stopped by user: imported=${imported} skipped=${skipped} failed=${failed}`);
    return job;
  }

  private async updateJobProgress(jobId: string, imported: number, skipped: number, failed: number) {
    const total = imported + skipped + failed;
    if (total === 0 || total % 3 !== 0) return;

    await this.prisma.syncJob.update({
      where: { id: jobId },
      data: { imported, skipped, failed },
    });
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
