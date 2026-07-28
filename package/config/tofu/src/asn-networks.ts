import type { Stats, } from 'node:fs';
import {
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';

/**
 * Input for resolving every IPinfo Lite network assigned to one ASN.
 *
 * @example
 * ```ts
 * const options: LookupAsnNetworksOptions = {
 *   asn: 'AS41231',
 *   cacheDirectory: '/tmp/asn-cache',
 *   token: process.env.IPINFO_TOKEN ?? '',
 * };
 * ```
 */
export type LookupAsnNetworksOptions = {
  readonly asn: string;
  readonly cacheDirectory: string;
  readonly token: string;
};

/**
 * Minimal IPinfo Lite record shape consumed by ASN filtering.
 *
 * @example
 * ```ts
 * const record: IpinfoLiteRecord = {
 *   asn: 'AS41231',
 *   network: '91.189.88.0/24',
 * };
 * ```
 */
type IpinfoLiteRecord = {
  readonly asn: string;
  readonly network: string;
};

/**
 * Unknown JSON object shape used before field-specific guards run.
 *
 * @example
 * ```ts
 * const object: UnknownRecord = { key: 'value' };
 * ```
 */
type UnknownRecord = Record<PropertyKey, unknown>;

/**
 * Error raised when ASN syntax or IPinfo Lite database access fails.
 *
 * @example
 * ```ts
 * throw new AsnDatabaseError('ASN must use AS<number> syntax: AS-example');
 * ```
 */
export class AsnDatabaseError extends Error {
  /**
   * Stable error type name.
   */
  override name = 'AsnDatabaseError';
}

/**
 * Sentinel returned when one NDJSON line has no matching network.
 */
const NO_MATCHING_NETWORK = Symbol('ipinfo line has no ASN-matching network',);

/**
 * Sentinel type for non-matching NDJSON lines.
 */
type NoMatchingNetwork = typeof NO_MATCHING_NETWORK;

/**
 * Sentinel for cache file absence.
 */
const ABSENT = Symbol('cache file missing on disk',);

/**
 * IPinfo Lite database download endpoint.
 */
const IPINFO_LITE_URL = 'https://ipinfo.io/data/ipinfo_lite.json.gz';

/* oxlint-disable eslint/no-magic-numbers -- Cache TTL unit conversion is clearer as one policy duration expression than as separately named calendar ratios. */
/**
 * Cache TTL matching existing OpenTofu ASN refresh policy.
 */
const THIRTY_DAYS_MS = 30 * 24
  * 60
  * 60
  * 1_000;
/* oxlint-enable eslint/no-magic-numbers */

/**
 * Checks whether unknown value is object-like enough for property guards.
 *
 * @param value - Candidate JSON value.
 *
 * @returns Whether value supports property checks.
 *
 * @example
 * ```ts
 * isRecord({ asn: 'AS41231' }); // true
 * ```
 */
function isRecord(value: unknown,): value is UnknownRecord {
  return ((typeof value) === 'object')
    && (value !== null);
}

/**
 * Checks whether unknown value is an IPinfo Lite record used by this module.
 *
 * @param value - Candidate parsed NDJSON record.
 *
 * @returns Whether value carries ASN and network text.
 *
 * @example
 * ```ts
 * isIpinfoLiteRecord({ asn: 'AS41231', network: '91.189.88.0/24' }); // true
 * ```
 */
function isIpinfoLiteRecord(value: unknown,): value is IpinfoLiteRecord {
  return isRecord(value,)
    && ((typeof value.asn) === 'string')
    && ((typeof value.network) === 'string');
}

/**
 * Checks whether text contains only ASCII decimal digits.
 *
 * @param text - Candidate decimal suffix.
 *
 * @returns Whether every character is an ASCII digit and text is nonempty.
 *
 * @example
 * ```ts
 * isDecimalDigits('41231'); // true
 * ```
 */
function isDecimalDigits(text: string,): boolean {
  if (text === '')
    return false;
  for (const character of text) {
    if ((character < '0') || (character > '9'))
      return false;
  }
  return true;
}

/**
 * Normalizes and validates conventional `AS<number>` text.
 *
 * @param asn - Candidate ASN text.
 *
 * @returns Uppercase normalized ASN.
 *
 * @throws {@link AsnDatabaseError} when syntax is not `AS<number>`.
 *
 * @example
 * ```ts
 * normalizeAsn('as41231'); // 'AS41231'
 * ```
 */
function normalizeAsn(asn: string,): string {
  /**
   * Case-normalized trimmed ASN.
   */
  const normalized = asn
    .trim()
    .toUpperCase();
  if ((!normalized.startsWith('AS',))
    || (!isDecimalDigits(normalized.slice(2,),))) {
    throw new AsnDatabaseError(`ASN must use AS<number> syntax: ${asn}`,);
  }
  return normalized;
}

/**
 * Parses one IPinfo NDJSON line and returns its network when ASN matches.
 *
 * @param line - NDJSON text line from IPinfo Lite.
 *
 * @param targetAsn - Normalized ASN to retain.
 *
 * @returns Matching network, or sentinel for malformed and non-matching lines.
 *
 * @example
 * ```ts
 * parseMatchingNetwork({
 *   line: '{"asn":"AS41231","network":"91.189.88.0/24"}',
 *   targetAsn: 'AS41231',
 * });
 * ```
 */
function parseMatchingNetwork(
  {
    line,
    targetAsn,
  }: {
    readonly line: string;
    readonly targetAsn: string;
  },
): string | NoMatchingNetwork {
  if (!line.includes(targetAsn,))
    return NO_MATCHING_NETWORK;
  /**
   * Parsed NDJSON entry before runtime shape validation.
   */
  const entry: unknown = JSON.parse(line,);
  if ((!isIpinfoLiteRecord(entry,)) || (entry.asn !== targetAsn))
    return NO_MATCHING_NETWORK;
  return entry.network;
}

/**
 * Narrows unknown caught value to Node filesystem error shape.
 *
 * @param error - Caught value.
 *
 * @returns Whether value is an error carrying a code.
 *
 * @example
 * ```ts
 * if (isErrnoException(error) && error.code === 'ENOENT') return;
 * ```
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return ((typeof error) === 'object')
    && (error !== null)
    && ('code' in error);
}

/**
 * Stats one path while representing absence explicitly.
 *
 * @param path - Path to inspect.
 *
 * @returns File metadata or absence sentinel.
 *
 * @throws When stat fails for a reason other than absence.
 *
 * @example
 * ```ts
 * await statIfExists('/tmp/cache_AS41231.txt');
 * ```
 */
async function statIfExists(path: string,): Promise<Stats | typeof ABSENT> {
  try {
    return await stat(path,);
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ENOENT'))
      return ABSENT;
    throw error;
  }
}

/**
 * Reads one UTF-8 path while representing absence explicitly.
 *
 * @param path - Path to read.
 *
 * @returns File text or absence sentinel.
 *
 * @throws When reading fails for a reason other than absence.
 *
 * @example
 * ```ts
 * await readTextIfExists('/tmp/cache_AS41231.txt');
 * ```
 */
async function readTextIfExists(path: string,): Promise<string | typeof ABSENT> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ENOENT'))
      return ABSENT;
    throw error;
  }
}

