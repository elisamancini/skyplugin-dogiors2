/**
 * SkyStream Plugin v2 TypeScript Source: StreamingCommunity
 * Compatible with SkyStream Gen 2 Architecture and skystream-cli esbuild bundling
 */

/// <reference path="./types.d.ts" />
import type { Result, IMultimediaItem, IEpisode, IStreamResult, ITrailer } from './types.d.ts';

interface InertiaTitleImage {
  id?: number;
  filename: string;
  type: 'poster' | 'background' | 'cover' | 'logo' | string;
}

interface InertiaActor {
  id: number;
  name: string;
}

interface InertiaTrailer {
  id?: number;
  youtube_id?: string;
}

interface InertiaGenre {
  id: number;
  name: string;
}

interface InertiaEpisode {
  id: number;
  number: number;
  name: string;
  plot?: string;
  duration?: number;
  scws_id?: number;
  season_id?: number;
  quality?: string;
  dub_ita?: number;
  images?: InertiaTitleImage[];
}

interface InertiaSeason {
  id: number;
  number: number;
  name?: string | null;
  plot?: string;
  release_date?: string;
  episodes?: InertiaEpisode[];
}

interface InertiaTitle {
  id: number;
  name: string;
  slug: string;
  type: string;
  plot?: string;
  score?: string;
  release_date?: string;
  age?: number;
  runtime?: number;
  tmdb_id?: number;
  imdb_id?: string;
  images?: InertiaTitleImage[];
  genres?: InertiaGenre[];
  main_actors?: InertiaActor[];
  trailers?: InertiaTrailer[];
  seasons?: InertiaSeason[];
  status?: string;
}

interface InertiaSlider {
  name: string;
  label?: string;
  titles?: InertiaTitle[];
}

interface InertiaProps {
  scws_url?: string;
  cdn_url?: string;
  title?: InertiaTitle;
  loadedSeason?: InertiaSeason;
  sliders?: InertiaSlider[];
  titles?: InertiaTitle[];
}

interface InertiaResponse {
  props: InertiaProps;
  url: string;
  version: string;
}

const state = {
  cookies: '',
  decodedXsrfToken: '',
  inertiaVersion: '',
  lang: 'it'
};

function getBaseUrl(): string {
  const raw = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://streamingunity.fun';
  return raw.replace(/\/+$/, '');
}

function getCdnHost(): string {
  try {
    const u = new URL(getBaseUrl());
    return 'cdn.' + u.host;
  } catch {
    return 'cdn.streamingunity.fun';
  }
}

function unescapeEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractInertiaData(html: string): InertiaResponse | null {
  if (!html) return null;
  if (html.trim().startsWith('{')) {
    try {
      return JSON.parse(html) as InertiaResponse;
    } catch {
      return null;
    }
  }
  const match = html.match(/id="app"[^>]*data-page="([^"]+)"/) || html.match(/data-page="([^"]+)"/);
  if (!match) return null;
  try {
    return JSON.parse(unescapeEntities(match[1])) as InertiaResponse;
  } catch {
    return null;
  }
}

function extractCookies(headers: Record<string, any>) {
  if (!headers) return;
  const setCookie = headers['set-cookie'] || headers['Set-Cookie'];
  if (setCookie) {
    const list = Array.isArray(setCookie) ? setCookie : [setCookie];
    const parsed: string[] = [];
    list.forEach(c => {
      const first = c.split(';')[0];
      if (first) parsed.push(first.trim());
    });
    if (parsed.length > 0) {
      state.cookies = parsed.join('; ');
    }
  }
}

