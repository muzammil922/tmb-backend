import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as https from 'https';
import * as http from 'http';

const ALLANIME_HEX_MAP: Record<string, string> = {
  '79': 'A', '7a': 'B', '7b': 'C', '7c': 'D', '7d': 'E', '7e': 'F', '7f': 'G',
  '70': 'H', '71': 'I', '72': 'J', '73': 'K', '74': 'L', '75': 'M', '76': 'N', '77': 'O',
  '68': 'P', '69': 'Q', '6a': 'R', '6b': 'S', '6c': 'T', '6d': 'U', '6e': 'V', '6f': 'W',
  '60': 'X', '61': 'Y', '62': 'Z', '59': 'a', '5a': 'b', '5b': 'c', '5c': 'd', '5d': 'e',
  '5e': 'f', '5f': 'g', '50': 'h', '51': 'i', '52': 'j', '53': 'k', '54': 'l', '55': 'm',
  '56': 'n', '57': 'o', '48': 'p', '49': 'q', '4a': 'r', '4b': 's', '4c': 't', '4d': 'u',
  '4e': 'v', '4f': 'w', '40': 'x', '41': 'y', '42': 'z', '08': '0', '09': '1', '0a': '2',
  '0b': '3', '0c': '4', '0d': '5', '0e': '6', '0f': '7', '00': '8', '01': '9', '15': '-',
  '16': '.', '67': '_', '46': '~', '02': ':', '17': '/', '07': '?', '1b': '#', '63': '[',
  '65': ']', '78': '@', '19': '!', '1c': '$', '1e': '&', '10': '(', '11': ')', '12': '*',
  '13': '+', '14': ',', '03': ';', '05': '=', '1d': '%',
};

const ALLANIME_KEY = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest();
const PROVIDER_PRIORITY = ['S-mp4', 'Luf-Mp4', 'Yt-mp4', 'Default', 'Sl-Hls'];
const EPISODE_GQL_HASH =
  'd405d0edd690624b66baba3068e0edc3ac90f1597d898a1ec8db4e5c43c00fec';

const SEARCH_GQL = `query($search:SearchInput $limit:Int $page:Int $translationType:VaildTranslationTypeEnumType $countryOrigin:VaildCountryOriginEnumType){shows(search:$search limit:$limit page:$page translationType:$translationType countryOrigin:$countryOrigin){edges{_id name availableEpisodes __typename}}}`;
const EPISODE_GQL = `query($showId:String! $translationType:VaildTranslationTypeEnumType! $episodeString:String!){episode(showId:$showId translationType:$translationType episodeString:$episodeString){episodeString sourceUrls}}`;

const HARDCODED_SHOW_IDS: Record<string, string[]> = {
  "jojo's bizarre adventure": [
    'MeX4czvkwKGo3zdDp', 'zyqDjR8te4z6taKyk', 'GTAQH8Z9K6WbAdXsS',
    'JS9PzKiPanesGRvs5', 'b6xFsr7MDSMcJArB9', 'pwduJkjBLytqiWCvM',
  ],
};

const SPLIT_SEASONS: Record<string, Record<number, { from: number; showId: string | null; offset: number }[]>> = {
  'spy x family': {
    1: [
      { from: 1, showId: null, offset: 0 },
      { from: 13, showId: 'H8Aey6QXE7HSqwvW3', offset: 12 },
    ],
  },
};

export interface AllMangaResolveResult {
  ok: boolean;
  url?: string;
  type?: 'mp4' | 'hls';
  referer?: string;
  resolution?: string;
  sourceName?: string;
  searchTitle?: string;
  error?: string;
}

interface SourceUrlEntry {
  sourceUrl?: string;
  sourceName?: string;
  priority?: number;
}

