// import { SourcererOutput, makeSourcerer } from '@/providers/base';
// import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';
// import { NotFoundError } from '@/utils/errors';

// async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
//   const baseApiUrl = 'https://primesrc.me/embed/';

//   let serverData;
//   try {
//     if (ctx.media.type === 'movie') {
//       const url = `${baseApiUrl}s?tmdb=${ctx.media.tmdbId}`;
//       serverData = await fetch(url);
//     } else {
//       const url = `${baseApiUrl}s?tmdb=${ctx.media.tmdbId}&season=${ctx.media.season.number}&episode=${ctx.media.episode.number}`;
//       serverData = await fetch(url);
//     }
//   } catch (error) {
//     return { embeds: [] };
//   }

//   let data;
//   try {
//     data = await serverData.json();
//   } catch (error) {
//     return { embeds: [] };
//   }

//   const nameToEmbedId: Record<string, string> = {
//     Filelions: 'filelions',
//     Dood: 'dood',
//     Streamwish: 'streamwish-english',
//     Filemoon: 'filemoon',
//   };

//   if (!data.servers || !Array.isArray(data.servers)) {
//     return { embeds: [] };
//   }

//   const embeds = [];
//   for (const server of data.servers) {
//     if (!server.name || !server.key) {
//       continue;
//     }
//     if (nameToEmbedId[server.name]) {
//       try {
//         const linkData = await fetch(`${baseApiUrl}l?key=${server.key}`);
//         if (linkData.status !== 200) {
//           continue;
//         }
//         const linkJson = await linkData.json();
//         if (linkJson.link) {
//           const embed = {
//             embedId: nameToEmbedId[server.name],
//             url: linkJson.link,
//           };
//           embeds.push(embed);
//         }
//       } catch (error) {
//         throw new NotFoundError(`Error: ${error}`);
//       }
//     }
//   }

//   return { embeds };
// }

// export const primesrcScraper = makeSourcerer({
//   id: 'primesrc',
//   name: 'PrimeSrc',
//   rank: 168,
//   disabled: false,
//   flags: [],
//   scrapeMovie: comboScraper,
//   scrapeShow: comboScraper,
// });

import { SourcererOutput, makeSourcerer } from '@/providers/base';
import { MovieScrapeContext, ShowScrapeContext } from '@/utils/context';

async function comboScraper(ctx: ShowScrapeContext | MovieScrapeContext): Promise<SourcererOutput> {
  const baseApiUrl = 'https://primesrc.me/embed/';

  const targetUrl =
    ctx.media.type === 'movie'
      ? `${baseApiUrl}s?tmdb=${ctx.media.tmdbId}`
      : `${baseApiUrl}s?tmdb=${ctx.media.tmdbId}&season=${ctx.media.season.number}&episode=${ctx.media.episode.number}`;

  let data;
  try {
    const serverData = await ctx.fetcher<any>(targetUrl, {
      headers: {
        Referer: 'https://primesrc.me/',
      },
    });

    data = typeof serverData === 'string' ? JSON.parse(serverData) : serverData;
  } catch (error) {
    console.error('[PrimeSrc] Failed to fetch server list:', error);
    return { embeds: [] };
  }

  const nameToEmbedId: Record<string, string> = {
    Filelions: 'filelions',
    Dood: 'dood',
    Streamwish: 'streamwish-english',
    Filemoon: 'filemoon',
  };

  if (!data?.servers || !Array.isArray(data.servers)) {
    return { embeds: [] };
  }

  const embeds = [];

  for (const server of data.servers) {
    if (!server.name || !server.key) continue;

    const embedId = nameToEmbedId[server.name];
    if (!embedId) continue;

    try {
      const linkData = await ctx.fetcher<any>(`${baseApiUrl}l?key=${server.key}`, {
        headers: {
          Referer: 'https://primesrc.me/',
        },
      });

      const linkJson = typeof linkData === 'string' ? JSON.parse(linkData) : linkData;

      if (linkJson?.link) {
        const cleanUrl = linkJson.link.replace(/^http:/, 'https:');

        embeds.push({
          embedId,
          url: cleanUrl,
        });
      }
    } catch (error) {
      console.error(`[PrimeSrc] Failed resolving link key ${server.key}:`, error);
    }
  }

  return { embeds };
}

export const primesrcScraper = makeSourcerer({
  id: 'primesrc',
  name: 'PrimeSrc',
  rank: 168,
  disabled: false,
  flags: [],
  scrapeMovie: comboScraper,
  scrapeShow: comboScraper,
});