async function request(url: string, options: { method?: string; headers?: Record<string, string>; body?: any } = {}) {
  const headers = options.headers || {};
  const method = (options.method || 'GET').toUpperCase();
  const body = options.body;

  if (state.cookies && !headers['Cookie'] && !headers['cookie']) {
    headers['Cookie'] = state.cookies;
  }

  if (typeof http_get !== 'undefined' && method === 'GET') {
    const res = await http_get(url, headers);
    if (res && res.headers) {
      extractCookies(res.headers);
    }
    return {
      status: res.status,
      text: async () => res.body || '',
      json: async () => JSON.parse(res.body || '{}'),
      headers: res.headers || {}
    };
  }

  if (typeof http_post !== 'undefined' && method === 'POST') {
    const res = await http_post(url, headers, typeof body === 'string' ? body : JSON.stringify(body || {}));
    if (res && res.headers) {
      extractCookies(res.headers);
    }
    return {
      status: res.status,
      text: async () => res.body || '',
      json: async () => JSON.parse(res.body || '{}'),
      headers: res.headers || {}
    };
  }

  const res = await fetch(url, {
    method,
    headers,
    body: typeof body === 'object' ? JSON.stringify(body) : body
  });

  return res;
}

async function ensureSession(): Promise<void> {
  const baseUrl = getBaseUrl();
  const siteRoot = baseUrl + '/';
  const mainUrl = `${baseUrl}/${state.lang}`;

  if (!state.inertiaVersion || !state.cookies) {
    try {
      const archiveRes = await request(`${mainUrl}/archive`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36'
        }
      });
      const html = await archiveRes.text();
      const inertia = extractInertiaData(html);
      if (inertia && inertia.version) {
        state.inertiaVersion = inertia.version;
      }

      await request(`${siteRoot}sanctum/csrf-cookie`, {
        headers: {
          'Referer': `${mainUrl}/`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const match = state.cookies.match(/XSRF-TOKEN=([^;]+)/);
      if (match) {
        state.decodedXsrfToken = decodeURIComponent(match[1]);
      }
    } catch (err) {
      console.warn('Session setup warning:', err);
    }
  }
}

function mapTitleToMultimediaItem(title: InertiaTitle, customCdn?: string): IMultimediaItem {
  const baseUrl = getBaseUrl();
  const cdn = customCdn || `https://${getCdnHost()}`;

  let posterFilename: string | undefined;
  let bannerFilename: string | undefined;
  let logoFilename: string | undefined;

  if (Array.isArray(title.images)) {
    const posterObj = title.images.find(img => img.type === 'poster');
    const bannerObj = title.images.find(img => img.type === 'background');
    const logoObj = title.images.find(img => img.type === 'logo');
    const coverObj = title.images.find(img => img.type === 'cover');

    posterFilename = posterObj?.filename || coverObj?.filename || title.images[0]?.filename;
    bannerFilename = bannerObj?.filename || posterFilename;
    logoFilename = logoObj?.filename;
  }

  const posterUrl = posterFilename
    ? `${cdn}/images/${posterFilename}`
    : 'https://placehold.co/400x600.png?text=' + encodeURIComponent(title.name);

  const bannerUrl = bannerFilename ? `${cdn}/images/${bannerFilename}` : undefined;
  const logoUrl = logoFilename ? `${cdn}/images/${logoFilename}` : undefined;

  const isTv = title.type === 'tv' || title.type === 'series';
  const parsedYear = title.release_date ? parseInt(title.release_date.split('-')[0], 10) : undefined;
  const parsedScore = title.score ? parseFloat(title.score) : undefined;

  return new MultimediaItem({
    title: title.name,
    url: `${baseUrl}/${state.lang}/titles/${title.id}-${title.slug}`,
    posterUrl: posterUrl,
    bannerUrl: bannerUrl,
    logoUrl: logoUrl,
    type: isTv ? 'series' : 'movie',
    year: isNaN(parsedYear || NaN) ? undefined : parsedYear,
    score: isNaN(parsedScore || NaN) ? undefined : parsedScore,
    duration: title.runtime || undefined,
    description: title.plot || '',
    contentRating: title.age ? `${title.age}+` : undefined,
    headers: {
      'Referer': `${baseUrl}/`
    }
  });
}

/**
 * 1. getHome: Loads categories for the dashboard
 */
export async function getHome(cb: (res: Result<Record<string, IMultimediaItem[]>>) => void) {
  try {
    await ensureSession();
    const baseUrl = getBaseUrl();
    const homeUrl = `${baseUrl}/${state.lang}`;

    const res = await request(homeUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });

    const html = await res.text();
    const inertia = extractInertiaData(html);

    if (!inertia || !inertia.props) {
      return cb({
        success: false,
        errorCode: 'NO_DATA',
        message: 'Impossibile estrarre i dati della home da StreamingCommunity'
      });
    }

    const cdnUrl = inertia.props.cdn_url || `https://${getCdnHost()}`;
    const sliders = inertia.props.sliders || [];
    const categories: Record<string, IMultimediaItem[]> = {};

    // Reserved "Trending" hero carousel
    const trending = sliders.find(s => s.name === 'trending') || sliders[0];
    if (trending && Array.isArray(trending.titles)) {
      categories['Trending'] = trending.titles
        .filter(t => t.type === 'movie' || t.type === 'tv')
        .map(t => mapTitleToMultimediaItem(t, cdnUrl));
    }

    // Top 10 row
    const top10 = sliders.find(s => s.name === 'top10');
    if (top10 && Array.isArray(top10.titles)) {
      categories['Top 10 Oggi'] = top10.titles
        .filter(t => t.type === 'movie' || t.type === 'tv')
        .map(t => mapTitleToMultimediaItem(t, cdnUrl));
    }

    // Latest row
    const latest = sliders.find(s => s.name === 'latest');
    if (latest && Array.isArray(latest.titles)) {
      categories['Ultime Uscite'] = latest.titles
        .filter(t => t.type === 'movie' || t.type === 'tv')
        .map(t => mapTitleToMultimediaItem(t, cdnUrl));
    }

    return cb({
      success: true,
      data: categories
    });
  } catch (err: any) {
    return cb({
      success: false,
      errorCode: 'HOME_ERROR',
      message: err.message || String(err)
    });
  }
}

