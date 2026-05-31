import { existsSync, } from 'node:fs';
import {
  readFile,
  stat,
  writeFile,
} from 'node:fs/promises';
import { join, } from 'node:path';
import { json, } from 'node:stream/consumers';

/**
 * Minimal Onionoo relay record consumed by this script.
 *
 * @example
 * ```ts
 * const relay: OnionooRelay = { or_addresses: ['192.0.2.1:443'] };
 * ```
 */
type OnionooRelay = {
  readonly or_addresses: readonly string[];
};

/**
 * Minimal Onionoo response shape consumed by this script.
 *
 * @example
 * ```ts
 * const response: OnionooResponse = { relays: [{ or_addresses: ['192.0.2.1:443'] }] };
 * ```
 */
type OnionooResponse = {
  readonly relays: readonly OnionooRelay[];
};

/**
 * Unknown JSON object shape used before field-specific type guards run.
 *
 * @example
 * ```ts
 * const object: UnknownRecord = { relays: [] };
 * ```
 */
type UnknownRecord = Record<PropertyKey, unknown>;

/**
 * Sentinel returned when Onionoo address is not ORPort 443.
 */
const NO_ORPORT_443_CIDR = Symbol('no ORPort 443 CIDR',);

/**
 * Sentinel type for Onionoo addresses not used by firewall rule generation.
 */
type NoOrPort443Cidr = typeof NO_ORPORT_443_CIDR;

// 1. Consume OpenTofu input (data.external sends {}; we ignore it)
await json(process.stdin,);

/**
 * Local snapshot of fetched Tor guard relays; reused when Onionoo is unreachable.
 */
const CACHE_FILE = join(
  import.meta.dirname,
  'cache_tor_relays.json',
);
/* oxlint-disable eslint/no-magic-numbers -- Cache TTL unit conversion is clearer as one policy duration expression than as separately named clock ratios. */
/**
 * Cache TTL: relay flags churn within hours so an hour between refetches keeps list current.
 */
const ONE_HOUR_MS = 60 * 60
  * 1_000;
/* oxlint-enable eslint/no-magic-numbers */

// Onionoo's `flag` query accepts only a single value; Guard alone is fine
// because guards must be Stable to earn the flag in the first place.
/**
 * Onionoo query restricted to running guard relays, ordered by consensus weight,
 * capped at the top 500 so the resulting firewall rule set stays bounded.
 */
const URL =
  'https://onionoo.torproject.org/details?type=relay&running=true&flag=Guard&fields=or_addresses&order=-consensus_weight&limit=500';

/**
 * Checks whether unknown value is object-like enough for property guards.
 *
 * @param value - Candidate JSON value.
 *
 * @returns Whether value supports property checks.
 *
 * @example
 * ```ts
 * isRecord({ relays: [] }); // true
 * ```
 */
function isRecord(value: unknown,): value is UnknownRecord {
  return ((typeof value) === 'object')
    && (value !== null);
}

/**
 * Checks whether unknown value is string.
 *
 * @param value - Candidate JSON value.
 *
 * @returns Whether value is string.
 *
 * @example
 * ```ts
 * isString('192.0.2.1:443'); // true
 * ```
 */
function isString(value: unknown,): value is string {
  return ((typeof value) === 'string');
}

/**
 * Checks whether unknown value is Onionoo relay record.
 *
 * @param value - Candidate parsed relay.
 *
 * @returns Whether value carries OR address strings.
 *
 * @example
 * ```ts
 * isOnionooRelay({ or_addresses: ['192.0.2.1:443'] }); // true
 * ```
 */
function isOnionooRelay(value: unknown,): value is OnionooRelay {
  if (!isRecord(value,))
    return false;

  /**
   * Onionoo OR address list candidate.
   */
  const { or_addresses: orAddresses, } = value;
  if (!Array.isArray(orAddresses,))
    return false;

  return orAddresses.every(function isStringElement(element,): element is string {
    return isString(element,);
  },);
}