/**
 * Converts comma-separated cache text into nonempty network entries.
 *
 * @param text - Cache file contents.
 *
 * @returns Network strings preserving database order.
 *
 * @example
 * ```ts
 * cacheNetworks('192.0.2.0/24,2001:db8::/32');
 * ```
 */
function cacheNetworks(text: string,): readonly string[] {
  return text
    .split(',',)
    .map(function trimNetwork(network: string,): string {
      return network.trim();
    },)
    .filter(function isPresent(network: string,): boolean {
      return network !== '';
    },);
}

/**
 * Creates authenticated IPinfo Lite database URL without string interpolation of token syntax.
 *
 * @param token - IPinfo access token.
 *
 * @returns Database URL carrying encoded token query parameter.
 *
 * @throws {@link AsnDatabaseError} when token is empty.
 *
 * @example
 * ```ts
 * databaseUrl('token-value');
 * ```
 */
function databaseUrl(token: string,): URL {
  if (token === '')
    throw new AsnDatabaseError('IPINFO_TOKEN is required to refresh ASN network caches.',);
  /**
   * URL object responsible for query-component encoding.
   */
  const url = new URL(IPINFO_LITE_URL,);
  url
    .searchParams
    .set(
      'token',
      token,
    );
  return url;
}

/**
 * Streams IPinfo Lite and collects networks assigned to one ASN.
 *
 * @param targetAsn - Normalized ASN to retain.
 *
 * @param token - IPinfo database token.
 *
 * @returns Matching network strings in database order.
 *
 * @throws {@link AsnDatabaseError} for rejected responses and absent bodies.
 *
 * @example
 * ```ts
 * await fetchNetworks({ targetAsn: 'AS41231', token: 'token-value' });
 * ```
 */