@Injectable()
export class AllMangaClient {
  private readonly logger = new Logger(AllMangaClient.name);
  private readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.enabled = config.get<string>('ALLMANGA_ENABLED') !== 'false';
  }

  isEnabled() {
    return this.enabled;
  }

  async resolveEpisode(options: {
    title: string;
    seasonNumber?: number;
    episodeNumber?: number;
    isMovie?: boolean;
    dub?: boolean;
  }): Promise<AllMangaResolveResult> {
    if (!this.enabled) {
      return { ok: false, error: 'AllManga is disabled' };
    }

    try {
      const season = options.seasonNumber ?? 1;
      const episodeNumber = options.episodeNumber ?? 1;
      const dubSub = options.dub ? 'dub' : 'sub';
      const title = options.title;

      if (!options.isMovie) {
        const splitParts = SPLIT_SEASONS[title.toLowerCase()]?.[season];
        if (splitParts) {
          let activePart = splitParts[0];
          for (const part of splitParts) {
            if (episodeNumber >= part.from) activePart = part;
          }
          const partEp = episodeNumber - activePart.offset;
          if (activePart.showId) {
            const result = await this.resolveEpisodeFromId(activePart.showId, String(partEp), dubSub);
            if (result) return result;
          }
        }

        const hardcodedIds = HARDCODED_SHOW_IDS[title.toLowerCase()];
        if (hardcodedIds) {
          const showId = hardcodedIds[season - 1] ?? hardcodedIds[hardcodedIds.length - 1];
          const result = await this.resolveEpisodeFromId(showId, String(episodeNumber), dubSub);
          if (result) return result;
        }
      }

      const anilistResult = options.isMovie
        ? { title, romaji: null as string | null, episodes: null as number | null, nextTitle: null as string | null }
        : await this.anilistSeasonTitle(title, season);

      let searchTitle = anilistResult.title;
      let adjustedEpisodeNumber = episodeNumber;

      if (
        !options.isMovie &&
        anilistResult.episodes &&
        episodeNumber > anilistResult.episodes &&
        anilistResult.nextTitle
      ) {
        adjustedEpisodeNumber = episodeNumber - anilistResult.episodes;
        searchTitle = anilistResult.nextTitle;
      }

      const epStr = options.isMovie ? '1' : String(adjustedEpisodeNumber);
      const candidates = [
        searchTitle,
        this.sanitizeTitle(searchTitle),
        title,
        this.sanitizeTitle(title),
      ].filter(Boolean);

      let edges: { _id: string; name?: string }[] | null = null;
      let matchedTitle = searchTitle;

      for (const candidate of candidates) {
        edges = await this.searchAllmanga(candidate, dubSub);
        if (edges) {
          matchedTitle = candidate;
          break;
        }
      }

      if (!edges) {
        return { ok: false, error: `No results for: ${searchTitle}` };
      }

      const titleLower = matchedTitle.toLowerCase();
      const anime = edges.find((e) => (e.name || '').toLowerCase() === titleLower) ?? edges[0];

      const epCandidates = [epStr];
      if (!epStr.includes('.')) epCandidates.push(`${epStr}.0`);

      let sourceUrls: SourceUrlEntry[] | null = null;
      for (const attempt of epCandidates) {
        const epRes = await this.allanimeGQLEpisode({
          showId: anime._id,
          translationType: dubSub,
          episodeString: attempt,
        });
        if (!epRes.body) continue;
        const urls = this.parseEpisodeSourceUrls(epRes.body);
        if (urls?.length) {
          sourceUrls = urls;
          break;
        }
      }

      if (!sourceUrls?.length) {
        return { ok: false, error: `No sourceUrls for ep ${epStr}` };
      }

      const result = await this.trySourceUrls(sourceUrls);
      if (result) return { ...result, searchTitle: matchedTitle };

      return { ok: false, error: 'No playable link found' };
    } catch (error: any) {
      this.logger.warn(`AllManga resolve failed: ${error?.message ?? 'unknown'}`);
      return { ok: false, error: error?.message ?? 'Resolve failed' };
    }
  }

  private decodeAllanimeUrl(encoded: string): string {
    let input = encoded.startsWith('--') ? encoded.slice(2) : encoded;
    let result = '';
    for (let i = 0; i < input.length; i += 2) {
      const pair = input.slice(i, i + 2);
      result += ALLANIME_HEX_MAP[pair] !== undefined ? ALLANIME_HEX_MAP[pair] : pair;
    }
    return result.replace(/\\u002F/gi, '/').replace(/\\\|/g, '');
  }

  private decodeTobeparsed(blob: string): SourceUrlEntry[] {
    try {
      const buf = Buffer.from(blob, 'base64');
      const iv12 = buf.subarray(1, 13);
      const iv16 = Buffer.concat([iv12, Buffer.from([0, 0, 0, 2])]);
      const ct = buf.subarray(13, buf.length - 16);
      const decipher = crypto.createDecipheriv('aes-256-ctr', ALLANIME_KEY, iv16);
      decipher.setAutoPadding(false);
      const plain = Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');

      const sources: SourceUrlEntry[] = [];
      for (const chunk of plain.split(/[{}]/)) {
        const urlMatch = chunk.match(/"sourceUrl"\s*:\s*"(--[^"]+)"/);
        const nameMatch = chunk.match(/"sourceName"\s*:\s*"([^"]+)"/);
        const prioMatch = chunk.match(/"priority"\s*:\s*([0-9.]+)/);
        if (urlMatch) {
          sources.push({
            sourceUrl: urlMatch[1],
            sourceName: nameMatch ? nameMatch[1] : '',
            priority: prioMatch ? parseFloat(prioMatch[1]) : 0,
          });
        }
      }
      return sources;
    } catch {
      return [];
    }
  }

  private parseEpisodeSourceUrls(body: string): SourceUrlEntry[] | null {
    const tbMatch = body.match(/"tobeparsed"\s*:\s*"([^"]+)"/);
    if (tbMatch) {
      const sources = this.decodeTobeparsed(tbMatch[1]);
      if (sources.length) return sources;
    }
    try {
      const sourceUrls = JSON.parse(body)?.data?.episode?.sourceUrls;
      return sourceUrls?.length ? sourceUrls : null;
    } catch {
      return null;
    }
  }

  private httpsGet(urlStr: string): Promise<{ status: number; body: string }> {
    return new Promise((resolve, reject) => {
      const doGet = (url: string) => {
        const u = new URL(url);
        const req = https.request(
          {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
              Referer: 'https://allmanga.to',
              Origin: 'https://allmanga.to',
              Accept: '*/*',
            },
          },
          (res) => {
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const loc = res.headers.location.startsWith('http')
                ? res.headers.location
                : new URL(res.headers.location, url).href;
              res.resume();
              doGet(loc);
              return;
            }
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
          },
        );
        req.on('error', reject);
        req.setTimeout(12000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
        req.end();
      };
      doGet(urlStr);
    });
  }

  private followRedirects(urlStr: string, maxHops = 10): Promise<string> {
    return new Promise((resolve, reject) => {
      let hops = 0;
      const step = (url: string) => {
        if (++hops > maxHops) return resolve(url);
        let u: URL;
        try {
          u = new URL(url);
        } catch {
          return reject(new Error(`invalid url: ${url}`));
        }
        const lib = u.protocol === 'https:' ? https : http;
        const req = lib.request(
          {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'HEAD',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
              Referer: 'https://allmanga.to',
              Accept: '*/*',
            },
          },
          (res) => {
            res.resume();
            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              const loc = res.headers.location.startsWith('http')
                ? res.headers.location
                : new URL(res.headers.location, url).href;
              step(loc);
            } else {
              resolve(url);
            }
          },
        );
        req.on('error', reject);
        req.setTimeout(10000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
        req.end();
      };
      step(urlStr);
    });
  }

  private allanimeGQL(variables: Record<string, unknown>, query: string) {
    const body = JSON.stringify({ variables, query });
    return new Promise<{ status: number; body: string }>((resolve, reject) => {
      const req = https.request(
        {
          hostname: 'api.allanime.day',
          path: '/api',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
            Referer: 'https://allmanga.to',
            Origin: 'https://allmanga.to',
          },
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
        },
      );
      req.on('error', reject);
      req.setTimeout(12000, () => {
        req.destroy();
        reject(new Error('timeout'));
      });
      req.write(body);
      req.end();
    });
  }

  private async allanimeGQLEpisode(variables: Record<string, unknown>) {
    try {
      const encodedVars = encodeURIComponent(JSON.stringify(variables));
      const extensions = JSON.stringify({
        persistedQuery: { version: 1, sha256Hash: EPISODE_GQL_HASH },
      });
      const getUrl = `https://api.allanime.day/api?variables=${encodedVars}&extensions=${encodeURIComponent(extensions)}`;

      const getRes = await new Promise<{ status: number; body: string }>((resolve, reject) => {
        const u = new URL(getUrl);
        const req = https.request(
          {
            hostname: u.hostname,
            path: u.pathname + u.search,
            method: 'GET',
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/121.0',
              Referer: 'https://allmanga.to',
              Origin: 'https://youtu-chan.com',
              Accept: '*/*',
            },
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
          },
        );
        req.on('error', reject);
        req.setTimeout(12000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
        req.end();
      });

      if (getRes.body && getRes.body.includes('tobeparsed')) return getRes;
    } catch {
      // fall through to POST
    }

    return this.allanimeGQL(variables, EPISODE_GQL);
  }

  private sanitizeTitle(t: string) {
    return t.replace(/[''`´]/g, '').replace(/[:!.]/g, '').replace(/\s+/g, ' ').trim();
  }

  private async anilistSeasonTitle(baseTitle: string, seasonNumber: number) {
    const resolveS1 = seasonNumber <= 1;
    const query = `query($search:String){Media(search:$search,type:ANIME,sort:SEARCH_MATCH){title{english romaji}episodes relations{edges{relationType node{type format title{english romaji}episodes startDate{year}seasonYear}}}}}`;
    const body = JSON.stringify({ query, variables: { search: baseTitle } });

    const fallback = {
      title: baseTitle,
      romaji: null as string | null,
      episodes: null as number | null,
      nextTitle: null as string | null,
    };

    try {
      const json = await new Promise<any>((resolve, reject) => {
        const req = https.request(
          {
            hostname: 'graphql.anilist.co',
            path: '/',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
              'Content-Length': Buffer.byteLength(body),
            },
          },
          (res) => {
            let data = '';
            res.on('data', (c) => (data += c));
            res.on('end', () => {
              try {
                resolve(JSON.parse(data));
              } catch {
                resolve(null);
              }
            });
          },
        );
        req.on('error', reject);
        req.setTimeout(8000, () => {
          req.destroy();
          reject(new Error('timeout'));
        });
        req.write(body);
        req.end();
      });

      const media = json?.data?.Media;
      if (!media) return fallback;

      const s1Episodes = media?.episodes || null;
      const sequels = (media.relations?.edges || [])
        .filter(
          (e: any) =>
            e.relationType === 'SEQUEL' &&
            e.node.type === 'ANIME' &&
            (e.node.format === 'TV' || e.node.format === 'TV_SHORT'),
        )
        .sort((a: any, b: any) => {
          const ya = a.node.startDate?.year || a.node.seasonYear || 9999;
          const yb = b.node.startDate?.year || b.node.seasonYear || 9999;
          return ya - yb;
        });

      const getTitle = (node: any) => node.title?.english || node.title?.romaji || null;

      if (resolveS1) {
        const next = sequels[0]?.node ?? null;
        return {
          title: media.title?.english || baseTitle,
          romaji: media.title?.romaji || null,
          episodes: s1Episodes,
          nextTitle: next ? getTitle(next) : null,
        };
      }

      const target = sequels[seasonNumber - 2];
      if (!target) return { ...fallback, romaji: media.title?.romaji || null };

      const nextNode = sequels[seasonNumber - 1]?.node ?? null;
      return {
        title: getTitle(target.node) || baseTitle,
        romaji: target.node.title?.romaji || media.title?.romaji || null,
        episodes: target.node.episodes || null,
        nextTitle: nextNode ? getTitle(nextNode) : null,
      };
    } catch {
      return fallback;
    }
  }

  private async searchAllmanga(query: string, dubSub: string) {
    const vars = {
      search: { allowAdult: true, allowUnknown: false, query: query.toLowerCase() },
      limit: 40,
      page: 1,
      translationType: dubSub,
      countryOrigin: 'ALL',
    };
    const res = await this.allanimeGQL(vars, SEARCH_GQL);
    if (!res.body) return null;
    try {
      const edges = JSON.parse(res.body)?.data?.shows?.edges;
      return edges?.length ? edges : null;
    } catch {
      return null;
    }
  }

  private async resolveEpisodeFromId(showId: string, epStr: string, dubSub: string) {
    const candidates = [epStr];
    if (!epStr.includes('.')) candidates.push(`${epStr}.0`);

    let sourceUrls: SourceUrlEntry[] | null = null;
    for (const attempt of candidates) {
      const epRes = await this.allanimeGQLEpisode({
        showId,
        translationType: dubSub,
        episodeString: attempt,
      });
      if (!epRes.body) continue;
      const urls = this.parseEpisodeSourceUrls(epRes.body);
      if (urls?.length) {
        sourceUrls = urls;
        break;
      }
    }
    if (!sourceUrls) return null;
    return this.trySourceUrls(sourceUrls);
  }

  private async trySourceUrls(sourceUrls: SourceUrlEntry[]): Promise<AllMangaResolveResult | null> {
    const decodedSources = sourceUrls
      .filter((s) => s.sourceUrl?.startsWith('--'))
      .map((s) => ({
        sourceName: s.sourceName || '',
        priority: s.priority || 0,
        path: this.decodeAllanimeUrl(s.sourceUrl!).replace('/clock', '/clock.json'),
      }))
      .sort((a, b) => {
        const ai = PROVIDER_PRIORITY.indexOf(a.sourceName);
        const bi = PROVIDER_PRIORITY.indexOf(b.sourceName);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });

    for (const src of decodedSources) {
      let fetchUrl = src.path;
      if (fetchUrl.startsWith('//')) fetchUrl = `https:${fetchUrl}`;
      else if (fetchUrl.startsWith('/')) fetchUrl = `https://allanime.day${fetchUrl}`;
      else if (!fetchUrl.startsWith('http')) fetchUrl = `https://allanime.day/${fetchUrl}`;

      try {
        if (fetchUrl.includes('fast4speed.rsvp') || src.sourceName === 'Yt-mp4') {
          const finalUrl = await this.followRedirects(fetchUrl).catch(() => null);
          if (!finalUrl) continue;

          let isGoogleVideoHost = false;
          try {
            const host = new URL(finalUrl).hostname.toLowerCase();
            isGoogleVideoHost = host === 'googlevideo.com' || host.endsWith('.googlevideo.com');
          } catch {
            isGoogleVideoHost = false;
          }

          if (
            /\.(mp4|webm|mkv|m3u8)(\?|$)/i.test(finalUrl) ||
            isGoogleVideoHost ||
            (!finalUrl.includes('youtube.com/watch') && !finalUrl.includes('youtu.be/'))
          ) {
            return {
              ok: true,
              url: finalUrl,
              type: finalUrl.includes('.m3u8') ? 'hls' : 'mp4',
              resolution: '?',
              sourceName: src.sourceName,
              referer: 'https://allmanga.to',
            };
          }
          continue;
        }

        const linkRes = await this.httpsGet(fetchUrl);
        if (linkRes.status !== 200 || !linkRes.body) continue;

        let linkJson: any;
        try {
          linkJson = JSON.parse(linkRes.body);
        } catch {
          continue;
        }

        const links = linkJson?.links;
        if (!Array.isArray(links) || !links.length) continue;

        const allLinks = links.filter((l: any) => l.link);
        const mp4Links = allLinks.filter(
          (l: any) => !l.link.includes('.m3u8') && !l.link.includes('master.'),
        );
        const best = (mp4Links.length ? mp4Links : allLinks).sort(
          (a: any, b: any) => (parseInt(b.resolutionStr) || 0) - (parseInt(a.resolutionStr) || 0),
        )[0];

        if (!best) continue;

        return {
          ok: true,
          url: best.link,
          type: best.link.includes('.m3u8') ? 'hls' : 'mp4',
          resolution: best.resolutionStr || '?',
          sourceName: src.sourceName,
          referer: 'https://allmanga.to',
        };
      } catch {
        continue;
      }
    }

    return null;
  }
}
