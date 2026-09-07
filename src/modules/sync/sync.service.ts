import { Injectable, Logger } from '@nestjs/common';
import { ContentSource, ContentType, SyncStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentSyncService } from './content-sync.service';
import { UrduboxClient } from './clients/urdubox.client';
import { MoviesApiClient } from './clients/movies-api.client';

export type SyncRunSource = 'URDBOX' | 'MOVIESAPI' | 'ALL';

@Injectable()
export class SyncService {
  private readonly logger = new Logger(SyncService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly contentSync: ContentSyncService,
    private readonly urdubox: UrduboxClient,
    private readonly moviesApi: MoviesApiClient,
  ) {}

  async getSettings() {
    let settings = await this.prisma.syncSettings.findUnique({ where: { id: 'default' } });
    if (!settings) {
      settings = await this.prisma.syncSettings.create({
        data: { id: 'default' },
      });
    }
    return settings;
  }

  async updateSettings(data: {
    urduboxEnabled?: boolean;
    moviesApiEnabled?: boolean;
    automationEnabled?: boolean;
    scheduleStart?: string | null;
    scheduleEnd?: string | null;
    cronExpression?: string | null;
    maxPagesPerRun?: number;
    resultsPerPage?: number;
  }) {
    return this.prisma.syncSettings.upsert({
      where: { id: 'default' },
      update: data,
      create: { id: 'default', ...data },
    });
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

  async runSync(source: SyncRunSource = 'ALL') {
    if (this.running) {
      return { message: 'Sync already running', started: false };
    }

    this.running = true;
    const settings = await this.getSettings();
    const results: any[] = [];

    try {
      if ((source === 'URDBOX' || source === 'ALL') && settings.urduboxEnabled) {
        results.push(await this.runUrduboxSync(settings.maxPagesPerRun, settings.resultsPerPage));
      }
      if ((source === 'MOVIESAPI' || source === 'ALL') && settings.moviesApiEnabled) {
        results.push(await this.runMoviesApiSync(settings.maxPagesPerRun, settings.resultsPerPage));
      }
      return { started: true, results };
    } finally {
      this.running = false;
    }
  }

  async runScheduledSync() {
    const settings = await this.getSettings();
    if (!settings.automationEnabled) return { skipped: true, reason: 'automation_disabled' };
    if (!this.isWithinScheduleWindow(settings.scheduleStart, settings.scheduleEnd)) {
      return { skipped: true, reason: 'outside_schedule_window' };
    }
    return this.runSync('ALL');
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

  private async runUrduboxSync(maxPages: number, resultsPerPage: number) {
    const job = await this.prisma.syncJob.create({
      data: { source: ContentSource.URDBOX, status: SyncStatus.RUNNING, startedAt: new Date() },
    });

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (let page = 1; page <= maxPages; page++) {
        const response = await this.urdubox.discoverMovies(page, resultsPerPage);
        const items = this.urdubox.extractItems(response);
        if (!items.length) break;

        for (const item of items) {
          const tmdbId = this.urdubox.resolveTmdbId(item);
          if (!tmdbId) {
            failed++;
            continue;
          }

          try {
            const result = await this.contentSync.importMovieFromUrdubox(
              tmdbId,
              this.urdubox.resolveUpstreamId(item),
              job.id,
            );
            if (result.imported) imported++;
            else skipped++;
          } catch {
            failed++;
          }
        }

        if (items.length < resultsPerPage) break;
        await this.delay(500);
      }

      for (let page = 1; page <= maxPages; page++) {
        const response = await this.urdubox.discoverTv(page, resultsPerPage);
        const items = this.urdubox.extractItems(response);
        if (!items.length) break;

        for (const item of items) {
          const tmdbId = this.urdubox.resolveTmdbId(item);
          if (!tmdbId) {
            failed++;
            continue;
          }

          try {
            const result = await this.contentSync.importSeriesFromUrdubox(
              tmdbId,
              this.urdubox.resolveUpstreamId(item),
              job.id,
            );
            if (result.imported) imported++;
            else skipped++;
          } catch {
            failed++;
          }
        }

        if (items.length < resultsPerPage) break;
        await this.delay(500);
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

  private async runMoviesApiSync(maxPages: number, resultsPerPage: number) {
    const job = await this.prisma.syncJob.create({
      data: { source: ContentSource.MOVIESAPI, status: SyncStatus.RUNNING, startedAt: new Date() },
    });

    let imported = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (let page = 1; page <= maxPages; page++) {
        const response = await this.moviesApi.discoverMovies(page, resultsPerPage);
        const items = this.moviesApi.extractItems(response);
        if (!items.length) break;

        for (const item of items) {
          const tmdbId = this.moviesApi.resolveTmdbId(item);
          if (!tmdbId) {
            failed++;
            continue;
          }

          try {
            const result = await this.contentSync.importMovieFromMoviesApi(tmdbId, job.id);
            if (result.imported) imported++;
            else skipped++;
          } catch {
            failed++;
          }
        }

        if (items.length < resultsPerPage) break;
        await this.delay(500);
      }

      for (let page = 1; page <= maxPages; page++) {
        const response = await this.moviesApi.discoverTv(page, resultsPerPage);
        const items = this.moviesApi.extractItems(response);
        if (!items.length) break;

        for (const item of items) {
          const tmdbId = this.moviesApi.resolveTmdbId(item);
          if (!tmdbId) {
            failed++;
            continue;
          }

          try {
            const result = await this.contentSync.importSeriesFromMoviesApi(tmdbId, job.id);
            if (result.imported) imported++;
            else skipped++;
          } catch {
            failed++;
          }
        }

        if (items.length < resultsPerPage) break;
        await this.delay(500);
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

  private async completeJob(jobId: string, imported: number, skipped: number, failed: number) {
    const job = await this.prisma.syncJob.update({
      where: { id: jobId },
      data: {
        status: SyncStatus.COMPLETED,
        completedAt: new Date(),
        imported,
        skipped,
        failed,
      },
    });
    this.logger.log(`Sync job ${jobId} completed: imported=${imported} skipped=${skipped} failed=${failed}`);
    return job;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
