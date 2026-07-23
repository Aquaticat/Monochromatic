import type { Stats, } from 'node:fs';
import {
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { json, } from 'node:stream/consumers';

/**
 * OpenTofu `data.external` query carrying ASN text.
 *
 * @example
 * ```ts
 * const query: ExternalAsnQuery = { asn: 'AS41231' };
 * ```
 */
type ExternalAsnQuery = {
  readonly asn: string;
};

/**
 * Minimal ipinfo Lite record shape consumed by this script.
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
 * Unknown JSON object shape used before field-specific type guards run.
 *
 * @example
 * ```ts
 * const object: UnknownRecord = { key: 'value' };
 * ```
 */
type UnknownRecord = Record<PropertyKey, unknown>;

/**
 * Sentinel returned when NDJSON line does not carry matching network.
 */
const NO_MATCHING_NETWORK = Symbol('ipinfo line has no ASN-matching network',);

/**
 * Sentinel type for non-matching NDJSON lines.
 */
type NoMatchingNetwork = typeof NO_MATCHING_NETWORK;

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
 * Checks whether unknown value is OpenTofu ASN query input.
 *
 * @param value - Candidate OpenTofu query value.
 *
 * @returns Whether value carries ASN text.
 *
 * @example
 * ```ts
 * isExternalAsnQuery({ asn: 'AS41231' }); // true
 * ```
 */
function isExternalAsnQuery(value: unknown,): value is ExternalAsnQuery {
  return isRecord(value,)
    && ((typeof value.asn) === 'string');
}

/**
 * Parses OpenTofu query input or throws with context.
 *
 * @param value - Candidate OpenTofu query value.
 *
 * @returns Validated ASN query.
 *
 * @throws When value lacks ASN text.
 *
 * @example
 * ```ts
 * parseExternalAsnQuery({ asn: 'AS41231' });
 * ```
 */
function parseExternalAsnQuery(value: unknown,): ExternalAsnQuery {
  if (isExternalAsnQuery(value,))
    return value;

  throw new Error('OpenTofu external query must include string asn',);
}

/**
 * Checks whether unknown value is ipinfo Lite record with fields consumed here.
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
 * Parses one ipinfo NDJSON line and returns network when ASN matches.
 *
 * @param line - NDJSON text line from ipinfo Lite.
 *
 * @param targetAsn - Normalised ASN to keep.
 *
 * @returns Matching network CIDR, or {@link NO_MATCHING_NETWORK} for
 *   non-matching or malformed lines.
 *
 * @example
 * ```ts
 * parseMatchingNetwork({
 *   line: '{"asn":"AS41231","network":"91.189.88.0/24"}',
 *   targetAsn: 'AS41231',
 * });
 * ```
 */
function parseMatchingNetwork({
  line,
  targetAsn,
}: {
  readonly line: string;
  readonly targetAsn: string;
},): string | NoMatchingNetwork {
  if (!line.includes(targetAsn,))
    return NO_MATCHING_NETWORK;

  /**
   * Parsed NDJSON entry before runtime shape validation.
   */
  const entry: unknown = JSON.parse(line,);
  if (!isIpinfoLiteRecord(entry,))
    return NO_MATCHING_NETWORK;

  if (entry.asn !== targetAsn)
    return NO_MATCHING_NETWORK;

  return entry.network;
}

/**
 * Raw OpenTofu `data.external` payload read from stdin.
 */
const rawInput: unknown = await json(process.stdin,);

/**
 * Validated OpenTofu query payload.
 */
const input = parseExternalAsnQuery(rawInput,);

/**
 * Normalised ASN used both for filtering ipinfo entries and naming the cache file.
 */
const TARGET_ASN = input.asn
  .trim()
  .toUpperCase();

if (TARGET_ASN === '')
  throw new Error('No ASN provided',);

/**
 * Per-ASN cache path so each ASN keeps its own snapshot without colliding.
 */
const CACHE_FILE = join(
  import.meta.dirname,
  `cache_${TARGET_ASN}.txt`,
);

/* oxlint-disable eslint/no-magic-numbers -- Cache TTL unit conversion is clearer as one policy duration expression than as separately named calendar ratios. */
/**
 * Cache TTL: ipinfo prefix data changes slowly so month-scale refetches are acceptable.
 */
const THIRTY_DAYS_MS = 30 * 24
  * 60
  * 60
  * 1_000;
/* oxlint-enable eslint/no-magic-numbers */

/**
 * ipinfo Lite dataset endpoint; token is read from env so it stays out of source.
 */
const URL =
  `https://ipinfo.io/data/ipinfo_lite.json.gz?_src=frontend&token=${process.env
    .IPINFO_TOKEN}`;

/**
 * Narrows an unknown caught value to {@link NodeJS.ErrnoException} so callers can
 * branch on `error.code` without an unsafe `as` assertion (oxlint bans that cast).
 *
 * @param error - Caught value, which `try` lifts to `unknown`.
 *
 * @returns Whether value is an {@link Error} carrying a `code` property.
 *
 * @example
 * ```ts
 * if (isErrnoException(error,) && (error.code === 'ENOENT')) return ABSENT;
 * ```
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return Error.isError(error,)
    && ('code' in error);
}

/**
 * Sentinel for "the cache file does not exist". A unique `Symbol` rather than
 * `null`/`undefined` so the absent case stays out of a `no-nullish-union`-banned union.
 */
const ABSENT: unique symbol = Symbol('cache file missing on disk',);

/**
 * Stats the cache file, collapsing a missing file to {@link ABSENT}; every other
 * stat error propagates.
 *
 * @param path - Absolute path to stat.
 *
 * @returns File metadata, or {@link ABSENT} on `ENOENT`.
 *
 * @throws When the stat fails for any reason other than a missing file.
 *
 * @example
 * ```ts
 * const stats = await statIfExists(CACHE_FILE);
 * ```
 */
async function statIfExists(path: string,): Promise<Stats | typeof ABSENT> {
  try {
    return await stat(path,);
  }
  catch (error) {
    if (isErrnoException(error,)
      && (error.code
        === 'ENOENT'))
      return ABSENT;
    throw error;
  }
}

/**
 * Reads the cache file's UTF-8 contents, collapsing a missing file to {@link ABSENT};
 * every other read error propagates.
 *
 * @param path - Absolute path to read.
 *
 * @returns File contents, or {@link ABSENT} on `ENOENT`.
 *
 * @throws When the read fails for any reason other than a missing file.
 *
 * @example
 * ```ts
 * const cached = await readTextIfExists(CACHE_FILE);
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
    if (isErrnoException(error,)
      && (error.code
        === 'ENOENT'))
      return ABSENT;
    throw error;
  }
}

/**
 * Entry point invoked at module load: serves cached IPs when fresh, otherwise streams
 * ipinfo Lite dataset and writes comma-joined CIDRs matching target ASN.
 *
 * Output is JSON object on stdout that OpenTofu's `external` data source consumes.
 *
 * @throws When fetch fails and no cached fallback exists.
 *
 * @example
 * ```ts
 * await run();
 * ```
 */
async function run(): Promise<void> {
  // Check Cache
  /**
   * Cache file metadata used to compare mtime against {@link THIRTY_DAYS_MS},
   * or {@link ABSENT} when no cache file exists yet.
   */
  const stats = await statIfExists(CACHE_FILE,);
  if ((stats !== ABSENT)
    && ((Date.now()
      - stats
        .mtimeMs) < THIRTY_DAYS_MS)) {
    process.stdout
      .write(
      JSON.stringify({ ips: await readFile(
        CACHE_FILE,
        'utf8',
      ), },),
    );
    return;
  }

  // Stream & Filter (Memory-only)
  try {
    /**
     * HTTP response carrying gzip-encoded NDJSON body.
     */
    const response = await fetch(URL,);
    /**
     * Nullable body from Fetch API, checked before stream decompression.
     */
    const { body, } = response;
    if (body === null)
      throw new Error('ipinfo response did not include a body',);

    /**
     * Decompressed body stream; reading line-by-line avoids buffering whole dataset.
     */
    const stream = body
      .pipeThrough(new DecompressionStream('gzip',),);
    /**
     * Pull-based reader over decompressed stream so consumption stays incremental.
     */
    const reader = stream.getReader();
    /**
     * UTF-8 decoder kept across reads via `{ stream: true }` so split codepoints stay intact.
     */
    const decoder = new TextDecoder();

    /**
     * Accumulator of CIDR networks for entries matching {@link TARGET_ASN}.
     */
    const ips: string[] = [];
    /**
     * Trailing partial line carried over between chunks until newline arrives.
     */
    let leftover = '';

    /**
     * Current sequential read result; stream completion is the loop boundary.
     */
    const readState = { current: await reader.read(), };
    while (!(readState
      .current
      .done)) {
      /**
       * Current raw chunk from the incomplete stream read.
       */
      const { value, } = readState.current;
      /**
       * Decoded chunk prefixed with previous leftover so line splits work across read boundaries.
       */
      const chunk = leftover + decoder
        .decode(
        value,
        { stream: true, },
      );
      /**
       * Chunk split on newlines; last element is held back for next iteration.
       */
      const lines = chunk.split('\n',);
      leftover = lines.pop()
        ?? '';

      for (const line of lines) {
        /**
         * Matching network parsed from current line, when line belongs to target ASN.
         */
        const network = parseMatchingNetwork({
          line,
          targetAsn: TARGET_ASN,
        },);
        if (network !== NO_MATCHING_NETWORK)
          ips.push(network,);
      }
      // oxlint-disable-next-line eslint/no-await-in-loop -- ReadableStream readers are sequential pull sources; next read depends on reader state from previous read.
      readState.current = await reader.read();
    }

    /**
     * Comma-joined CIDR list ready to write to cache and stream out to OpenTofu.
     */
    const result = ips.join(',',);
    await writeFile(
      CACHE_FILE,
      result,
    );
    process.stdout
      .write(JSON.stringify({ ips: result, },),);
  }
  catch (error) {
    // Log why the live fetch failed before deciding whether a stale cache can cover it.
    process.stderr
      .write(`fetch_ips: live fetch failed, attempting cache fallback: ${String(error,)}\n`,);

    // Fallback to expired cache if download fails.
    /**
     * Stale cache contents, or {@link ABSENT} when no cache exists to fall back to.
     */
    const cached = await readTextIfExists(CACHE_FILE,);
    if (cached === ABSENT)
      throw new Error(
        'fetch failed and no cached fallback available',
        { cause: error, },
      );

    process.stdout
      .write(JSON.stringify({ ips: cached, },),);
  }
}

await run();
