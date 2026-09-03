import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { Stream } from '@/providers/streams';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const baseUrl = 'https://new.vidnest.fun/videasy';

interface EncryptedResponse {
  data: string;
  encrypted: boolean;
}

interface DecryptedSource {
  file?: string;
  url?: string;
  link?: string;
  type?: string;
  label?: string;
  tracks?: Array<{
    file: string;
    label?: string;
    kind?: string;
  }>;
}

function decryptPayload(encryptedData: string): string {
  try {
    const shifted = encryptedData
      .split('')
      .map((char) => {
        const code = char.charCodeAt(0);
        if (code >= 65 && code <= 90) {
          return String.fromCharCode(((code - 65 + 13) % 26) + 65);
        }
        if (code >= 97 && code <= 122) {
          return String.fromCharCode(((code - 97 + 13) % 26) + 97);
        }
        return char;
      })
      .join('');

    return Buffer.from(shifted, 'base64').toString('utf-8');
  } catch {
    return encryptedData;
  }
}

export async function vidnestScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  const tmdbId = ctx.media.tmdbId;

  if (!tmdbId) {
    throw new NotFoundError('TMDB ID is required for Vidnest scraper');
  }

  let targetUrl: string;
  if (ctx.media.type === 'movie') {
    targetUrl = `${baseUrl}/movie/${tmdbId}`;
  } else {
    targetUrl = `${baseUrl}/tv/${tmdbId}/${ctx.media.season.number}/${ctx.media.episode.number}`;
  }

  const response = await ctx.proxiedFetcher<EncryptedResponse>(targetUrl, {
    method: 'GET',
    headers: {
      Accept: '*/*',
      Origin: 'https://vidnest.fun',
      Referer: 'https://vidnest.fun/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  });

  if (!response || !response.data) {
    throw new NotFoundError('No data returned from Vidnest API');
  }

  let rawJson = response.data;
  if (response.encrypted) {
    rawJson = decryptPayload(response.data);
  }

  let parsedData: DecryptedSource | DecryptedSource[];
  try {
    parsedData = JSON.parse(rawJson);
  } catch {
    throw new NotFoundError('Failed to parse decrypted stream payload');
  }

  const sources = Array.isArray(parsedData) ? parsedData : [parsedData];
  const primarySource = sources.find((s) => s.file || s.url || s.link);

  if (!primarySource) {
    throw new NotFoundError('No valid media stream URL found in payload');
  }

  const mediaUrl = primarySource.file || primarySource.url || primarySource.link || '';

  const captions = (primarySource.tracks || [])
    .filter((track) => track.kind === 'captions' || track.kind === 'subtitles')
    .map((track) => ({
      id: track.file,
      language: track.label || 'Unknown',
      type: track.file.endsWith('.vtt') ? ('vtt' as const) : ('srt' as const),
      url: track.file,
      hasCorsRestrictions: false,
    }));

  const commonStreamProps = {
    id: 'vidnest-primary',
    flags: [flags.CORS_ALLOWED],
    captions,
    headers: {
      Origin: 'https://vidnest.fun',
      Referer: 'https://vidnest.fun/',
    },
  };

  let streamResult: Stream;

  if (mediaUrl.includes('.m3u8')) {
    streamResult = {
      ...commonStreamProps,
      type: 'hls',
      playlist: mediaUrl,
    };
  } else {
    streamResult = {
      ...commonStreamProps,
      type: 'file',
      qualities: {
        unknown: {
          type: 'mp4',
          url: mediaUrl,
        },
      },
    };
  }

  return {
    embeds: [],
    stream: [streamResult],
  };
}

export const vidnestProvider = makeSourcerer({
  id: 'vidnest',
  name: 'Vidnest',
  rank: 85,
  disabled: false,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: vidnestScraper,
  scrapeShow: vidnestScraper,
});
