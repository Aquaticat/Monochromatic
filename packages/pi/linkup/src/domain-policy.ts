/**
 * Host-suffix blocklist normalization and matching for Pi Linkup.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { linkupLogger, } from './log.ts';

//region Constants

/** Characters allowed in normalized host suffix entries. */
const HOST_SUFFIX_ALLOWED_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789-.';

/** Scheme delimiter rejected in blocklist entries. */
const SCHEME_DELIMITER = '://';

/** Slash rejected in blocklist entries. */
const SLASH = '/';

/** Colon rejected in blocklist entries. */
const COLON = ':';

/** Wildcard rejected in blocklist entries. */
const WILDCARD = '*';

/** Dot used as host label separator. */
const DOT = '.';

/** Boundary suffix separator for subdomain matching. */
const DOT_PREFIX = '.';

//endregion Constants

//region Types

/**
 * Result of filtering Linkup search results with the local host blocklist.
 */
type SearchResultFilterResult = {
  /** Linkup-shaped response visible to the model after local filtering. */
  readonly linkupResponse: unknown;
  /** Untouched upstream Linkup response. */
  readonly rawLinkupResponse: unknown;
  /** Blocked result URLs removed from the model-visible response. */
  readonly removedBlockedUrls: readonly string[];
};

//endregion Types

/** Module logger. */
const l = tagged({
  tag: 'domain-policy',
  l: linkupLogger,
},);

//region Blocklist normalization

/**
 * Normalize one configured host suffix.
 *
 * @param entry - raw blocklist entry from config
 *
 * @returns normalized host suffix
 *
 * @throws when entry is empty or not a strict host suffix
 *
 * @example
 * ```ts
 * normalizeBlocklistEntry(' Example.COM. ');
 * ```
 */
function normalizeBlocklistEntry(entry: string,): string {
  /** Logger tagged for this normalization call. */
  const innerL = tagged({
    tag: normalizeBlocklistEntry.name,
    l,
  },);
  /** Trimmed host suffix candidate. */
  const trimmed = entry.trim();
  if (trimmed === '')
    throw new Error('blocklist entry is empty');

  /** Lowercase host suffix candidate with one optional trailing root dot removed. */
  const normalized = stripOneTrailingDot(trimmed.toLowerCase(),);
  if (normalized === '')
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} is empty after normalization`);
  if (normalized.includes(SCHEME_DELIMITER,))
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} must not include a scheme`);
  if (normalized.includes(SLASH,))
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} must not include a slash`);
  if (normalized.includes(COLON,))
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} must not include a port`);
  if (normalized.includes(WILDCARD,))
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} must not include a wildcard`);

  /** Host labels split on dots. */
  const labels = normalized.split(DOT,);
  if (labels.some(function isEmptyLabel(label,) {
    return label === '';
  },))
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} must not include empty labels`);
  if (!Array.from(normalized,).every(isAllowedHostSuffixChar,))
    throw new Error(`blocklist entry ${JSON.stringify(entry,)} contains invalid host characters`);

  innerL.debug(`normalized blocklist entry ${entry} to ${normalized}`,);
  return normalized;
}

/**
 * Normalize all configured host suffixes and remove duplicates.
 *
 * @param entries - raw config blocklist entries
 *
 * @returns normalized blocklist
 *
 * @throws when any entry is invalid
 *
 * @example
 * ```ts
 * normalizeBlocklist(['Example.com.', 'example.com']);
 * ```
 */
function normalizeBlocklist(entries: readonly string[],): readonly string[] {
  /** Normalized host suffixes. */
  const normalizedEntries = entries.map(function normalizeEntry(entry,) {
    return normalizeBlocklistEntry(entry,);
  },);
  return [...new Set(normalizedEntries,),];
}

/**
 * Strip one optional trailing root dot.
 *
 * @param value - host suffix candidate
 *
 * @returns host suffix without one trailing dot
 *
 * @example
 * ```ts
 * stripOneTrailingDot('example.com.');
 * ```
 */
function stripOneTrailingDot(value: string,): string {
  return value.endsWith(DOT,)
    ? value.slice(0, -1,)
    : value;
}

