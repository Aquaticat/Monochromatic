import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { CommandError, } from './errors.ts';
import {
  run,
  runAllowingFailure,
} from './runner.ts';
import { splitWords, } from './text.ts';
import {
  BYPASS_PROTOS,
  BYPASS_ROUTE_PROTOCOL,
  type BypassProto,
  type BypassState,
} from './tunnel-bypass-types.ts';

/**
 * Route tokens associated with address family.
 */
type FamilyRoute = {
  readonly proto: BypassProto;
  readonly tokens: readonly string[];
};

/**
 * Metric for unreachable fallback when physical family has no default.
 */
const UNREACHABLE_METRIC = 42_760;

/**
 * Module logger for bypass route synchronization.
 */
const l = tagged({ tag: 'tunnel-bypass-route', },);

/**
 * Removes one key and following value from route token stream.
 *
 * @param tokens - Route tokens to sanitize.
 *
 * @param key - Attribute key whose pair is removed.
 *
 * @returns Fresh tokens without selected pair.
 *
 * @example
 * ```ts
 * removeTokenPair({ tokens: ['default', 'proto', 'dhcp'], key: 'proto' });
 * ```
 */
function removeTokenPair(
  {
    tokens,
    key,
  }: {
    readonly tokens: readonly string[];
    readonly key: string;
  },
): readonly string[] {
  /**
   * Fresh output excluding selected attribute and value.
   */
  const output: string[] = [];
  /**
   * Cursor over flat route token stream.
   */
  const cursor = { index: 0, };
  while (cursor.index < tokens.length) {
    /**
     * Current token,
     * guaranteed by loop bound.
     */
    const token = tokens[cursor.index] ?? '';
    if (token === key) {
      cursor.index += 2;
      continue;
    }
    output.push(token,);
    cursor.index += 1;
  }
  return output;
}

/**
 * Removes volatile and owner-specific attributes from route line.
 *
 * @param line - One `ip route show` line.
 *
 * @returns Stable route tokens suitable for another table.
 *
 * @example
 * ```ts
 * normalizedRoute({ line: 'default via 192.0.2.1 proto dhcp' });
 * ```
 */
function normalizedRoute(
  { line, }: { readonly line: string; },
): readonly string[] {
  /**
   * Raw route tokens.
   */
  const tokens = splitWords({ line: line.trim(), },);
  return removeTokenPair({
    tokens: removeTokenPair({
      tokens: removeTokenPair({
        tokens,
        key: 'table',
      },),
      key: 'proto',
    },),
    key: 'expires',
  },);
}

/**
 * Reads current main-table physical defaults for both families.
 *
 * @returns Stable default route token lists with family.
 *
 * @example
 * ```ts
 * await readPhysicalDefaults();
 * ```
 */
export async function readPhysicalDefaults(): Promise<readonly FamilyRoute[]> {
  /**
   * Main-table listings for both address families.
   */
  const listings = await Promise.all(BYPASS_PROTOS.map(function readFamily(
    proto: BypassProto,
  ): Promise<{
    readonly proto: BypassProto;
    readonly stdout: string
  }> {
    return (async function read(): Promise<{
      readonly proto: BypassProto;
      readonly stdout: string;
    }> {
      /**
       * Main-table default listing.
       */
      const { stdout, } = await run({
        command: 'ip',
        args: [
          proto,
          'route',
          'show',
          'table',
          'main',
          'default',
        ],
      },);
      return {
        proto,
        stdout,
      };
    })();
  },),);
  /**
   * Stable routes preserving main-table output order.
   */
  const routes: FamilyRoute[] = [];
  for (const {
    proto,
    stdout,
  } of listings) {
    for (const line of stdout.split('\n',)) {
      if (line.trim() === '')
        continue;
      /**
       * Normalized default route tokens.
       */
      const tokens = normalizedRoute({ line, },);
      if (tokens[0] === 'default')
        routes.push({
          proto,
          tokens,
        },);
    }
  }
  return routes;
}

/**
 * Produces desired owned defaults,
 * adding unreachable fallback for absent family.
 *
 * @param physical - Current physical defaults.
 *
 * @returns Desired route tokens for both address families.
 *
 * @example
 * ```ts
 * desiredFamilyRoutes({ physical: [] });
 * ```
 */
function desiredFamilyRoutes(
  { physical, }: { readonly physical: readonly FamilyRoute[]; },
): readonly FamilyRoute[] {
  /**
   * Desired routes copied away from caller-owned collection.
   */
  const desired: FamilyRoute[] = [];
  for (const route of physical) {
    desired.push({
      proto: route.proto,
      tokens: [...route.tokens,],
    },);
  }
  for (const proto of BYPASS_PROTOS) {
    /**
     * Whether current family has at least one physical default.
     */
    const present = physical.some(function sameFamily(route,): boolean {
      return route.proto === proto;
    },);
    if (present)
      continue;
    desired.push({
      proto,
      tokens: [
        'unreachable',
        'default',
        'metric',
        String(UNREACHABLE_METRIC,),
      ],
    },);
  }
  return desired;
}

/**
 * Adds table and protocol ownership attributes to desired route.
 *
 * @param route - Stable desired route.
 *
 * @param table - Claimed bypass table.
 *
 * @returns Route tokens accepted by `ip route replace`.
 *
 * @example
 * ```ts
 * ownedRouteTokens({ route, table: 52000 });
 * ```
 */
function ownedRouteTokens(
  {
    route,
    table,
  }: {
    readonly route: FamilyRoute;
    readonly table: number;
  },
): readonly string[] {
  return [
    ...route.tokens,
    'table',
    String(table,),
    'proto',
    String(BYPASS_ROUTE_PROTOCOL,),
  ];
}