/**
 * 2. search: Searches titles
 */
export async function search(query: string, cb: (res: Result<IMultimediaItem[]>) => void) {
  try {
    if (!query || !query.trim()) {
      return cb({ success: true, data: [] });
    }

    await ensureSession();
    const baseUrl = getBaseUrl();
    const searchUrl = `${baseUrl}/${state.lang}/search?q=${encodeURIComponent(query.trim())}`;

    const res = await request(searchUrl, {
      headers: {
        'X-Inertia': 'true',
        'X-Inertia-Version': state.inertiaVersion || '',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const text = await res.text();
    const inertia = extractInertiaData(text);

    if (!inertia || !inertia.props) {
      return cb({
        success: false,
        errorCode: 'SEARCH_PARSE_ERROR',
        message: 'Errore di parsing dei risultati di ricerca'
      });
    }

    const titles = inertia.props.titles || [];
    const cdnUrl = inertia.props.cdn_url || `https://${getCdnHost()}`;

    const results = titles
      .filter(t => t.type === 'movie' || t.type === 'tv')
      .map(t => mapTitleToMultimediaItem(t, cdnUrl));

    return cb({
      success: true,
      data: results
    });
  } catch (err: any) {
    return cb({
      success: false,
      errorCode: 'SEARCH_ERROR',
      message: err.message || String(err)
    });
  }
}

/**
 * 3. load: Detailed metadata and episode tree
 */
export async function load(url: string, cb: (res: Result<IMultimediaItem>) => void) {
  try {
    await ensureSession();
    const baseUrl = getBaseUrl();

    let targetUrl = url;
    if (!targetUrl.includes(`/${state.lang}/`)) {
      targetUrl = targetUrl.replace(new URL(targetUrl).origin, `${baseUrl}/${state.lang}`);
    }

    const res = await request(targetUrl, {
      headers: {
        'X-Inertia': 'true',
        'X-Inertia-Version': state.inertiaVersion || '',
        'X-Requested-With': 'XMLHttpRequest'
      }
    });

    const text = await res.text();
    const inertia = extractInertiaData(text);

    if (!inertia || !inertia.props || !inertia.props.title) {
      return cb({
        success: false,
        errorCode: 'LOAD_ERROR',
        message: 'Impossibile caricare i dettagli del titolo'
      });
    }

    const props = inertia.props;
    const title = props.title;
    if (!title) {
      return cb({
        success: false,
        errorCode: 'LOAD_ERROR',
        message: 'Dati del titolo mancanti'
      });
    }
    const cdnUrl = props.cdn_url || `https://${getCdnHost()}`;
    const isTv = title.type === 'tv' || title.type === 'series';

    const tags = Array.isArray(title.genres) ? title.genres.map(g => g.name) : [];
    const cast = Array.isArray(title.main_actors)
      ? title.main_actors.map(a => new Actor({ name: a.name }))
      : [];

    const trailers: ITrailer[] = [];
    if (Array.isArray(title.trailers)) {
      title.trailers.forEach(t => {
        if (t.youtube_id) {
          trailers.push(new Trailer({ url: `https://www.youtube.com/watch?v=${t.youtube_id}` }));
        }
      });
    }

    let recommendations: IMultimediaItem[] = [];
    if (Array.isArray(props.sliders) && props.sliders[0]?.titles) {
      recommendations = props.sliders[0].titles
        .filter(t => t.type === 'movie' || t.type === 'tv')
        .slice(0, 10)
        .map(t => mapTitleToMultimediaItem(t, cdnUrl));
    }

    let posterFilename: string | undefined;
    let bannerFilename: string | undefined;
    if (Array.isArray(title.images)) {
      const posterObj = title.images.find(img => img.type === 'poster');
      const bannerObj = title.images.find(img => img.type === 'background');
      const coverObj = title.images.find(img => img.type === 'cover');
      posterFilename = posterObj?.filename || coverObj?.filename || title.images[0]?.filename;
      bannerFilename = bannerObj?.filename || posterFilename;
    }

    const posterUrl = posterFilename
      ? `${cdnUrl}/images/${posterFilename}`
      : 'https://placehold.co/400x600.png?text=' + encodeURIComponent(title.name);
    const bannerUrl = bannerFilename ? `${cdnUrl}/images/${bannerFilename}` : undefined;

    const episodes: IEpisode[] = [];
    if (isTv && Array.isArray(title.seasons)) {
      for (const season of title.seasons) {
        let seasonEpisodes = season.episodes || [];

        if (props.loadedSeason && props.loadedSeason.id === season.id && props.loadedSeason.episodes) {
          seasonEpisodes = props.loadedSeason.episodes;
        } else {
          try {
            const seasonUrl = `${baseUrl}/${state.lang}/titles/${title.id}-${title.slug}/season-${season.number}`;
            const seasonRes = await request(seasonUrl, {
              headers: {
                'X-Inertia': 'true',
                'X-Inertia-Version': state.inertiaVersion || '',
                'X-Requested-With': 'XMLHttpRequest'
              }
            });
            const seasonData = extractInertiaData(await seasonRes.text());
            if (seasonData?.props?.loadedSeason?.episodes) {
              seasonEpisodes = seasonData.props.loadedSeason.episodes;
            }
          } catch {
            // ignore season fetch failure
          }
        }

        seasonEpisodes.forEach(ep => {
          let epCover: string | undefined;
          if (Array.isArray(ep.images)) {
            const coverImg = ep.images.find(i => i.type === 'cover' || i.type === 'poster');
            epCover = coverImg?.filename;
          }

          const epPoster = epCover ? `${cdnUrl}/images/${epCover}` : posterUrl;
          const iframeStreamUrl = `${baseUrl}/${state.lang}/iframe/${title.id}?episode_id=${ep.id}&canPlayFHD=1`;

          episodes.push(new Episode({
            name: ep.name || `Episodio ${ep.number}`,
            url: iframeStreamUrl,
            season: season.number,
            episode: ep.number,
            description: ep.plot || '',
            posterUrl: epPoster,
            runtime: ep.duration || undefined,
            dubStatus: ep.dub_ita ? 'dubbed' : 'none'
          }));
        });
      }
    }

    const parsedYear = title.release_date ? parseInt(title.release_date.split('-')[0], 10) : undefined;
    const parsedScore = title.score ? parseFloat(title.score) : undefined;

    const mediaItem = new MultimediaItem({
      title: title.name,
      url: targetUrl,
      posterUrl: posterUrl,
      bannerUrl: bannerUrl,
      type: isTv ? 'series' : 'movie',
      year: isNaN(parsedYear || NaN) ? undefined : parsedYear,
      score: isNaN(parsedScore || NaN) ? undefined : parsedScore,
      duration: isTv ? undefined : (title.runtime || undefined),
      status: isTv ? (title.status === 'Ended' ? 'completed' : 'ongoing') : 'completed',
      contentRating: title.age ? `${title.age}+` : undefined,
      description: title.plot || '',
      tags: tags,
      cast: cast,
      trailers: trailers,
      recommendations: recommendations,
      playbackPolicy: 'none',
      isAdult: false,
      syncData: {
        tmdb: title.tmdb_id ? String(title.tmdb_id) : '',
        imdb: title.imdb_id ? String(title.imdb_id) : ''
      },
      episodes: isTv ? episodes : undefined
    });

    return cb({
      success: true,
      data: mediaItem
    });
  } catch (err: any) {
    return cb({
      success: false,
      errorCode: 'LOAD_ERROR',
      message: err.message || String(err)
    });
  }
}

/**
 * 4. loadStreams: Resolves VixCloud HLS Master Playlist
 */
export async function loadStreams(url: string, cb: (res: Result<IStreamResult[]>) => void) {
  try {
    const baseUrl = getBaseUrl();
    const streams: IStreamResult[] = [];

    let iframeUrl = url;
    if (url.includes('/titles/')) {
      const idMatch = url.match(/\/titles\/(\d+)/);
      if (idMatch) {
        iframeUrl = `${baseUrl}/${state.lang}/iframe/${idMatch[1]}?canPlayFHD=1`;
      }
    }

    const iframePageRes = await request(iframeUrl, {
      headers: {
        'Referer': `${baseUrl}/${state.lang}/`
      }
    });

    const iframePageHtml = await iframePageRes.text();
    const srcMatch = iframePageHtml.match(/<iframe[^>]+src="([^"]+)"/) || iframePageHtml.match(/src="([^"]+)"/);

    if (srcMatch) {
      const embedUrl = srcMatch[1].replace(/&amp;/g, '&');

      if (embedUrl.includes('vixcloud.co')) {
        const embedRes = await request(embedUrl, {
          headers: {
            'Referer': iframeUrl
          }
        });

        const embedHtml = await embedRes.text();

        const tokenMatch = embedHtml.match(/['"]token['"]\s*:\s*['"]([^'"]+)['"]/);
        const expiresMatch = embedHtml.match(/['"]expires['"]\s*:\s*['"]([^'"]+)['"]/);
        const playlistUrlMatch = embedHtml.match(/url\s*:\s*['"]([^'"]+)['"]/);
        const canPlayFHD = /window\.canPlayFHD\s*=\s*true/.test(embedHtml);

        if (tokenMatch && expiresMatch && playlistUrlMatch) {
          const token = tokenMatch[1];
          const expires = expiresMatch[1];
          const rawPlaylistUrl = playlistUrlMatch[1].replace(/\\\//g, '/');
          const params = `token=${token}&expires=${expires}`;

          let masterPlaylistUrl = '';
          if (rawPlaylistUrl.includes('?b')) {
            masterPlaylistUrl = `${rawPlaylistUrl.replace('?b:1', '?b=1')}&${params}`;
          } else {
            masterPlaylistUrl = `${rawPlaylistUrl}?${params}`;
          }

          if (canPlayFHD) {
            masterPlaylistUrl += '&h=1';
          }

          streams.push(new StreamResult({
            url: masterPlaylistUrl,
            source: 'VixCloud (FHD Master HLS)',
            headers: {
              'Referer': 'https://vixcloud.co/',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0.0.0 Safari/537.36'
            }
          }));
        }
      }
    }

    return cb({
      success: true,
      data: streams
    });
  } catch (err: any) {
    return cb({
      success: false,
      errorCode: 'STREAM_ERROR',
      message: err.message || String(err)
    });
  }
}

// Global scope registration
declare const globalThis: any;
globalThis.getHome = getHome;
globalThis.search = search;
globalThis.load = load;
globalThis.loadStreams = loadStreams;