/**
 * Return whether a normalized host suffix character is allowed.
 *
 * @param char - one string iterator character
 *
 * @returns whether char is allowed in a host suffix
 *
 * @example
 * ```ts
 * isAllowedHostSuffixChar('a');
 * ```
 */
function isAllowedHostSuffixChar(char: string,): boolean {
  return HOST_SUFFIX_ALLOWED_CHARS.includes(char,);
}

//endregion Blocklist normalization

//region Host matching

/**
 * Normalize URL hostnames before local policy matching.
 *
 * @param host - URL hostname
 *
 * @returns lowercase host without one optional trailing root dot
 *
 * @example
 * ```ts
 * normalizeHostForPolicy('WWW.Example.COM.');
 * ```
 */
function normalizeHostForPolicy(host: string,): string {
  return stripOneTrailingDot(host.trim().toLowerCase(),);
}

/**
 * Find blocklist entry matching a host.
 *
 * @param host - candidate URL host
 *
 * @param blocklist - normalized host suffix blocklist
 *
 * @returns matching blocklist entry, when blocked
 *
 * @example
 * ```ts
 * findBlockedHostMatch({ host: 'www.example.com', blocklist: ['example.com'] });
 * ```
 */
function findBlockedHostMatch(
  {
    host,
    blocklist,
  }: {
    readonly host: string;
    readonly blocklist: readonly string[];
  },
): string | undefined {
  /** Normalized host from URL parsing. */
  const normalizedHost = normalizeHostForPolicy(host,);
  return blocklist.find(function matchesEntry(entry,) {
    return normalizedHost === entry
      || normalizedHost.endsWith(`${DOT_PREFIX}${entry}`,);
  },);
}

/**
 * Return whether a host is blocked.
 *
 * @param host - candidate URL host
 *
 * @param blocklist - normalized host suffix blocklist
 *
 * @returns whether host matches blocklist exactly or as a subdomain suffix
 *
 * @example
 * ```ts
 * isBlockedHost({ host: 'www.example.com', blocklist: ['example.com'] });
 * ```
 */
function isBlockedHost(
  {
    host,
    blocklist,
  }: {
    readonly host: string;
    readonly blocklist: readonly string[];
  },
): boolean {
  return findBlockedHostMatch({ host, blocklist, },) !== undefined;
}

/**
 * Find blocklist entry matching a URL.
 *
 * @param url - candidate absolute URL
 *
 * @param blocklist - normalized host suffix blocklist
 *
 * @returns matching blocklist entry, when blocked
 *
 * @throws when url cannot be parsed
 *
 * @example
 * ```ts
 * findBlockedUrlMatch({ url: 'https://www.example.com/a', blocklist: ['example.com'] });
 * ```
 */
function findBlockedUrlMatch(
  {
    url,
    blocklist,
  }: {
    readonly url: string;
    readonly blocklist: readonly string[];
  },
): string | undefined {
  /** Parsed URL used as host grammar authority. */
  const parsedUrl = parsePolicyUrl(url,);
  return findBlockedHostMatch({
    host: parsedUrl.hostname,
    blocklist,
  },);
}

/**
 * Return whether a URL is blocked.
 *
 * @param url - candidate absolute URL
 *
 * @param blocklist - normalized host suffix blocklist
 *
 * @returns whether URL host is blocked
 *
 * @throws when url cannot be parsed
 *
 * @example
 * ```ts
 * isBlockedUrl({ url: 'https://example.com', blocklist: ['example.com'] });
 * ```
 */
function isBlockedUrl(
  {
    url,
    blocklist,
  }: {
    readonly url: string;
    readonly blocklist: readonly string[];
  },
): boolean {
  return findBlockedUrlMatch({ url, blocklist, },) !== undefined;
}

/**
 * Parse a URL for blocklist policy checks.
 *
 * @param url - candidate absolute URL
 *
 * @returns parsed URL
 *
 * @throws when url cannot be parsed
 *
 * @example
 * ```ts
 * parsePolicyUrl('https://example.com');
 * ```
 */
function parsePolicyUrl(url: string,): URL {
  try {
    return new URL(url,);
  }
  catch (error: unknown) {
    /** Parse failure detail from the URL constructor. */
    const detail = error instanceof Error
      ? error.message
      : String(error,);
    throw new Error(`Invalid URL for pi-linkup blocklist check: ${url}. ${detail}`,);
  }
}

