import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
import { NotFoundError } from '@/utils/errors';

const API_BASE = 'https://enc-dec.app/api';
const VIDLINK_BASE = 'https://vidlink.pro/api/b';

const headers = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/137.0.0.0 Safari/537.36',
  Connection: 'keep-alive',
  Referer: 'https://vidlink.pro/',
  Origin: 'https://vidlink.pro',
};

async function encryptTmdbId(ctx: MovieScrapeContext | ShowScrapeContext, tmdbId: string): Promise<string> {
  const response = await ctx.proxiedFetcher<{ result: string }>(`${API_BASE}/enc-vidlink`, {
    method: 'GET',
    query: { text: tmdbId },
  });

  if (!response?.result) {
    throw new NotFoundError('Failed to encrypt TMDB ID');
  }

  return response.result;
}

async function comboScraper(ctx) {
  try {
    const { tmdbId } = ctx.media;

    const encryptedId = await encryptTmdbId(ctx, tmdbId.toString());

    try {
      const apiUrl =
        ctx.media.type === 'movie'
          ? `${VIDLINK_BASE}/movie/${encryptedId}`
          : `${VIDLINK_BASE}/tv/${encryptedId}/${ctx.media.season.number}/${ctx.media.episode.number}`;

      const vidlinkRaw = await ctx.proxiedFetcher(apiUrl, { headers });

      const data = JSON.parse(vidlinkRaw);

      if (data?.stream) {
        return {
          embeds: [],
          stream: [/* your existing logic */],
        };
      }
    } catch {}

    return {
      embeds: [
        {
          id: "vidlink",
          url: `https://vidlink.pro/embed/${encryptedId}`,
        }
      ]
    };

  } catch (err) {
    return {
      embeds: [],
      stream: [],
    };
  }
}

  // const flags = stream.flags || [];
  // if (vidlinkData.flags) {
  //   flags.push(...vidlinkData.flags);
  // }

  ctx.progress(90);

  return {
    embeds: [],
    stream: [
      {
      id: "vidlink",
      url: `https://vidlink.pro/embed/${encryptedId}`,
      },
    ],
  };
}

export const vidlinkScraper = makeSourcerer({
  id: 'vidlink',
  name: 'VidLink 🔥',
  rank: 310,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
