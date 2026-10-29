import { flags } from '@/entrypoint/utils/targets';
import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const CINECAT_CDN = 'https://zcdn1.6azt0hwr-cf9.workers.dev';

type CinecatResponse = {
  ready?: boolean;
  url?: string;
  rb?: string;
};

async function universalScraper(ctx: MovieScrapeContext | ShowScrapeContext): Promise<SourcererOutput> {
  const query: Record<string, string | number> = {
    tmdb: ctx.media.tmdbId,
    type: ctx.media.type === 'movie' ? 'movie' : 'tv',
  };

  if (ctx.media.type === 'show') {
    query.season = ctx.media.season.number;
    query.episode = ctx.media.episode.number;
  }

  ctx.progress(25);

  const response = await ctx.proxiedFetcher<CinecatResponse>('/cdn', {
    baseUrl: CINECAT_CDN,
    query,
    headers: {
      Referer: 'https://cinecat.eu/',
      Origin: 'https://cinecat.eu',
    },
  });

  if (!response?.ready || !response.url || !response.rb) {
    throw new NotFoundError('CineCat has no source for this media');
  }

  let playlist: URL;
  try {
    playlist = new URL(response.url);
  } catch {
    throw new NotFoundError('CineCat returned an invalid playlist URL');
  }

  if (playlist.origin !== CINECAT_CDN || !playlist.pathname.startsWith('/play/')) {
    throw new NotFoundError('CineCat returned an unsupported playlist URL');
  }

  playlist.searchParams.set('_rb', response.rb);

  ctx.progress(90);

  return {
    embeds: [],
    stream: [
      {
        id: 'primary',
        type: 'hls',
        playlist: playlist.toString(),
        flags: [flags.CORS_ALLOWED],
        captions: [],
        headers: {
          Referer: 'https://cinecat.eu/',
          Origin: 'https://cinecat.eu',
        },
      },
    ],
  };
}

export const cinecatScraper = makeSourcerer({
  id: 'cinecat',
  name: 'Sigma',
  rank: 320,
  flags: [flags.CORS_ALLOWED],
  scrapeMovie: universalScraper,
  scrapeShow: universalScraper,
});