//endregion Host matching

//region Search result filtering

/**
 * Filter blocked Linkup search result URLs out of a Linkup-shaped response.
 *
 * @param response - upstream Linkup search response
 *
 * @param blocklist - normalized host suffix blocklist
 *
 * @returns raw response plus model-visible response after local filtering
 *
 * @example
 * ```ts
 * filterBlockedSearchResults({ response: { results: [] }, blocklist: [] });
 * ```
 */
function filterBlockedSearchResults(
  {
    response,
    blocklist,
  }: {
    readonly response: unknown;
    readonly blocklist: readonly string[];
  },
): SearchResultFilterResult {
  if (blocklist.length === 0)
    return {
      linkupResponse: response,
      rawLinkupResponse: response,
      removedBlockedUrls: [],
    };
  if (!isRecord(response,))
    return {
      linkupResponse: response,
      rawLinkupResponse: response,
      removedBlockedUrls: [],
    };

  /** Raw `results` property from Linkup response. */
  const rawResults = response.results;
  if (!Array.isArray(rawResults,))
    return {
      linkupResponse: response,
      rawLinkupResponse: response,
      removedBlockedUrls: [],
    };

  /** Blocked result URLs observed while filtering. */
  const removedBlockedUrls: string[] = [];
  /** Results allowed to remain model-visible. */
  const filteredResults = rawResults.filter(function keepAllowedResult(result,) {
    /** Result URL when the result has a string URL field. */
    const resultUrl = searchResultUrl(result,);
    if (resultUrl === undefined)
      return true;

    /** Matching blocklist entry, when URL host is blocked. */
    const blockedEntry = blockedEntryForPossiblyInvalidUrl({
      url: resultUrl,
      blocklist,
    },);
    if (blockedEntry === undefined)
      return true;

    removedBlockedUrls.push(resultUrl,);
    return false;
  },);

  if (removedBlockedUrls.length === 0)
    return {
      linkupResponse: response,
      rawLinkupResponse: response,
      removedBlockedUrls,
    };

  l.warn(`removed ${String(removedBlockedUrls.length,)} blocked Linkup search result(s)`,);
  return {
    linkupResponse: {
      ...response,
      results: filteredResults,
    },
    rawLinkupResponse: response,
    removedBlockedUrls,
  };
}

/**
 * Return blocklist match for a Linkup result URL or undefined for unparsable URLs.
 *
 * @param url - Linkup result URL
 *
 * @param blocklist - normalized host suffix blocklist
 *
 * @returns matching blocklist entry, when the URL parses and is blocked
 *
 * @example
 * ```ts
 * blockedEntryForPossiblyInvalidUrl({ url: 'https://example.com', blocklist: ['example.com'] });
 * ```
 */
function blockedEntryForPossiblyInvalidUrl(
  {
    url,
    blocklist,
  }: {
    readonly url: string;
    readonly blocklist: readonly string[];
  },
): string | undefined {
  try {
    return findBlockedUrlMatch({ url, blocklist, },);
  }
  catch {
    l.warn(`skipping local blocklist filtering for unparsable Linkup result URL: ${url}`,);
    return undefined;
  }
}

/**
 * Return a Linkup result URL from an arbitrary result value.
 *
 * @param value - Linkup result candidate
 *
 * @returns URL when value has a string url property
 *
 * @example
 * ```ts
 * searchResultUrl({ url: 'https://example.com' });
 * ```
 */
function searchResultUrl(value: unknown,): string | undefined {
  if (!isRecord(value,))
    return undefined;
  return typeof value.url === 'string'
    ? value.url
    : undefined;
}

/**
 * Return whether value is a non-null object record.
 *
 * @param value - unknown value
 *
 * @returns whether value can be read by string keys
 *
 * @example
 * ```ts
 * isRecord({});
 * ```
 */
function isRecord(value: unknown,): value is Record<string, unknown> {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value,);
}

//endregion Search result filtering

export {
  filterBlockedSearchResults,
  findBlockedHostMatch,
  findBlockedUrlMatch,
  isBlockedHost,
  isBlockedUrl,
  normalizeBlocklist,
  normalizeBlocklistEntry,
  normalizeHostForPolicy,
};
export type { SearchResultFilterResult, };
