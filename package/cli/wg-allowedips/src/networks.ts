import { isIP, } from 'node:net';

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { parseCidr, } from 'cidr-tools';

import { InputValidationError, } from './errors.ts';

/**
 * Address record returned by the resolver seam.
 */
export type LookupAddress = {
  readonly address: string;
};

/**
 * Resolver seam used by set generation.
 */
export type LookupAddresses = (
  { hostname, }: { readonly hostname: string; },
) => Promise<readonly LookupAddress[]> | readonly LookupAddress[];

/**
 * Module logger for input-to-network conversion.
 */
const l = tagged({ tag: 'networks', },);

/**
 * Node family marker for IPv4.
 */
const IPV4_FAMILY = 4;

/**
 * Host-route and maximum network prefix for IPv4.
 */
const IPV4_PREFIX = 32;

/**
 * Host-route and maximum network prefix for IPv6.
 */
const IPV6_PREFIX = 128;

/**
 * Turns one validated IP address into its explicit host route.
 *
 * @param address - IP literal to normalize as one-address CIDR.
 *
 * @param context - Input source named when validation fails.
 *
 * @returns IPv4 `/32` or IPv6 `/128` route.
 *
 * @throws {@link InputValidationError} when `address` is not an IP literal.
 *
 * @example
 * ```ts
 * toHostRoute({ address: '192.0.2.1', context: 'input' });
 * // => '192.0.2.1/32'
 * ```
 */
function toHostRoute(
  {
    address,
    context,
  }: {
    readonly address: string;
    readonly context: string;
  },
): string {
  /**
   * IP family reported by Node's strict literal validator.
   */
  const family = isIP(address,);
  if (family === 0) {
    l.error(`invalid IP address from ${context}: ${address}`,);
    throw new InputValidationError(`Invalid IP address from ${context}: ${address}`,);
  }
  return `${address}/${String(family === IPV4_FAMILY ? IPV4_PREFIX : IPV6_PREFIX,)}`;
}

/**
 * Parses and validates one CIDR entry against its original address text and family bound.
 *
 * @param entry - Trimmed CIDR entry from an input file.
 *
 * @returns Normalized CIDR emitted by `cidr-tools`.
 *
 * @throws {@link InputValidationError} when the original address is invalid or its prefix exceeds family bounds.
 *
 * @example
 * ```ts
 * parseNetwork({ entry: '192.0.2.7/24' });
 * // => '192.0.2.0/24'
 * ```
 */
function parseNetwork({ entry, }: { readonly entry: string; },): string {
  /**
   * Dependency parse result used for normalized CIDR and prefix metadata.
   */
  const parsed = parseCidr(entry,);
  /**
   * Slash separating original address text from its prefix.
   */
  const slashIndex = entry.indexOf('/',);
  /**
   * Original address text, validated before accepting dependency normalization.
   */
  const address = entry.slice(
    0,
    slashIndex,
  );
  /**
   * Strict family of original address text.
   */
  const family = isIP(address,);
  if (family === 0) {
    l.error(`invalid address in CIDR entry: ${entry}`,);
    throw new InputValidationError(`Invalid IP address in CIDR entry: ${entry}`,);
  }
  /**
   * Numeric prefix returned from the already syntax-validated dependency parser.
   */
  const prefix = Number(parsed.prefix,);
  /**
   * Largest prefix accepted for original address family.
   */
  const maximumPrefix = family === IPV4_FAMILY
    ? IPV4_PREFIX
    : IPV6_PREFIX;
  if (prefix > maximumPrefix) {
    l.error(`prefix exceeds family bound: ${entry}`,);
    throw new InputValidationError(
      `CIDR prefix exceeds IPv${String(family,)} maximum ${String(maximumPrefix,)}: ${entry}`,
    );
  }
  return parsed.cidr;
}

/**
 * Classifies one trimmed input entry and resolves it into explicit networks.
 *
 * @param entry - Nonempty, non-comment input entry.
 *
 * @param lookupAddresses - Resolver seam for domain entries.
 *
 * @returns One direct network or every resolved domain address as host routes.
 *
 * @throws {@link InputValidationError} when a direct or resolved address is invalid.
 *
 * @example
 * ```ts
 * await entryNetworks({
 *   entry: 'example.test',
 *   lookupAddresses: async () => [{ address: '192.0.2.1' }],
 * });
 * // => ['192.0.2.1/32']
 * ```
 */
async function entryNetworks(
  {
    entry,
    lookupAddresses,
  }: {
    readonly entry: string;
    readonly lookupAddresses: LookupAddresses;
  },
): Promise<readonly string[]> {
  /**
   * Strict direct-literal family, or zero for CIDRs and domains.
   */
  const family = isIP(entry,);
  if (family !== 0) {
    l.debug(`classified direct IPv${String(family,)} host`,);
    return [toHostRoute({
      address: entry,
      context: 'input entry',
    },),];
  }
  if (entry.includes('/',)) {
    l.debug('classified CIDR entry',);
    return [parseNetwork({ entry, },),];
  }
  l.debug(`resolving domain ${entry}`,);
  /**
   * Every address returned by operating-system lookup for one domain.
   */
  const addresses = await lookupAddresses({ hostname: entry, },);
  l.debug(`resolved ${entry} to ${String(addresses.length,)} address(es)`,);
  return addresses.map(function resolvedHostRoute({ address, },): string {
    return toHostRoute({
      address,
      context: `domain ${entry}`,
    },);
  },);
}

/**
 * Converts one file's text into networks while skipping blank and whole-line comment entries.
 *
 * @param text - Complete input file text.
 *
 * @param lookupAddresses - Resolver seam for domain entries.
 *
 * @returns Flattened networks contributed by all active lines.
 *
 * @example
 * ```ts
 * await textNetworks({ text: '# comment\n192.0.2.1\n', lookupAddresses: async () => [] });
 * // => ['192.0.2.1/32']
 * ```
 */
export async function textNetworks(
  {
    text,
    lookupAddresses,
  }: {
    readonly text: string;
    readonly lookupAddresses: LookupAddresses;
  },
): Promise<readonly string[]> {
  /**
   * Function-scoped logger for complete text conversion.
   */
  const fl = tagged({
    tag: textNetworks.name,
    l,
  },);
  /**
   * Trimmed active entries preserving file order before concurrent resolution.
   */
  const entries = text
    .split('\n',)
    .map(function trimLine(line: string,): string {
      return line.trim();
    },)
    .filter(function isActiveEntry(line: string,): boolean {
      return (line !== '') && (!line.startsWith('#',));
    },);
  fl.debug(`converting ${String(entries.length,)} active input entry or entries`,);
  /**
   * Per-entry network groups resolved concurrently.
   */
  const groups = await Promise.all(entries.map(async function resolveEntry(
    entry: string,
  ): Promise<readonly string[]> {
    return await entryNetworks({
      entry,
      lookupAddresses,
    },);
  },),);
  return groups.flat();
}
