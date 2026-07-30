import {
  runAllowingFailure,
} from './runner.ts';

/**
 * Address-family flag accepted by the `ip` tool.
 */
type Proto = '-4' | '-6';

/**
 * First routing table number tried for full-tunnel policy routing, matching wg-quick.
 */
const BASE_TABLE = 51_820;

/* oxlint-disable eslint/require-await -- Public async boundary delegates to scanForTable; see doc/lint/require-await-find-free-table.md. */
/**
 * Finds a routing table number not currently used by any policy rule.
 *
 * Mirrors wg-quick's scan starting at 51820 so parallel tunnels never collide.
 *
 * @returns A free table number.
 *
 * @example
 * ```ts
 * await findFreeTable();
 * ```
 */
export async function findFreeTable(): Promise<number> {
  return scanForTable({ candidate: BASE_TABLE, },);
}
/* oxlint-enable eslint/require-await */

/**
 * Probes one candidate table and recurses to the next until a free one is found.
 *
 * @param candidate - Table number to probe.
 *
 * @returns The first table number free of routes and rules.
 *
 * @example
 * ```ts
 * await scanForTable({ candidate: 51820 });
 * ```
 */
async function scanForTable(
  { candidate, }: { readonly candidate: number; },
): Promise<number> {
  /**
   * Trimmed IPv4 routes present in the candidate table.
   */
  const v4 = await showTable({
    proto: '-4',
    candidate,
  },);
  /**
   * Trimmed IPv6 routes present in the candidate table.
   */
  const v6 = await showTable({
    proto: '-6',
    candidate,
  },);
  /**
   * IPv4 rules referencing the candidate table.
   */
  const rules = await runAllowingFailure({
    command: 'ip',
    args: [
      '-4',
      'rule',
      'show',
      'table',
      String(candidate,),
    ],
  },);
  if ((v4 === '') && (v6 === '')
    && (rules.stdout
      .trim()
      === ''))
    return candidate;
  return scanForTable({ candidate: candidate + 1, },);
}

/**
 * Reports the routes present in one table for one address family, trimmed.
 *
 * @param proto - Address family flag.
 *
 * @param candidate - Table number to inspect.
 *
 * @returns Trimmed route listing for the table.
 *
 * @example
 * ```ts
 * await showTable({ proto: '-4', candidate: 51820 });
 * ```
 */
async function showTable(
  {
    proto,
    candidate,
  }: {
    readonly proto: Proto;
    readonly candidate: number;
  },
): Promise<string> {
  /**
   * Route listing for the candidate table.
   */
  const result = await runAllowingFailure({
    command: 'ip',
    args: [
      proto,
      'route',
      'show',
      'table',
      String(candidate,),
    ],
  },);
  return result.stdout
    .trim();
}