/**
 * Checks whether unknown value is Onionoo response record.
 *
 * @param value - Candidate parsed Onionoo response.
 *
 * @returns Whether value carries relay records.
 *
 * @example
 * ```ts
 * isOnionooResponse({ relays: [{ or_addresses: ['192.0.2.1:443'] }] }); // true
 * ```
 */
function isOnionooResponse(value: unknown,): value is OnionooResponse {
  if (!isRecord(value,))
    return false;

  /**
   * Onionoo relay list candidate.
   */
  const { relays, } = value;
  if (!Array.isArray(relays,))
    return false;

  return relays.every(function isRelayElement(element,): element is OnionooRelay {
    return isOnionooRelay(element,);
  },);
}

/**
 * Parses one Onionoo OR address and returns CIDR when ORPort is 443.
 *
 * @param address - Onionoo OR address text.
 *
 * @returns CIDR string for port-443 endpoint, or sentinel for other ports.
 *
 * @example
 * ```ts
 * parseOrPort443Cidr('192.0.2.1:443'); // '192.0.2.1/32'
 * ```
 */
function parseOrPort443Cidr(address: string,): string | NoOrPort443Cidr {
  if (address.startsWith('[',)
    && address
      .endsWith(']:443',)) {
    return `${
      address.slice(
        1,
        address.indexOf(']',),
      )
    }/128`;
  }

  if ((!address.endsWith(':443',))
    || address.startsWith('[',))
    return NO_ORPORT_443_CIDR;

  /**
   * Separator between IPv4 address and port.
   */
  const portSeparatorIndex = address.lastIndexOf(':',);
  if (portSeparatorIndex === (-1))
    return NO_ORPORT_443_CIDR;

  return `${
    address.slice(
      0,
      portSeparatorIndex,
    )
  }/32`;
}

/**
 * Entry point invoked at module load: serves cached relay IPs when fresh, otherwise
 * fetches Onionoo, filters to ORPort 443 only, writes the cache, and emits a JSON
 * object on stdout for OpenTofu's `external` data source.
 *
 * @throws When fetch fails and no cached fallback exists.
 *
 * @example
 * ```ts
 * await run();
 * ```
 */
async function run(): Promise<void> {
  // Check cache
  if (existsSync(CACHE_FILE,)) {
    /**
     * Cache file metadata used to compare mtime against {@link ONE_HOUR_MS}.
     */
    const stats = await stat(CACHE_FILE,);
    if ((Date.now()
      - stats
      .mtimeMs) < ONE_HOUR_MS) {
      process.stdout
        .write(
        JSON.stringify({ ips: await readFile(
          CACHE_FILE,
          'utf8',
        ), },),
      );
      return;
    }
  }

  // Fetch & filter to ORPort 443 only.
  // Single-port rules keep the firewall's effective-rule count predictable
  // (one rule per IP regardless of port count) and consolidate with the
  // existing port-443 outbound posture.
  try {
    /**
     * HTTP response from Onionoo carrying relay details JSON.
     */
    const response = await fetch(URL,);
    /**
     * Parsed Onionoo response before shape validation.
     */
    const rawData: unknown = await response.json();
    if (!isOnionooResponse(rawData,))
      throw new Error('Onionoo response did not match expected relay shape',);

    /**
     * Accumulator of `/32` (IPv4) and `/128` (IPv6) CIDR entries for ORPort 443 endpoints.
     */
    const ips: string[] = [];
    for (const relay of rawData.relays) {
      for (const address of relay.or_addresses) {
        /**
         * CIDR representation of current ORPort 443 address, when current address uses that port.
         */
        const cidr = parseOrPort443Cidr(address,);
        if (cidr !== NO_ORPORT_443_CIDR)
          ips.push(cidr,);
      }
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
  catch {
    // Fallback to expired cache if download fails
    if (existsSync(CACHE_FILE,)) {
      process.stdout
        .write(
        JSON.stringify({ ips: await readFile(
          CACHE_FILE,
          'utf8',
        ), },),
      );
    }
    else {
      throw new Error('fetch failed and no cached fallback available',);
    }
  }
}

await run();
