import * as FormData from 'form-data';

declare const flags: {
    readonly CORS_ALLOWED: "cors-allowed";
    readonly IP_LOCKED: "ip-locked";
    readonly CF_BLOCKED: "cf-blocked";
    readonly PROXY_BLOCKED: "proxy-blocked";
    readonly MKV_REQUIRED: "mkv-required";
};
type Flags = (typeof flags)[keyof typeof flags];
declare const targets: {
    readonly BROWSER: "browser";
    readonly BROWSER_EXTENSION: "browser-extension";
    readonly NATIVE: "native";
    readonly ANY: "any";
};
type Targets = (typeof targets)[keyof typeof targets];
type FeatureMap = {
    requires: Flags[];
    disallowed: Flags[];
};

declare const captionTypes: {
    srt: string;
    vtt: string;
};
type CaptionType = keyof typeof captionTypes;
type Caption = {
    type: CaptionType;
    id: string;
    opensubtitles?: boolean;
    url: string;
    hasCorsRestrictions: boolean;
    language: string;
    flagUrl?: string;
    display?: string;
    media?: string;
    isHearingImpaired?: boolean;
    source?: string;
    encoding?: string;
};
declare function labelToLanguageCode(label: string): string | null;

type StreamFile = {
    type: 'mp4';
    url: string;
};
type Qualities = 'unknown' | '360' | '480' | '720' | '1080' | '4k';
type ThumbnailTrack = {
    type: 'vtt';
    url: string;
};
type StreamCommon = {
    id: string;
    flags: Flags[];
    captions: Caption[];
    thumbnailTrack?: ThumbnailTrack;
    headers?: Record<string, string>;
    preferredHeaders?: Record<string, string>;
    skipValidation?: boolean;
};
type FileBasedStream = StreamCommon & {
    type: 'file';
    qualities: Partial<Record<Qualities, StreamFile>>;
};
type HlsBasedStream = StreamCommon & {
    type: 'hls';
    playlist: string;
    proxyDepth?: 0 | 1 | 2;
};
type Stream = FileBasedStream | HlsBasedStream;

type CommonMedia = {
    title: string;
    releaseYear: number;
    imdbId?: string;
    tmdbId: string;
};
type MediaTypes = 'show' | 'movie';
type ShowMedia = CommonMedia & {
    type: 'show';
    episode: {
        number: number;
        tmdbId: string;
    };
    season: {
        number: number;
        tmdbId: string;
        title: string;
        episodeCount?: number;
    };
};
type MovieMedia = CommonMedia & {
    type: 'movie';
};
type ScrapeMedia = ShowMedia | MovieMedia;

type FetcherOptions = {
    baseUrl?: string;
    headers?: Record<string, string>;
    query?: Record<string, string>;
    method?: 'HEAD' | 'GET' | 'POST';
    readHeaders?: string[];
    body?: Record<string, any> | string | FormData | URLSearchParams;
    credentials?: 'include' | 'same-origin' | 'omit';
};
type DefaultedFetcherOptions = {
    baseUrl?: string;
    body?: Record<string, any> | string | FormData;
    headers: Record<string, string>;
    query: Record<string, string>;
    readHeaders: string[];
    method: 'HEAD' | 'GET' | 'POST';
    credentials?: 'include' | 'same-origin' | 'omit';
};
type FetcherResponse<T = any> = {
    statusCode: number;
    headers: Headers;
    finalUrl: string;
    body: T;
};
type Fetcher = {
    <T = any>(url: string, ops: DefaultedFetcherOptions): Promise<FetcherResponse<T>>;
};
type UseableFetcher = {
    <T = any>(url: string, ops?: FetcherOptions): Promise<T>;
    full: <T = any>(url: string, ops?: FetcherOptions) => Promise<FetcherResponse<T>>;
};

