import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';
import { getTurnstileToken } from '@/utils/turnstile';

import { Caption, labelToLanguageCode } from '../captions';

const getUserToken = (): string | null => {
  try {
    if (typeof window === 'undefined') return null;
    const prefData = window.localStorage.getItem('__MW::preferences');
    if (!prefData) return null;
    const parsedAuth = JSON.parse(prefData);
    return parsedAuth?.state?.febboxKey || null;
  } catch (e) {
    console.warn('Unable to access localStorage or parse auth data:', e);
    return null;
  }
};

const BASE_URL = 'https://fed.jenish.tech';

interface StreamEntry {
  type: 'hls' | 'mp4';
  url: string;
}

interface StreamData {
  streams: Record<string, StreamEntry | string>;
  subtitles: Record<string, any>;
  error?: string;
  name?: string;
  size?: string;
}

async function processScrape(
  ctx: ShowScrapeContext | MovieScrapeContext,
  mediaType: 'movie' | 'show',
): Promise<SourcererOutput> {
  const userToken = getUserToken();
  if (!userToken) throw new NotFoundError('Requires a user token!');

  // Get Turnstile token for verification
  let turnstileToken: string;
  try {
    turnstileToken = await getTurnstileToken('0x4AAAAAAEA2zgdnfGvPzBeW');
  } catch (error) {
    // eslint-disable-next-line no-alert
    alert('FED API Turnstile verification failed. Please refresh the page and try again.');
    throw new NotFoundError(`Turnstile verification failed: ${error}`);
  }

  ctx.progress(20);

  const searchType = mediaType === 'show' ? 'tv' : 'movie';
  const searchUrl = `${BASE_URL}/search/${searchType}?title=${encodeURIComponent(ctx.media.title)}&turnstile=${encodeURIComponent(turnstileToken)}`;

  const searchRes = await fetch(searchUrl, { credentials: 'omit' });
  if (!searchRes.ok) throw new NotFoundError('Search request failed');
  const searchResult = await searchRes.json();

  const matchedMedia = searchResult?.results?.find((item: any) => {
    const itemYear = item.year || item.release_date?.split('-')[0];
    return parseInt(itemYear, 10) === ctx.media.releaseYear;
  });

  if (!matchedMedia?.id) throw new NotFoundError('Media entry not found in repo registry');

  ctx.progress(50);

  let streamUrl =
    mediaType === 'show'
      ? `${BASE_URL}/api/show/${matchedMedia.id}?season=${(ctx as ShowScrapeContext).media.season.number}&episode=${(ctx as ShowScrapeContext).media.episode.number}`
      : `${BASE_URL}/api/movie/${matchedMedia.id}`;

  streamUrl += `&ui=${encodeURIComponent(userToken)}&turnstile=${encodeURIComponent(turnstileToken)}`;

  const res = await fetch(streamUrl, { credentials: 'omit' });
  if (!res.ok) throw new NotFoundError('API request failed');
  const data: StreamData = await res.json();

  if (data?.error && data.error.endsWith('not found in database')) {
    throw new NotFoundError('No stream found');
  }
  if (!data) throw new NotFoundError('No response from API');

  ctx.progress(70);

  // Process streams data
  type StreamInfo = { url: string; type: 'hls' | 'mp4' };
  const streams = Object.entries(data.streams).reduce((acc: Record<string, StreamInfo>, [quality, entry]) => {
    const url = typeof entry === 'string' ? entry : entry.url;
    const type = typeof entry === 'string' ? 'mp4' : entry.type;

    let qualityKey: number;
    if (quality === 'ORG') {
      const urlPath = url.split('?')[0];
      if (urlPath.toLowerCase().includes('.mp4') || type === 'hls') {
        acc.unknown = { url, type };
      }
      return acc;
    }
    if (quality === '4K') {
      qualityKey = 2160;
    } else {
      qualityKey = parseInt(quality.replace('P', ''), 10);
    }
    if (Number.isNaN(qualityKey) || acc[qualityKey]) return acc;
    acc[qualityKey] = { url, type };
    return acc;
  }, {});

  // Process captions data
  const captions: Caption[] = [];
  if (data.subtitles) {
    for (const [langKey, subtitleData] of Object.entries(data.subtitles)) {
      // Extract language name from key
      const languageKeyPart = langKey.split('_')[0];
      const languageName = languageKeyPart.charAt(0).toUpperCase() + languageKeyPart.slice(1);
      const languageCode = labelToLanguageCode(languageName)?.toLowerCase() ?? 'unknown';

      // Check if the subtitle data is in the new format (has subtitle_link)
      if (subtitleData.subtitle_link) {
        const url = subtitleData.subtitle_link;
        const isVtt = url.toLowerCase().endsWith('.vtt');
        captions.push({
          type: isVtt ? 'vtt' : 'srt',
          id: url,
          url,
          language: languageCode,
          hasCorsRestrictions: false,
        });
      }
    }
  }

  ctx.progress(90);

  // If any stream is HLS, return as HLS playlist using best quality
  const hlsStream = streams[2160] ?? streams[1080] ?? streams[720] ?? streams[480] ?? streams[360] ?? streams.unknown;
  if (hlsStream?.type === 'hls') {
    return {
      embeds: [],
      stream: [
        {
          id: 'primary',
          captions,
          playlist: hlsStream.url,
          type: 'hls',
          flags: [flags.CORS_ALLOWED],
        },
      ],
    };
  }

  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        captions,
        qualities: {
          ...(streams[2160] && { '4k': { type: 'mp4', url: streams[2160].url } }),
          ...(streams[1080] && { 1080: { type: 'mp4', url: streams[1080].url } }),
          ...(streams[720] && { 720: { type: 'mp4', url: streams[720].url } }),
          ...(streams[480] && { 480: { type: 'mp4', url: streams[480].url } }),
          ...(streams[360] && { 360: { type: 'mp4', url: streams[360].url } }),
          ...(streams.unknown && { unknown: { type: 'mp4', url: streams.unknown.url } }),
        },
        type: 'file',
        flags: [flags.CORS_ALLOWED],
      },
    ],
  };
}

async function scrapeMovie(ctx: MovieScrapeContext): Promise<SourcererOutput> {
  return processScrape(ctx, 'movie');
}

async function scrapeShow(ctx: ShowScrapeContext): Promise<SourcererOutput> {
  return processScrape(ctx, 'show');
}

export const FedAPIScraper = makeSourcerer({
  id: 'fedapi',
  name: 'FED API (4K) 🔥',
  rank: 300,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie,
  scrapeShow,
});
