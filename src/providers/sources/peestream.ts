import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { Stream } from '@/providers/streams';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const movieBaseUrl = 'https://link.aether.cx/movie';
const showBaseUrl = 'https://lul.aether.cx/tv';

interface AetherResponse {
  id?: number | string;
  title?: string;
  stream?: string;
}

export async function peestreamScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  const tmdbId = ctx.media.tmdbId;

  if (!tmdbId) {
    throw new NotFoundError('TMDB ID is required for Aether scraper');
  }

  let targetUrl: string;
  if (ctx.media.type === 'movie') {
    targetUrl = `${movieBaseUrl}/${tmdbId}`;
  } else {
    targetUrl = `${showBaseUrl}/${tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;
  }

  // Include headers from the successful network capture
  const response = await ctx.proxiedFetcher<AetherResponse>(targetUrl, {
    method: 'GET',
    headers: {
      Accept: '*/*',
      Origin: 'https://aether.cx',
      Referer: 'https://aether.cx/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (!response || !response.stream) {
    throw new NotFoundError('No valid stream URL returned from Aether');
  }

  const streamUrl = response.stream;

  const commonStreamProps = {
    id: 'aether-primary',
    flags: [flags.CORS_ALLOWED],
    captions: [],
    headers: {
      Origin: 'https://aether.cx',
      Referer: 'https://aether.cx/',
    },
  };

  let streamResult: Stream;

  // Handles both .m3u8 playlist streams and direct worker/CDN video links
  if (streamUrl.includes('.m3u8')) {
    streamResult = {
      ...commonStreamProps,
      type: 'hls',
      playlist: streamUrl,
    };
  } else {
    streamResult = {
      ...commonStreamProps,
      type: 'file',
      qualities: {
        unknown: {
          type: 'mp4',
          url: streamUrl,
        },
      },
    };
  }

  return {
    embeds: [],
    stream: [streamResult],
  };
}

export const peestreamProvider = makeSourcerer({
  id: 'peestream',
  name: 'Thomas Shelby Sigma',
  rank: 95,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: peestreamScraper,
  scrapeShow: peestreamScraper,
});