type ScrapeContext = {
    proxiedFetcher: UseableFetcher;
    fetcher: UseableFetcher;
    progress(val: number): void;
    features: FeatureMap;
};
type EmbedInput = {
    url: string;
};
type EmbedScrapeContext = EmbedInput & ScrapeContext;
type MovieScrapeContext = ScrapeContext & {
    media: MovieMedia;
};
type ShowScrapeContext = ScrapeContext & {
    media: ShowMedia;
};

type MediaScraperTypes = 'show' | 'movie';
type SourcererEmbed = {
    embedId: string;
    url: string;
};
type SourcererOutput = {
    embeds: SourcererEmbed[];
    stream?: Stream[];
};
type SourcererOptions = {
    id: string;
    name: string;
    rank: number;
    disabled?: boolean;
    externalSource?: boolean;
    flags: Flags[];
    scrapeMovie?: (input: MovieScrapeContext) => Promise<SourcererOutput>;
    scrapeShow?: (input: ShowScrapeContext) => Promise<SourcererOutput>;
};
type Sourcerer = SourcererOptions & {
    type: 'source';
    disabled: boolean;
    externalSource: boolean;
    mediaTypes: MediaScraperTypes[];
};
type EmbedOutput = {
    stream: Stream[];
};
type EmbedOptions = {
    id: string;
    name: string;
    rank: number;
    disabled?: boolean;
    flags: Flags[];
    scrape: (input: EmbedScrapeContext) => Promise<EmbedOutput>;
};
type Embed = EmbedOptions & {
    type: 'embed';
    disabled: boolean;
    mediaTypes: undefined;
};

type UpdateEventStatus = 'success' | 'failure' | 'notfound' | 'pending';
type UpdateEvent = {
    id: string;
    percentage: number;
    status: UpdateEventStatus;
    error?: unknown;
    reason?: string;
};
type InitEvent = {
    sourceIds: string[];
};
type DiscoverEmbedsEvent = {
    sourceId: string;
    embeds: Array<{
        id: string;
        embedScraperId: string;
    }>;
};
type FullScraperEvents = {
    update?: (evt: UpdateEvent) => void;
    init?: (evt: InitEvent) => void;
    discoverEmbeds?: (evt: DiscoverEmbedsEvent) => void;
    start?: (id: string) => void;
};
type IndividualScraperEvents = {
    update?: (evt: UpdateEvent) => void;
};

type RunOutput = {
    sourceId: string;
    embedId?: string;
    stream: Stream;
};

type MetaOutput = {
    type: 'embed' | 'source';
    id: string;
    rank: number;
    name: string;
    flags?: string[];
    mediaTypes?: Array<MediaTypes>;
};

interface RunnerOptions {
    sourceOrder?: string[];
    embedOrder?: string[];
    events?: FullScraperEvents;
    media: ScrapeMedia;
    disableOpensubtitles?: boolean;
}
interface SourceRunnerOptions {
    events?: IndividualScraperEvents;
    media: ScrapeMedia;
    id: string;
    disableOpensubtitles?: boolean;
}
interface EmbedRunnerOptions {
    events?: IndividualScraperEvents;
    url: string;
    id: string;
    disableOpensubtitles?: boolean;
}
interface ProviderControls {
    runAll(runnerOps: RunnerOptions): Promise<RunOutput | null>;
    runSourceScraper(runnerOps: SourceRunnerOptions): Promise<SourcererOutput>;
    runEmbedScraper(runnerOps: EmbedRunnerOptions): Promise<EmbedOutput>;
    getMetadata(id: string): MetaOutput | null;
    listSources(): MetaOutput[];
    listEmbeds(): MetaOutput[];
}

type ProviderBuilder = {
    setTarget(target: Targets): ProviderBuilder;
    setFetcher(fetcher: Fetcher): ProviderBuilder;
    setProxiedFetcher(fetcher: Fetcher): ProviderBuilder;
    addSource(scraper: Sourcerer): ProviderBuilder;
    addSource(name: string): ProviderBuilder;
    addEmbed(scraper: Embed): ProviderBuilder;
    addEmbed(name: string): ProviderBuilder;
    addBuiltinProviders(): ProviderBuilder;
    enableConsistentIpForRequests(): ProviderBuilder;
    build(): ProviderControls;
};
declare function buildProviders(): ProviderBuilder;

