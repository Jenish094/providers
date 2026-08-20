import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const providerUrl = 'https://providers.peestream.in/scrape';

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
  
  // Construct URL parameters
  const queryParams = new URLSearchParams({
    type: ctx.media.type,
    title: ctx.media.title,
    ...(ctx.media.tmdbId && { tmdbId: ctx.media.tmdbId.toString() }),
    ...(ctx.media.imdbId && { imdbId: ctx.media.imdbId }),
    ...(isMovie && ctx.media.releaseYear && { releaseYear: ctx.media.releaseYear.toString() }),
    ...(!isMovie && {
      season: ctx.media.season.number.toString(),
      episode: ctx.media.episode.number.toString(),
    }),
  });

  const requestUrl = `${providerUrl}?${queryParams.toString()}`;

  // Fetch SSE response body
  const res = await ctx.proxiedFetcher.full(requestUrl, {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
    },
  });

  const bodyText = res.body;
  let streamData: StreamPayload | null = null;

  // Parse Server-Sent Events line by line
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
        // Skip malformed JSON events
      }
    }
  }

  if (!streamData || !streamData.playlist) {
    throw new NotFoundError('No stream data found from provider');
  }

  // Parse captions if present
  const captions = (streamData.captions || []).map((caption) => ({
    id: caption.id || caption.language,
    language: caption.language,
    type: caption.type === 'vtt' ? 'vtt' : 'srt',
    url: caption.url,
    hasCors: caption.hasCors ?? true,
  }));

  // Return direct stream output instead of embeds
  return {
    embeds: [],
    stream: [
      {
        id: streamData.id || 'primary-hls',
        playlist: streamData.playlist,
        type: streamData.type || 'hls',
        flags: streamData.flags ? [flags.CORS_ALLOWED] : [flags.CORS_ALLOWED],
        captions,
        headers: streamData.headers || {},
      },
    ],
  };
}

export const peestreamProvider = makeSourcerer({
  id: 'peestream',
  name: 'PeeStream',
  rank: 1,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: peestreamScraper,
  scrapeShow: peestreamScraper,
});