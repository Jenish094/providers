import { makeSimpleProxyFetcher } from '@/fetchers/simpleProxy';
import { DefaultedFetcherOptions } from '@/fetchers/types';
import { Headers } from 'node-fetch';
import { AbortController } from 'abort-controller';
import { afterEach, describe, expect, it, vi } from 'vitest';

describe('makeSimpleProxyFetcher()', () => {
  const fetch = vi.fn();
  const fetcher = makeSimpleProxyFetcher('https://example.com/proxy', fetch);

  afterEach(() => {
    vi.clearAllMocks();
  });

function setResult(type: 'text' | 'json', value: any) {
  if (type === 'text')
    return fetch.mockResolvedValueOnce({
      headers: new Headers({
        'content-type': 'text/plain',
      }),
      status: 200,
      url: 'test123',
      text() {
        return Promise.resolve(value);
      },
    });
  if (type === 'json')
    return fetch.mockResolvedValueOnce({
      headers: new Headers({
        'content-type': 'application/json',
      }),
      status: 200,
      url: 'test123',
      json() {
        return Promise.resolve(value);
      },
    });
}

async function expectFetchCall(ops: {
  inputUrl: string;
  input: DefaultedFetcherOptions;
  outputUrl?: string;
  output: any;
  outputBody: any;
}) {
  const res = await fetcher(ops.inputUrl, ops.input);

  expect(res.body).toEqual(ops.outputBody);
  expect(Array.from(res.headers.entries())).toEqual(Array.from(new Headers().entries()));
  expect(res.statusCode).toEqual(200); // Changed from 204
  expect(res.finalUrl).toEqual('test123');

  expect(fetch).toHaveBeenCalledWith(
    ops.outputUrl ?? ops.inputUrl,
    expect.objectContaining({
      method: ops.output.method,
      headers: ops.output.headers,
      signal: expect.anything(),
    }),
  );

  vi.clearAllMocks();
}

  it('should pass options through', async () => {
    setResult('text', 'hello world');
    await expectFetchCall({
      inputUrl: 'https://google.com',
      input: {
        method: 'GET',
        query: {},
        readHeaders: [],
        headers: {
          'X-Hello': 'world',
        },
      },
      outputUrl: `https://example.com/proxy?destination=${encodeURIComponent('https://google.com/')}`,
      output: {
        method: 'GET',
        headers: {
          'X-Hello': 'world',
        },
        signal: new AbortController().signal,
      },
      outputBody: 'hello world',
    });

    setResult('text', 'hello world');
    await expectFetchCall({
      inputUrl: 'https://google.com',
      input: {
        method: 'GET',
        headers: {},
        readHeaders: [],
        query: {
          a: 'b',
        },
      },
      outputUrl: `https://example.com/proxy?destination=${encodeURIComponent('https://google.com/?a=b')}`,
      output: {
        method: 'GET',
        headers: {},
        signal: new AbortController().signal,
      },
      outputBody: 'hello world',
    });

    setResult('text', 'hello world');
    await expectFetchCall({
      inputUrl: 'https://google.com',
      input: {
        method: 'GET',
        query: {},
        readHeaders: [],
        headers: {},
      },
      outputUrl: `https://example.com/proxy?destination=${encodeURIComponent('https://google.com/')}`,
      output: {
        method: 'GET',
        headers: {},
        signal: new AbortController().signal,
      },
      outputBody: 'hello world',
    });
  });

  it('should parse response correctly', async () => {
    setResult('text', 'hello world');
    await expectFetchCall({
      inputUrl: 'https://google.com/',
      input: {
        method: 'POST',
        query: {},
        readHeaders: [],
        headers: {},
      },
      outputUrl: `https://example.com/proxy?destination=${encodeURIComponent('https://google.com/')}`,
      output: {
        method: 'POST',
        headers: {},
        signal: new AbortController().signal,
      },
      outputBody: 'hello world',
    });

    setResult('json', { hello: 42 });
    await expectFetchCall({
      inputUrl: 'https://google.com/',
      input: {
        method: 'POST',
        query: {},
        readHeaders: [],
        headers: {},
      },
      outputUrl: `https://example.com/proxy?destination=${encodeURIComponent('https://google.com/')}`,
      output: {
        method: 'POST',
        headers: {},
        signal: new AbortController().signal,
      },
      outputBody: { hello: 42 },
    });
  });
});