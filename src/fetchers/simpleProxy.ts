import { Fetcher, FetcherOptions } from './types';

const EXTENSION_PROXY_URL = 'https://extension.jenish.tech/fetch';

export function makeSimpleProxyFetcher(baseUrl?: string): Fetcher {
  return async <T = any>(url: string, ops: FetcherOptions): Promise<T> => {
    const headers = ops.headers || {};
    const referer = headers['Referer'] || headers['referer'] || '';

    // Route outbound calls through your Headless Chrome server
    let proxyUrl = `${EXTENSION_PROXY_URL}?url=${encodeURIComponent(url)}`;
    if (referer) {
      proxyUrl += `&referer=${encodeURIComponent(referer)}`;
    }

    const res = await fetch(proxyUrl, {
      method: ops.method || 'GET',
    });

    const contentType = res.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return (await res.json()) as T;
    }

    return (await res.text()) as unknown as T;
  };
}