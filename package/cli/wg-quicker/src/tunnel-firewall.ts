import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';

import type { WireguardConfig, } from './config.ts';
import {
  run,
  runAllowingFailure,
} from './runner.ts';
import { makeTempDir, } from './tempdir.ts';
import { splitWords, } from './text.ts';
import { isV6, } from './tunnel-util.ts';

/**
 * Installs the nft kill-switch so non-tunnel packets to interface addresses drop.
 *
 * @param config - Parsed config (addresses drive the drop rules).
 *
 * @param table - Policy table whose fwmark identifies tunnel-bound packets.
 *
 * @example
 * ```ts
 * await addKillSwitch({ config, table: 51820 });
 * ```
 */
export async function addKillSwitch(
  {
    config,
    table,
  }: {
    readonly config: WireguardConfig;
    readonly table: number;
  },
): Promise<void> {
  /**
   * Interface receiving the kill-switch.
   */
  const iface = config.interfaceName;
  /**
   * Name of the dedicated nft table for this interface.
   */
  const nftable = `wg-quicker-${iface}`;
  /**
   * nft statements built up and applied atomically via `nft -f`.
   */
  const statements: string[] = [`add table inet ${nftable}`,];
  for (const proto of [
    'ip',
    'ip6',
  ] as const) {
    statements.push(
      `add chain inet ${nftable} preraw_${proto} { type filter hook prerouting priority -300; }`,
    );
    for (const address of config.addresses) {
      /**
       * Bare address without its prefix length.
       */
      const addr = address.slice(
        0,
        address.indexOf('/',),
      );
      /**
       * Address family token matching the current protocol chain.
       */
      const family = isV6({ prefix: addr, },) ? 'ip6' : 'ip';
      if (family === proto)
        statements.push(
          `add rule inet ${nftable} preraw_${proto} iifname != "${iface}" ${proto} daddr ${addr} fib saddr type != local drop`,
        );
    }
  }
  statements.push(
    `add chain inet ${nftable} postmangle { type filter hook postrouting priority -150; }`,
    `add rule inet ${nftable} postmangle meta l4proto udp meta mark ${String(table,)} ct mark set mark`,
    `add chain inet ${nftable} premangle { type filter hook prerouting priority -150; }`,
    `add rule inet ${nftable} premangle meta l4proto udp meta mark set ct mark`,
  );
  /**
   * Temp file holding the nft script; `nft -f` reads a seekable file as
   * `/dev/stdin`, which a pipe from a spawned child is not.
   */
  await using dir = await makeTempDir();
  /**
   * Path of the nft script file.
   */
  const scriptPath = join(
    dir.path,
    'kill-switch.nft',
  );
  await writeFile(
    scriptPath,
    `${statements.join('\n',)}\n`,
  );
  await run({
    command: 'nft',
    args: [
      '-f',
      scriptPath,
    ],
  },);
}

/**
 * Removes the nft kill-switch table, idempotently.
 *
 * @param interfaceName - Interface whose kill-switch table is deleted.
 *
 * @example
 * ```ts
 * await removeKillSwitch({ interfaceName: 'wg0' });
 * ```
 */
export async function removeKillSwitch(
  { interfaceName, }: { readonly interfaceName: string; },
): Promise<void> {
  await runAllowingFailure({
    command: 'nft',
    args: [
      'delete',
      'table',
      'inet',
      `wg-quicker-${interfaceName}`,
    ],
  },);
}

/**
 * Routing table number holding the captured physical default for exempt traffic.
 */
const BYPASS_TABLE = 100;

/**
 * Priority of the exempt rule, evaluated before the main-table default.
 */
const EXEMPT_PREF = '50';

/**
 * Reads the current physical default route so exempt traffic can be sent to it.
 *
 * @returns The default route's destination spec, or empty when none exists.
 *
 * @example
 * ```ts
 * await readPhysicalDefault();
 * ```
 */
async function readPhysicalDefault(): Promise<readonly string[]> {
  /**
   * Default-route listing for IPv4.
   */
  const result = await runAllowingFailure({
    command: 'ip',
    args: [
      '-4',
      'route',
      'show',
      'default',
    ],
  },);
  /**
   * First default route line, when present.
   */
  const [line,] = result.stdout
    .split('\n',)
    .filter(function nonempty(entry,): boolean {
      return entry.trim() !== '';
    },);
  if (line === undefined)
    return [];
  /**
   * Route tokens after the leading `default`, split on whitespace runs.
   */
  return splitWords({ line: line.trim(), },)
    .slice(1,);
}

/**
 * Installs the policy rule that sends exempt-marked traffic to the physical link.
 *
 * The physical default route is captured into a dedicated bypass table and the
 * rule directs marked packets there. This bypasses the tunnel both for a `/0`
 * full tunnel and for a full-tunnel-by-exclusion config whose covered routes
 * would otherwise override the main-table default and defeat the exemption.
 *
 * @param mark - Socket mark identifying exempt (bypass) traffic.
 *
 * @example
 * ```ts
 * await addExemptRule({ mark: 8888 });
 * ```
 */
export async function addExemptRule(
  { mark, }: { readonly mark: number; },
): Promise<void> {
  /**
   * Physical default route tokens captured before the tunnel is routed.
   */
  const physical = await readPhysicalDefault();
  if (physical.length > 0)
    await runAllowingFailure({
      command: 'ip',
      args: [
        '-4',
        'route',
        'add',
        'default',
        ...physical,
        'table',
        String(BYPASS_TABLE,),
      ],
    },);
  await Promise.all([
    '-4',
    '-6',
  ].map(function install(proto,): Promise<unknown> {
    return runAllowingFailure({
      command: 'ip',
      args: [
        proto,
        'rule',
        'add',
        'fwmark',
        String(mark,),
        'table',
        String(BYPASS_TABLE,),
        'pref',
        EXEMPT_PREF,
      ],
    },);
  },),);
}

/**
 * Removes the exempt-mark policy rule and the captured bypass route.
 *
 * @param mark - Socket mark identifying exempt (bypass) traffic.
 *
 * @example
 * ```ts
 * await removeExemptRule({ mark: 8888 });
 * ```
 */
export async function removeExemptRule(
  { mark, }: { readonly mark: number; },
): Promise<void> {
  await Promise.all([
    '-4',
    '-6',
  ].map(function remove(proto,): Promise<unknown> {
    return runAllowingFailure({
      command: 'ip',
      args: [
        proto,
        'rule',
        'delete',
        'fwmark',
        String(mark,),
        'table',
        String(BYPASS_TABLE,),
        'pref',
        EXEMPT_PREF,
      ],
    },);
  },),);
  await runAllowingFailure({
    command: 'ip',
    args: [
      '-4',
      'route',
      'flush',
      'table',
      String(BYPASS_TABLE,),
    ],
  },);
}
