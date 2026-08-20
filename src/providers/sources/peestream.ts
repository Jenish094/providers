import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { Caption } from '@/providers/captions';
import { Stream } from '@/providers/streams';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const providerUrl = 'https://providers.peestream.in/scrape';

interface StreamPayload {
  type: 'hls' | 'mp4';
  playlist: string;
  id: string;
  flags?: string[];
  captions?: Array<{
    id?: string;
    language: string;
    hasCors?: boolean;
    hasCorsRestrictions?: boolean;
    type?: string;
    url: string;
  }>;
  headers?: Record<string, string>;
}

export async function peestreamScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  // Construct URL parameters
  const queryParams = new URLSearchParams({
    type: ctx.media.type,
    title: ctx.media.title,
    ...(ctx.media.tmdbId && { tmdbId: ctx.media.tmdbId.toString() }),
    ...(ctx.media.imdbId && { imdbId: ctx.media.imdbId }),
  });

  if (ctx.media.type === 'movie') {
    if (ctx.media.releaseYear) {
      queryParams.set('releaseYear', ctx.media.releaseYear.toString());
    }
  } else {
    queryParams.set('season', ctx.media.season.number.toString());
    queryParams.set('episode', ctx.media.episode.number.toString());
  }

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
  const captions: Caption[] = (streamData.captions || []).map((caption) => {
    const type = (caption.type ?? 'srt').toLowerCase();
    return {
      id: caption.id || caption.language,
      language: caption.language,
      type: type === 'vtt' ? 'vtt' : 'srt',
      url: caption.url,
      hasCorsRestrictions: caption.hasCorsRestrictions ?? caption.hasCors ?? true,
    };
  });

  const stream: Stream[] =
    streamData.type === 'mp4'
      ? [
          {
            id: streamData.id || 'primary-file',
            type: 'file',
            qualities: {
              unknown: { type: 'mp4', url: streamData.playlist },
            },
            flags: [flags.CORS_ALLOWED],
            captions,
            headers: streamData.headers || {},
          },
        ]
      : [
          {
            id: streamData.id || 'primary-hls',
            type: 'hls',
            playlist: streamData.playlist,
            flags: [flags.CORS_ALLOWED],
            captions,
            headers: streamData.headers || {},
          },
        ];

  return {
    embeds: [],
    stream,
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
