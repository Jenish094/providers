import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const baseUrl = 'https://providers.peestream.in';

interface StreamPayload {
  type: 'hls' | 'mp4';
  playlist: string;
  id: string;
  flags?: string[];
  captions?: Array<{
    id: string;
    language: string;
    hasCors: boolean;
    type: string;
    url: string;
  }>;
  headers?: Record<string, string>;
}

async function peestreamScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  const isMovie = ctx.media.type === 'movie';

  // Choose endpoint path based on media type
  const endpoint = isMovie ? `${baseUrl}/scrape` : `${baseUrl}/moovie-api/scrape`;

  // Build query parameters dynamically based on media type
  const queryParams = new URLSearchParams();

  if (isMovie) {
    queryParams.set('type', 'movie');
    queryParams.set('title', ctx.media.title);
    if (ctx.media.releaseYear) queryParams.set('releaseYear', ctx.media.releaseYear.toString());
    if (ctx.media.imdbId) queryParams.set('imdbId', ctx.media.imdbId);
    if (ctx.media.tmdbId) queryParams.set('tmdbId', ctx.media.tmdbId.toString());
  } else {
    queryParams.set('type', 'tv');
    queryParams.set('title', ctx.media.title);
    if (ctx.media.releaseYear) queryParams.set('releaseYear', ctx.media.releaseYear.toString());
    if (ctx.media.imdbId) queryParams.set('imdbId', ctx.media.imdbId);
    if (ctx.media.tmdbId) queryParams.set('tmdbId', ctx.media.tmdbId.toString());

    // TV Specific Parameters
    queryParams.set('episodeNumber', ctx.media.episode.number.toString());
    queryParams.set('seasonNumber', ctx.media.season.number.toString());

    if (ctx.media.episode.tmdbId) {
      queryParams.set('episodeTmdbId', ctx.media.episode.tmdbId.toString());
    }
    if (ctx.media.season.tmdbId) {
      queryParams.set('seasonTmdbId', ctx.media.season.tmdbId.toString());
    }
  }

  const requestUrl = `${endpoint}?${queryParams.toString()}`;

  // Execute GET request expecting Server-Sent Events
  const res = await ctx.proxiedFetcher.full(requestUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
    },
  });

  const bodyText = res.body;
  let streamData: StreamPayload | null = null;

  // Split SSE response blocks and parse event data
  const events = bodyText.split('\n\n');
  for (const block of events) {
    const lines = block.split('\n');
    let eventType = '';
    let dataStr = '';

    for (const line of lines) {
      if (line.startsWith('event:')) {
        eventType = line.replace('event:', '').trim();
      } else if (line.startsWith('data:')) {
        dataStr = line.replace('data:', '').trim();
      }
    }

    if (eventType === 'completed' && dataStr) {
      try {
        const parsed = JSON.parse(dataStr);
        if (parsed.stream) {
          streamData = parsed.stream;
          break;
        }
      } catch {
        // Ignore unparseable frames
      }
    }
  }

  if (!streamData || !streamData.playlist) {
    throw new NotFoundError('No stream available for this title');
  }

  // Format captions if available
  const captions = (streamData.captions || []).map((caption) => ({
    id: caption.id || caption.language,
    language: caption.language,
    type: caption.type === 'vtt' ? 'vtt' : 'srt',
    url: caption.url,
    hasCors: caption.hasCors ?? true,
  }));

  return {
    embeds: [],
    stream: [
      {
        id: streamData.id || 'primary-hls',
        playlist: streamData.playlist,
        type: streamData.type || 'hls',
        flags: [flags.CORS_ALLOWED],
        captions,
        headers: streamData.headers || {},
      },
    ],
  };
}

export const peestreamProvider = makeSourcerer({
  id: 'peestream',
  name: 'PeeStream 🔥',
  rank: 90,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: peestreamScraper,
  scrapeShow: peestreamScraper,
});