async function fetchNetworks(
  {
    targetAsn,
    token,
  }: {
    readonly targetAsn: string;
    readonly token: string;
  },
): Promise<readonly string[]> {
  /**
   * HTTP response carrying gzip-encoded NDJSON.
   */
  const response = await fetch(databaseUrl(token,),);
  if (!response.ok) {
    throw new AsnDatabaseError(
      `IPinfo Lite database request failed with HTTP ${String(response.status,)}.`,
    );
  }
  /**
   * Nullable response body checked before decompression.
   */
  const { body, } = response;
  if (body === null)
    throw new AsnDatabaseError('IPinfo Lite database response did not include a body.',);
  /**
   * Pull reader over decompressed NDJSON bytes.
   */
  const reader = body
    .pipeThrough(new DecompressionStream('gzip',),)
    .getReader();
  /**
   * Decoder retained between chunks so split codepoints remain intact.
   */
  const decoder = new TextDecoder();
  /**
   * Matching network accumulator.
   */
  const networks: string[] = [];
  /**
   * Partial trailing line carried between chunks.
   */
  const textState = { leftover: '', };
  /**
   * Current sequential stream read result.
   */
  const readState = { current: await reader.read(), };
  while (!(readState
    .current
    .done)) {
    /**
     * Current decompressed byte chunk.
     */
    const { value, } = readState.current;
    /**
     * Complete decoded text available for line splitting in this iteration.
     */
    const chunk = textState.leftover + decoder.decode(
      value,
      { stream: true, },
    );
    /**
     * Complete lines plus trailing partial line.
     */
    const lines = chunk.split('\n',);
    textState.leftover = lines.pop() ?? '';
    for (const line of lines) {
      /**
       * Network when current database line belongs to target ASN.
       */
      const network = parseMatchingNetwork({
        line,
        targetAsn,
      },);
      if (network !== NO_MATCHING_NETWORK)
        networks.push(network,);
    }
    // oxlint-disable-next-line eslint/no-await-in-loop -- ReadableStream readers are sequential pull sources.
    readState.current = await reader.read();
  }
  /**
   * Final decoder flush and unterminated trailing database line.
   */
  const finalLine = textState.leftover + decoder.decode();
  if (finalLine !== '') {
    /**
     * Network from final unterminated line when it matches.
     */
    const network = parseMatchingNetwork({
      line: finalLine,
      targetAsn,
    },);
    if (network !== NO_MATCHING_NETWORK)
      networks.push(network,);
  }
  return networks;
}

/**
 * Resolves every IPinfo Lite network assigned to one ASN with month-scale per-ASN caching.
 *
 * Fresh caches avoid network access. Refresh failure falls back to stale cache text.
 *
 * @param asn - ASN in case-insensitive `AS<number>` syntax.
 *
 * @param cacheDirectory - Directory containing `cache_AS<number>.txt` snapshots.
 *
 * @param token - IPinfo Lite database token used only when cache refresh is required.
 *
 * @returns Network or single-address strings assigned to ASN.
 *
 * @throws {@link AsnDatabaseError} when ASN is invalid or refresh fails without stale cache.
 *
 * @example
 * ```ts
 * await lookupAsnNetworks({
 *   asn: 'AS41231',
 *   cacheDirectory: import.meta.dirname,
 *   token: process.env.IPINFO_TOKEN ?? '',
 * });
 * ```
 */
export async function lookupAsnNetworks(
  {
    asn,
    cacheDirectory,
    token,
  }: LookupAsnNetworksOptions,
): Promise<readonly string[]> {
  /**
   * Normalized ASN used for filtering and cache naming.
   */
  const targetAsn = normalizeAsn(asn,);
  /**
   * Per-ASN cache path.
   */
  const cachePath = join(
    cacheDirectory,
    `cache_${targetAsn}.txt`,
  );
  /**
   * Cache metadata for freshness decision.
   */
  const stats = await statIfExists(cachePath,);
  if ((stats !== ABSENT) && ((Date.now() - stats.mtimeMs) < THIRTY_DAYS_MS)) {
    return cacheNetworks(await readFile(
      cachePath,
      'utf8',
    ),);
  }
  try {
    /**
     * Current database networks fetched after cache expiration or absence.
     */
    const networks = await fetchNetworks({
      targetAsn,
      token,
    },);
    await writeFile(
      cachePath,
      networks.join(',',),
    );
    return networks;
  }
  catch (error) {
    process
      .stderr
      .write(
        `asn-networks: live fetch failed, attempting cache fallback: ${String(error,)}\n`,
      );
    /**
     * Stale cache contents used only after live refresh failure.
     */
    const cached = await readTextIfExists(cachePath,);
    if (cached === ABSENT) {
      throw new AsnDatabaseError(
        `IPinfo Lite lookup failed for ${targetAsn} and no cached fallback is available.`,
        { cause: error, },
      );
    }
    return cacheNetworks(cached,);
  }
}
