import { access, } from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { loadEnvFile, } from 'node:process';
import { fileURLToPath, } from 'node:url';

import {
  lookupAsnNetworks as lookupIpinfoAsnNetworks,
} from '@monochromatic-dev/config-tofu/ts/asn-networks.ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import type { LookupAsnNetworks, } from './networks.ts';

/**
 * Module logger for IPinfo ASN lookup adapter.
 */
const l = tagged({ tag: 'asn-lookup', },);

/**
 * Resolvable config-tofu source URL retained after bundling so runtime data stays in its owning package.
 */
const CONFIG_ASN_MODULE_URL = import.meta.resolve(
  '@monochromatic-dev/config-tofu/ts/asn-networks.ts',
);

/**
 * Directory containing per-ASN cache files maintained by config-tofu.
 */
const ASN_CACHE_DIRECTORY = dirname(fileURLToPath(CONFIG_ASN_MODULE_URL,),);

/**
 * Optional local IPinfo token file already used by config-tofu.
 */
const IPINFO_ENV_PATH = join(
  dirname(ASN_CACHE_DIRECTORY,),
  '.env.local',
);

/**
 * Loads config-tofu's local token only when caller environment has not supplied one.
 *
 * @example
 * ```ts
 * loadIpinfoEnvironment();
 * ```
 */
async function loadIpinfoEnvironment(): Promise<void> {
  /**
   * Token already inherited by current process, when present.
   */
  const { IPINFO_TOKEN, } = process.env;
  if (IPINFO_TOKEN !== undefined) {
    l.debug('using IPINFO_TOKEN from process environment',);
    return;
  }
  try {
    await access(IPINFO_ENV_PATH,);
  }
  catch (error) {
    if (((typeof error) !== 'object')
      || (error === null)
      || (!('code' in error))
      || (error.code !== 'ENOENT')) {
      l.error(`failed to inspect config-tofu .env.local: ${String(error,)}`,);
      throw error;
    }
    l.debug('config-tofu .env.local is absent (ENOENT)',);
    return;
  }
  l.debug('loading IPINFO_TOKEN from config-tofu .env.local',);
  loadEnvFile(IPINFO_ENV_PATH,);
}

/**
 * Resolves one ASN through config-tofu's shared IPinfo Lite cache and streaming database implementation.
 *
 * @param asn - Normalized ASN input.
 *
 * @returns Network and single-address strings assigned to ASN.
 *
 * @example
 * ```ts
 * await lookupConfiguredAsn({ asn: 'AS41231' });
 * ```
 */
async function lookupConfiguredAsn(
  { asn, }: { readonly asn: string; },
): Promise<readonly string[]> {
  /**
   * Function-scoped logger for one configured lookup.
   */
  const fl = tagged({
    tag: lookupConfiguredAsn.name,
    l,
  },);
  fl.debug(`resolving ${asn} through config-tofu IPinfo Lite database`,);
  await loadIpinfoEnvironment();
  /**
   * Token loaded from caller or config-tofu environment.
   */
  const { IPINFO_TOKEN = '', } = process.env;
  /**
   * Networks returned from fresh cache, live database, or stale fallback.
   */
  const networks = await lookupIpinfoAsnNetworks({
    asn,
    cacheDirectory: ASN_CACHE_DIRECTORY,
    token: IPINFO_TOKEN,
  },);
  fl.debug(`resolved ${asn} to ${String(networks.length,)} network(s)`,);
  return networks;
}

/**
 * Creates an invocation-scoped ASN adapter that coalesces duplicate concurrent lookups.
 *
 * @returns ASN lookup adapter backed by config-tofu IPinfo Lite data.
 *
 * @example
 * ```ts
 * const lookupAsnNetworks = createAsnLookup();
 * await lookupAsnNetworks({ asn: 'AS41231' });
 * ```
 */
export function createAsnLookup(): LookupAsnNetworks {
  /**
   * Pending and fulfilled lookups keyed by normalized ASN during one generation call.
   */
  const lookupPromises = new Map<string, Promise<readonly string[]>>();
  return async function lookupAsnNetworks(
    { asn, }: { readonly asn: string; },
  ): Promise<readonly string[]> {
    /**
     * Existing coalesced lookup when ASN already appeared in either input set.
     */
    const existing = lookupPromises.get(asn,);
    if (existing !== undefined)
      return await existing;
    /**
     * New lookup registered before awaiting so concurrent duplicate entries share it.
     */
    const pending = lookupConfiguredAsn({ asn, },);
    lookupPromises.set(
      asn,
      pending,
    );
    return await pending;
  };
}
