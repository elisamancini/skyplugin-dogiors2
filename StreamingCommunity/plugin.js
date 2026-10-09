(function () {
  /**
   * SkyStream Gen 2 Official Plugin: StreamingCommunity
   * Ported strictly from CloudStream (it.dogior.hadEnough.StreamingCommunity)
   * Target Environment: SkyStream App (v2+)
   */

  // Polyfills for browser / runtime environments where classes might not be predefined
  const SafeMultimediaItem = typeof MultimediaItem !== 'undefined' ? MultimediaItem : class {
    constructor(data) {
      this.type = 'movie';
      this.status = 'ongoing';
      this.playbackPolicy = 'none';
      this.isAdult = false;
      this.streams = [];
      this.syncData = {};
      Object.assign(this, data);
    }
  };

  const SafeEpisode = typeof Episode !== 'undefined' ? Episode : class {
    constructor(data) {
      this.season = 1;
      this.episode = 1;
      this.dubStatus = 'none';
      this.playbackPolicy = 'none';
      this.streams = [];
      Object.assign(this, data);
    }
  };

  const SafeStreamResult = typeof StreamResult !== 'undefined' ? StreamResult : class {
    constructor(data) {
      this.quality = '1080p';
      Object.assign(this, data);
    }
  };

  const SafeActor = typeof Actor !== 'undefined' ? Actor : class {
    constructor(data) {
      Object.assign(this, data);
    }
  };

  const SafeTrailer = typeof Trailer !== 'undefined' ? Trailer : class {
    constructor(data) {
      Object.assign(this, data);
    }
  };

  // Internal Session & State Cache
  const state = {
    cookies: '',
    decodedXsrfToken: '',
    inertiaVersion: '',
    lang: 'it'
  };

  // HTTP Helper Bridge supporting both SkyStream Native Bridge and Standard Fetch
  async function request(url, options = {}) {
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
        status: res.status || res.statusCode || 200,
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
        status: res.status || res.statusCode || 200,
        text: async () => res.body || '',
        json: async () => JSON.parse(res.body || '{}'),
        headers: res.headers || {}
      };
    }

    // Standard Fetch Fallback
    const res = await fetch(url, {
      method,
      headers,
      body: typeof body === 'object' ? JSON.stringify(body) : body
    });

    return res;
  }

  function extractCookies(headers) {
    if (!headers) return;
    const setCookie = headers['set-cookie'] || headers['Set-Cookie'];
    if (setCookie) {
      const cookiesList = Array.isArray(setCookie) ? setCookie : [setCookie];
      const parsed = [];
      cookiesList.forEach(c => {
        const first = c.split(';')[0];
        if (first) parsed.push(first.trim());
      });
      if (parsed.length > 0) {
        state.cookies = parsed.join('; ');
      }
    }
  }

  function getBaseUrl() {
    const raw = (typeof manifest !== 'undefined' && manifest.baseUrl) ? manifest.baseUrl : 'https://streamingunity.fun';
    return raw.replace(/\/+$/, '');
  }

  function getCdnHost() {
    try {
      const u = new URL(getBaseUrl());
      return 'cdn.' + u.host;
    } catch {
      return 'cdn.streamingunity.fun';
    }
  }

  function unescapeEntities(str) {
    if (!str) return '';
    return str
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>');
  }

  function extractInertiaData(html) {
    if (!html) return null;
    if (html.trim().startsWith('{')) {
      try {
        return JSON.parse(html);
      } catch {
        return null;
      }
    }
    const match = html.match(/id="app"[^>]*data-page="([^"]+)"/) || html.match(/data-page="([^"]+)"/);
    if (!match) return null;
    try {
      return JSON.parse(unescapeEntities(match[1]));
    } catch {
      return null;
    }
  }

  async function ensureSession() {
    const baseUrl = getBaseUrl();
    const siteRoot = baseUrl + '/';
    const mainUrl = `${baseUrl}/${state.lang}`;

    if (!state.inertiaVersion || !state.cookies) {
      try {
        const archiveRes = await request(`${mainUrl}/archive`, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
          }
        });
        const html = await archiveRes.text();
        const inertia = extractInertiaData(html);
        if (inertia && inertia.version) {
          state.inertiaVersion = inertia.version;
        }

        // Sanctum CSRF cookie
        await request(`${siteRoot}sanctum/csrf-cookie`, {
          headers: {
            'Referer': `${mainUrl}/`,
            'X-Requested-With': 'XMLHttpRequest'
          }
        });

        // Parse decoded XSRF token
        const match = state.cookies.match(/XSRF-TOKEN=([^;]+)/);
        if (match) {
          state.decodedXsrfToken = decodeURIComponent(match[1]);
        }
      } catch (err) {
        console.warn('StreamingCommunity session init warning:', err);
      }
    }
  }

  function mapTitleToMultimediaItem(title, customCdn) {
    const baseUrl = getBaseUrl();
    const cdn = customCdn || `https://${getCdnHost()}`;

    // Poster image
    let posterFilename = null;
    let bannerFilename = null;
    let logoFilename = null;

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

    return new SafeMultimediaItem({
      title: title.name,
      url: `${baseUrl}/${state.lang}/titles/${title.id}-${title.slug}`,
      posterUrl: posterUrl,
      bannerUrl: bannerUrl,
      logoUrl: logoUrl,
      type: isTv ? 'series' : 'movie',
      year: isNaN(parsedYear) ? undefined : parsedYear,
      score: isNaN(parsedScore) ? undefined : parsedScore,
      duration: title.runtime || undefined,
      description: title.plot || '',
      contentRating: title.age ? `${title.age}+` : undefined,
      headers: {
        'Referer': `${baseUrl}/`
      }
    });
  }

  /**
   * 1. getHome: Returns categories for the dashboard
   * Rule: "Trending" is a reserved category promoted to the large Hero Carousel.
   * Other categories appear as horizontal thumbnail rows.
   * @param {(res: { success: boolean, data?: any, errorCode?: string, message?: string }) => void} cb
   */
  async function getHome(cb) {
    try {
      await ensureSession();
      const baseUrl = getBaseUrl();
      const homeUrl = `${baseUrl}/${state.lang}`;

      const res = await request(homeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });

      const html = await res.text();
      const inertia = extractInertiaData(html);

      if (!inertia || !inertia.props) {
        return cb({
          success: false,
          errorCode: 'NO_DATA',
          message: 'Impossibile estrarre i dati della home page da StreamingCommunity'
        });
      }

      const cdnUrl = inertia.props.cdn_url || `https://${getCdnHost()}`;
      const sliders = inertia.props.sliders || [];
      const categories = {};

      // 1. Reserved category "Trending" for Hero Carousel
      const trendingSlider = sliders.find(s => s.name === 'trending') || sliders[0];
      if (trendingSlider && Array.isArray(trendingSlider.titles)) {
        categories['Trending'] = trendingSlider.titles
          .filter(t => t.type === 'movie' || t.type === 'tv')
          .map(t => mapTitleToMultimediaItem(t, cdnUrl));
      }

      // 2. Top 10 Titles row
      const top10Slider = sliders.find(s => s.name === 'top10');
      if (top10Slider && Array.isArray(top10Slider.titles)) {
        categories['Top 10 Oggi'] = top10Slider.titles
          .filter(t => t.type === 'movie' || t.type === 'tv')
          .map(t => mapTitleToMultimediaItem(t, cdnUrl));
      }

      // 3. Latest releases row
      const latestSlider = sliders.find(s => s.name === 'latest');
      if (latestSlider && Array.isArray(latestSlider.titles)) {
        categories['Ultime Uscite'] = latestSlider.titles
          .filter(t => t.type === 'movie' || t.type === 'tv')
          .map(t => mapTitleToMultimediaItem(t, cdnUrl));
      }

      // 4. Any additional sliders present
      sliders.forEach(s => {
        if (s.name !== 'trending' && s.name !== 'top10' && s.name !== 'latest') {
          const catName = s.label || s.name;
          if (Array.isArray(s.titles) && s.titles.length > 0) {
            categories[catName] = s.titles
              .filter(t => t.type === 'movie' || t.type === 'tv')
              .map(t => mapTitleToMultimediaItem(t, cdnUrl));
          }
        }
      });

      return cb({
        success: true,
        data: categories
      });
    } catch (err) {
      console.error('getHome error:', err);
      return cb({
        success: false,
        errorCode: 'HOME_ERROR',
        message: err.message || String(err)
      });
    }
  }

  /**
   * 2. search: Handles user search queries
   * @param {string} query
   * @param {(res: { success: boolean, data?: any, errorCode?: string, message?: string }) => void} cb
   */
  async function search(query, cb) {
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
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
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
    } catch (err) {
      console.error('search error:', err);
      return cb({
        success: false,
        errorCode: 'SEARCH_ERROR',
        message: err.message || String(err)
      });
    }
  }

  /**
   * 3. load: Fetches full details for a specific media item
   * @param {string} url
   * @param {(res: { success: boolean, data?: any, errorCode?: string, message?: string }) => void} cb
   */
  async function load(url, cb) {
    try {
      await ensureSession();
      const baseUrl = getBaseUrl();

      // Normalize URL to contain language prefix (/it/)
      let targetUrl = url;
      if (!targetUrl.includes(`/${state.lang}/`)) {
        targetUrl = targetUrl.replace(new URL(targetUrl).origin, `${baseUrl}/${state.lang}`);
      }

      const res = await request(targetUrl, {
        headers: {
          'X-Inertia': 'true',
          'X-Inertia-Version': state.inertiaVersion || '',
          'X-Requested-With': 'XMLHttpRequest',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
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
      const cdnUrl = props.cdn_url || `https://${getCdnHost()}`;
      const isTv = title.type === 'tv' || title.type === 'series';

      // Genres
      const tags = Array.isArray(title.genres) ? title.genres.map(g => g.name) : [];

      // Cast
      const cast = Array.isArray(title.main_actors)
        ? title.main_actors.map(a => new SafeActor({ name: a.name }))
        : [];

      // Trailers
      const trailers = [];
      if (Array.isArray(title.trailers)) {
        title.trailers.forEach(t => {
          if (t.youtube_id) {
            trailers.push(new SafeTrailer({
              url: `https://www.youtube.com/watch?v=${t.youtube_id}`
            }));
          }
        });
      }

      // Recommendations
      let recommendations = [];
      if (Array.isArray(props.sliders) && props.sliders.length > 0 && Array.isArray(props.sliders[0].titles)) {
        recommendations = props.sliders[0].titles
          .filter(t => t.type === 'movie' || t.type === 'tv')
          .slice(0, 10)
          .map(t => mapTitleToMultimediaItem(t, cdnUrl));
      }

      // Poster & Banner
      let posterFilename = null;
      let bannerFilename = null;
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

      const year = title.release_date ? parseInt(title.release_date.split('-')[0], 10) : undefined;
      const score = title.score ? parseFloat(title.score) : undefined;

      // Handle Series Episodes
      const episodes = [];
      if (isTv && Array.isArray(title.seasons)) {
        // Collect episodes across all seasons
        for (const season of title.seasons) {
          let seasonEpisodes = [];

          if (props.loadedSeason && props.loadedSeason.id === season.id && Array.isArray(props.loadedSeason.episodes)) {
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
            } catch (err) {
              console.warn(`Failed loading season ${season.number}:`, err);
            }
          }

          seasonEpisodes.forEach(ep => {
            let epCover = null;
            if (Array.isArray(ep.images)) {
              const coverImg = ep.images.find(i => i.type === 'cover' || i.type === 'poster');
              epCover = coverImg?.filename;
            }

            const epPoster = epCover ? `${cdnUrl}/images/${epCover}` : posterUrl;
            const iframeStreamUrl = `${baseUrl}/${state.lang}/iframe/${title.id}?episode_id=${ep.id}&canPlayFHD=1`;

            episodes.push(new SafeEpisode({
              name: ep.name || `Episodio ${ep.number}`,
              url: iframeStreamUrl,
              season: season.number,
              episode: ep.number,
              description: ep.plot || '',
              posterUrl: epPoster,
              runtime: ep.duration || undefined,
              dubStatus: ep.dub_ita ? 'dubbed' : 'none',
              playbackPolicy: 'none'
            }));
          });
        }
      }

      // Movie Direct Stream URL
      const movieStreamUrl = !isTv ? `${baseUrl}/${state.lang}/iframe/${title.id}?canPlayFHD=1` : undefined;

      const mediaItem = new SafeMultimediaItem({
        title: title.name,
        url: targetUrl,
        posterUrl: posterUrl,
        bannerUrl: bannerUrl,
        type: isTv ? 'series' : 'movie',
        year: isNaN(year) ? undefined : year,
        score: isNaN(score) ? undefined : score,
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
        episodes: isTv ? episodes : undefined,
        streams: !isTv && movieStreamUrl ? [] : []
      });

      return cb({
        success: true,
        data: mediaItem
      });
    } catch (err) {
      console.error('load error:', err);
      return cb({
        success: false,
        errorCode: 'LOAD_ERROR',
        message: err.message || String(err)
      });
    }
  }

  /**
   * 4. loadStreams: Resolves playable video links
   * Ported from VixCloudExtractor & VixSrcExtractor
   * @param {string} url
   * @param {(res: { success: boolean, data?: any, errorCode?: string, message?: string }) => void} cb
   */
  async function loadStreams(url, cb) {
    try {
      const baseUrl = getBaseUrl();
      const streams = [];

      let iframeUrl = url;

      // If the incoming url is a /titles/... URL instead of an /iframe/... URL, resolve it first
      if (url.includes('/titles/')) {
        const idMatch = url.match(/\/titles\/(\d+)/);
        if (idMatch) {
          const titleId = idMatch[1];
          iframeUrl = `${baseUrl}/${state.lang}/iframe/${titleId}?canPlayFHD=1`;
        }
      }

      // 1. Fetch the StreamingCommunity iframe page
      const iframePageRes = await request(iframeUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
          'Referer': `${baseUrl}/${state.lang}/`
        }
      });

      const iframePageHtml = await iframePageRes.text();
      const srcMatch = iframePageHtml.match(/<iframe[^>]+src="([^"]+)"/) || iframePageHtml.match(/src="([^"]+)"/);

      if (srcMatch) {
        const embedUrl = srcMatch[1].replace(/&amp;/g, '&');

        // 2. Resolve VixCloud Extractor
        if (embedUrl.includes('vixcloud.co')) {
          try {
            const embedRes = await request(embedUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
                'Referer': iframeUrl,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
              }
            });

            const embedHtml = await embedRes.text();

            // Extract masterPlaylist params and url
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

              // Add Primary VixCloud Stream
              streams.push(new SafeStreamResult({
                url: masterPlaylistUrl,
                source: 'VixCloud (FHD Master HLS)',
                quality: canPlayFHD ? '1080p' : '720p',
                headers: {
                  'Referer': 'https://vixcloud.co/',
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
                  'Origin': 'https://vixcloud.co'
                }
              }));

              // Extract extra server streams from window.streams if available
              const streamsArrayMatch = embedHtml.match(/window\.streams\s*=\s*(\[[^\]]+\]);/);
              if (streamsArrayMatch) {
                try {
                  const extraServers = JSON.parse(streamsArrayMatch[1]);
                  extraServers.forEach(srv => {
                    if (srv.url && srv.name) {
                      const srvUrl = srv.url.replace(/\\\//g, '/');
                      const fullSrvUrl = srvUrl.includes('?') ? `${srvUrl}&${params}` : `${srvUrl}?${params}`;
                      streams.push(new SafeStreamResult({
                        url: fullSrvUrl,
                        source: `VixCloud (${srv.name})`,
                        quality: '720p',
                        headers: {
                          'Referer': 'https://vixcloud.co/',
                          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0'
                        }
                      }));
                    }
                  });
                } catch {
                  // Ignore JSON parse error on optional extra servers
                }
              }
            }
          } catch (vixErr) {
            console.error('VixCloud extraction error:', vixErr);
          }
        }
      }

      return cb({
        success: true,
        data: streams
      });
    } catch (err) {
      console.error('loadStreams error:', err);
      return cb({
        success: false,
        errorCode: 'STREAM_ERROR',
        message: err.message || String(err)
      });
    }
  }

  // Export functions to globalThis required by SkyStream plugin architecture
  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