/**
 * Reads routes carrying bypass protocol in claimed table.
 *
 * @param table - Persisted table ownership.
 *
 * @returns Exact displayed routes with families.
 *
 * @example
 * ```ts
 * await readOwnedRoutes({ table: 52000 });
 * ```
 */
async function readOwnedRoutes(
  { table, }: { readonly table: number; },
): Promise<readonly FamilyRoute[]> {
  /**
   * Owned-route listings for both families.
   */
  const listings = await Promise.all(BYPASS_PROTOS.map(function readFamily(
    proto: BypassProto,
  ): Promise<{
    readonly proto: BypassProto;
    readonly stdout: string
  }> {
    return (async function read(): Promise<{
      readonly proto: BypassProto;
      readonly stdout: string;
    }> {
      /**
       * Exact route-show arguments retained for failure translation.
       */
      const args = [
        proto,
        'route',
        'show',
        'table',
        String(table,),
        'proto',
        String(BYPASS_ROUTE_PROTOCOL,),
        'default',
      ] as const;
      /**
       * Routes filtered by exact table and protocol.
       */
      const result = await runAllowingFailure({
        command: 'ip',
        args,
      },);
      if ((result.exitCode !== 0) && (!result.stderr
        .includes('FIB table does not exist',))) {
        throw new CommandError({
          command: 'ip',
          args,
          exitCode: result.exitCode,
          stderr: result.stderr,
        },);
      }
      return {
        proto,
        stdout: result.exitCode === 0 ? result.stdout : '',
      };
    })();
  },),);
  /**
   * Exact route tokens suitable for deletion.
   */
  const routes: FamilyRoute[] = [];
  for (const {
    proto,
    stdout,
  } of listings) {
    for (const line of stdout.split('\n',)) {
      if (line.trim() !== '') {
        routes.push({
          proto,
          tokens: [
            ...splitWords({ line: line.trim(), },),
            'table',
            String(table,),
          ],
        },);
      }
    }
  }
  return routes;
}

/**
 * Builds stable comparison key for family route.
 *
 * @param proto - Address family.
 *
 * @param text - Space-separated route tokens.
 *
 * @returns Family-prefixed normalized text.
 *
 * @example
 * ```ts
 * routeKey({ proto: '-4', text: 'default via 192.0.2.1' });
 * ```
 */
function routeKey(
  {
    proto,
    text,
  }: {
    readonly proto: BypassProto;
    readonly text: string;
  },
): string {
  return `${proto}:${normalizedRoute({ line: text, })
    .join(' ',)}`;
}

/**
 * Synchronizes claimed bypass table to current physical defaults.
 *
 * New routes are installed before stale owned routes are deleted.
 * Missing family receives unreachable default so marked traffic cannot fall through to VPN policy.
 *
 * @param state - Persisted table ownership.
 *
 * @returns Number of physical defaults observed.
 *
 * @example
 * ```ts
 * await synchronizeBypassRoutes({ state });
 * ```
 */
export async function synchronizeBypassRoutes(
  { state, }: { readonly state: BypassState; },
): Promise<number> {
  /**
   * Function-scoped logger for one synchronization.
   */
  const fl = tagged({
    tag: synchronizeBypassRoutes.name,
    l,
  },);
  /**
   * Claimed table copied from caller state before external operations.
   */
  const { table, } = state;
  /**
   * Current physical defaults before owned table mutation.
   */
  const physical = await readPhysicalDefaults();
  /**
   * Desired routes for both families.
   */
  const desired = desiredFamilyRoutes({ physical, },);
  /**
   * Owned routes before replacement for stale cleanup.
   */
  const previous = await readOwnedRoutes({ table, },);
  for (const route of desired) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- Route replacement order preserves connectivity before stale deletion.
    await run({
      command: 'ip',
      args: [
        route.proto,
        'route',
        'replace',
        ...ownedRouteTokens({
          route,
          table,
        },),
      ],
    },);
  }
  /**
   * Desired normalized identities used to retain routes after replacement.
   */
  const desiredKeys = new Set<string>();
  for (const route of desired) {
    /**
     * Fresh token copy before joining through default-library boundary.
     */
    const tokens = [...route.tokens,];
    desiredKeys.add(routeKey({
      proto: route.proto,
      text: tokens.join(' ',),
    },),);
  }
  for (const route of previous) {
    /**
     * Fresh token copy before joining through default-library boundary.
     */
    const tokens = [...route.tokens,];
    if (desiredKeys.has(routeKey({
      proto: route.proto,
      text: tokens.join(' ',),
    },),))
      continue;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Exact stale route deletions are independent but sequential errors are tolerated and logged by runner.
    await runAllowingFailure({
      command: 'ip',
      args: [
        route.proto,
        'route',
        'delete',
        ...route.tokens,
      ],
    },);
  }
  fl.debug(`synchronized ${String(physical.length,)} physical default route(s)`,);
  return physical.length;
}

/**
 * Deletes only protocol-tagged defaults from owned table.
 *
 * Unrelated routes and table contents are never flushed.
 *
 * @param state - Persisted table ownership.
 *
 * @example
 * ```ts
 * await removeOwnedBypassRoutes({ state });
 * ```
 */
export async function removeOwnedBypassRoutes(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  /**
   * Exact owned routes present at teardown.
   */
  const routes = await readOwnedRoutes({ table: state.table, },);
  /**
   * Pending exact route deletions.
   */
  const removals: Promise<unknown>[] = [];
  for (const route of routes) {
    removals.push(runAllowingFailure({
      command: 'ip',
      args: [
        route.proto,
        'route',
        'delete',
        ...route.tokens,
      ],
    },),);
  }
  await Promise.all(removals,);
}