interface ProviderMakerOptions {
    fetcher: Fetcher;
    proxiedFetcher?: Fetcher;
    target: Targets;
    consistentIpForRequests?: boolean;
    externalSources?: 'all' | string[];
    proxyStreams?: boolean;
}
declare function makeProviders(ops: ProviderMakerOptions): ProviderControls;

declare class NotFoundError extends Error {
    constructor(reason?: string);
}

declare function getBuiltinSources(): Sourcerer[];
declare function getBuiltinExternalSources(): Sourcerer[];
declare function getBuiltinEmbeds(): Embed[];

/**
 * This file is a very relaxed definition of the fetch api
 * Only containing what we need for it to function.
 */
type FetchOps = {
    headers: Record<string, string>;
    method: string;
    body: any;
    credentials?: 'include' | 'same-origin' | 'omit';
    signal?: any;
};
type FetchHeaders = {
    get(key: string): string | null;
    set(key: string, value: string): void;
};
type FetchReply = {
    text(): Promise<string>;
    json(): Promise<any>;
    arrayBuffer(): Promise<ArrayBuffer>;
    extraHeaders?: FetchHeaders;
    extraUrl?: string;
    headers: FetchHeaders;
    url: string;
    status: number;
};
type FetchLike = (url: string, ops?: FetchOps | undefined) => Promise<FetchReply>;

declare function makeStandardFetcher(f: FetchLike): Fetcher;

declare function makeSimpleProxyFetcher(proxyUrl: string, f: FetchLike): Fetcher;

/**
 * Set a custom M3U8 proxy URL to use for all M3U8 proxy requests
 * @param proxyUrl - The base URL of the M3U8 proxy
 */
declare function setM3U8ProxyUrl(proxyUrl: string): void;
/**
 * Get the currently configured M3U8 proxy URL
 * @returns The configured M3U8 proxy URL
 */
declare function getM3U8ProxyUrl(): string;
/**
 * Creates a proxied M3U8 URL using the configured M3U8 proxy
 * @param url - The original M3U8 URL to proxy
 * @param features - Feature map to determine if local proxy (extension/native) is available
 * @param headers - Headers to include with the request
 * @returns The proxied M3U8 URL or original URL if local proxy is available
 */
declare function createM3U8ProxyUrl(url: string, features?: FeatureMap, headers?: Record<string, string>): string;
/**
 * Updates an existing M3U8 proxy URL to use the currently configured proxy
 * @param url - The M3U8 proxy URL to update
 * @returns The updated M3U8 proxy URL
 */
declare function updateM3U8ProxyUrl(url: string): string;

export { type DefaultedFetcherOptions, type EmbedOptions, type EmbedOutput, type EmbedRunnerOptions, type EmbedScrapeContext, type Fetcher, type FetcherOptions, type FetcherResponse, type FileBasedStream, type Flags, type FullScraperEvents, type HlsBasedStream, type MediaTypes, type MetaOutput, type MovieMedia, type MovieScrapeContext, NotFoundError, type ProviderBuilder, type ProviderControls, type ProviderMakerOptions, type Qualities, type RunOutput, type RunnerOptions, type ScrapeContext, type ScrapeMedia, type ShowMedia, type ShowScrapeContext, type SourceRunnerOptions, type SourcererOptions, type SourcererOutput, type Stream, type StreamFile, type Targets, buildProviders, createM3U8ProxyUrl, flags, getBuiltinEmbeds, getBuiltinExternalSources, getBuiltinSources, getM3U8ProxyUrl, labelToLanguageCode, makeProviders, makeSimpleProxyFetcher, makeStandardFetcher, setM3U8ProxyUrl, targets, updateM3U8ProxyUrl };
