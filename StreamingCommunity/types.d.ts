/**
 * SkyStream Plugin v2 Type Definitions
 * Source: https://github.com/akashdh11/skystream-tools/blob/main/sdk/types.d.ts
 */

export interface PluginDomain {
  name: string;
  url: string;
}

export interface PluginSubProvider {
  id: string;
  name: string;
  baseUrl?: string;
}

export interface Manifest {
  packageName: string;
  name: string;
  version: number;
  authors: string[];
  baseUrl: string;
  description?: string;
  iconUrl?: string;
  languages: string[];
  categories: string[];
  domains?: PluginDomain[];
  providers?: PluginSubProvider[];
  providerId?: string;
}

export type Result<T> =
  | { success: true; data: T }
  | { success: false; errorCode: string; message: string };

export type MultimediaType = 'movie' | 'series' | 'anime' | 'livestream' | 'other';
export type ShowStatus = 'completed' | 'ongoing' | 'upcoming';
export type DubStatus = 'none' | 'dubbed' | 'subbed';

export interface IActor {
  name: string;
  image?: string;
  role?: string;
  voiceActor?: IActor;
}

export interface ITrailer {
  url: string;
  headers?: Record<string, string>;
}

export interface INextAiring {
  episode: number;
  unixTime: number;
  season?: number;
}

export interface IMultimediaItem {
  title: string;
  url: string;
  posterUrl: string;
  type?: MultimediaType;
  bannerUrl?: string;
  logoUrl?: string;
  description?: string;
  episodes?: IEpisode[];
  headers?: Record<string, string>;
  provider?: string;
  year?: number;
  score?: number;
  duration?: number;
  status?: ShowStatus;
  tags?: string[];
  contentRating?: string;
  cast?: IActor[];
  trailers?: ITrailer[];
  recommendations?: IMultimediaItem[];
  playbackPolicy?: string;
  isAdult?: boolean;
  nextAiring?: INextAiring;
  syncData?: Record<string, string>;
  streams?: IStreamResult[];
}

export interface IEpisode {
  name: string;
  url: string;
  season?: number;
  episode?: number;
  description?: string;
  posterUrl?: string;
  headers?: Record<string, string>;
  rating?: number;
  runtime?: number;
  airDate?: string;
  dubStatus?: DubStatus;
  playbackPolicy?: string;
  streams?: IStreamResult[];
}

export interface IStreamResult {
  url: string;
  source?: string;
  headers?: Record<string, string>;
  subtitles?: { url: string; label: string; lang: string }[];
  drmKid?: string;
  drmKey?: string;
  licenseUrl?: string;
  quality?: string;
}

declare global {
  const manifest: Manifest;

  class Actor implements IActor {
    constructor(data: IActor);
    name: string;
    image?: string;
    role?: string;
    voiceActor?: Actor;
  }

  class Trailer implements ITrailer {
    constructor(data: ITrailer);
    url: string;
    headers?: Record<string, string>;
  }

  class NextAiring implements INextAiring {
    constructor(data: INextAiring);
    episode: number;
    unixTime: number;
    season?: number;
  }

  class MultimediaItem implements IMultimediaItem {
    constructor(data: IMultimediaItem);
    title: string;
    url: string;
    posterUrl: string;
    type?: MultimediaType;
    bannerUrl?: string;
    logoUrl?: string;
    description?: string;
    episodes?: IEpisode[];
    headers?: Record<string, string>;
    provider?: string;
    year?: number;
    score?: number;
    duration?: number;
    status?: ShowStatus;
    tags?: string[];
    contentRating?: string;
    cast?: Actor[];
    trailers?: Trailer[];
    recommendations?: MultimediaItem[];
    playbackPolicy?: string;
    isAdult?: boolean;
    nextAiring?: NextAiring;
    syncData?: Record<string, string>;
    streams?: StreamResult[];
  }

  class Episode implements IEpisode {
    constructor(data: IEpisode);
    name: string;
    url: string;
    season?: number;
    episode?: number;
    description?: string;
    posterUrl?: string;
    headers?: Record<string, string>;
    rating?: number;
    runtime?: number;
    airDate?: string;
    dubStatus?: DubStatus;
    playbackPolicy?: string;
    streams?: StreamResult[];
  }

  class StreamResult implements IStreamResult {
    constructor(data: IStreamResult);
    url: string;
    source?: string;
    headers?: Record<string, string>;
    subtitles?: { url: string; label: string; lang: string }[];
    drmKid?: string;
    drmKey?: string;
    licenseUrl?: string;
    quality?: string;
  }

  function http_get(
    url: string,
    headers?: Record<string, string>,
    callback?: (res: any) => void
  ): Promise<{ status: number; statusCode?: number; body: string; headers: Record<string, string> }>;

  function http_post(
    url: string,
    headers?: Record<string, string>,
    body?: string,
    callback?: (res: any) => void
  ): Promise<{ status: number; statusCode?: number; body: string; headers: Record<string, string> }>;
}
