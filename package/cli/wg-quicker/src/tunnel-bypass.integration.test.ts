import assert from 'node:assert/strict';

import { wait, } from '@monochromatic-dev/module-async-time/ts';

import {
  readFixtureState,
  runBypassOperation,
  runBypassOperationAllowingFailure,
  runNamespaceIp,
  runSudo,
  runSudoAllowingFailure,
  type BypassFixture,
} from './tunnel-bypass-command-fixture.ts';
import { createBypassFixture, } from './tunnel-bypass.integration-fixture.ts';

/**
 * Exempt socket mark used by all routing checks.
 */
const EXEMPT_MARK = 8_888;

/**
 * Maximum bounded route-watcher readiness probes.
 */
const WATCH_PROBE_ATTEMPTS = 100;

/**
 * Delay between route-watcher probes.
 */
const WATCH_PROBE_DELAY_MS = 10;

/**
 * Adds bypass state through built artifact.
 *
 * @param fixture - Disposable namespace.
 *
 * @param watchRouteChanges - Whether detached watcher starts.
 *
 * @example
 * ```ts
 * addBypass({ fixture, watchRouteChanges: false });
 * ```
 */
async function addBypass(
  {
    fixture,
    watchRouteChanges,
  }: {
    readonly fixture: BypassFixture;
    readonly watchRouteChanges: boolean;
  },
): Promise<void> {
  await runBypassOperation({
    fixture,
    source: `await addExemptRule({ interfaceName: 'wgtest', mark: ${String(EXEMPT_MARK,)}, watchRouteChanges: ${String(watchRouteChanges,)} });`,
  },);
}

/**
 * Removes bypass state through built artifact.
 *
 * @param fixture - Disposable namespace.
 *
 * @example
 * ```ts
 * removeBypass({ fixture });
 * ```
 */
async function removeBypass(
  { fixture, }: { readonly fixture: BypassFixture; },
): Promise<void> {
  await runBypassOperation({
    fixture,
    source: "await removeExemptRule({ interfaceName: 'wgtest' });",
  },);
}

/**
 * Reads detached watcher PID from root-owned sidecar.
 *
 * @param fixture - Disposable namespace.
 *
 * @returns Registered watcher PID.
 *
 * @example
 * ```ts
 * watcherPid({ fixture });
 * ```
 */
async function watcherPid(
  { fixture, }: { readonly fixture: BypassFixture; },
): Promise<number> {
  /**
   * Parsed watcher sidecar.
   */
  const value: unknown = JSON.parse(await runSudo({
    args: [
      'cat',
      `${fixture.statePath}.watcher.json`,
    ],
  },),);
  if (((typeof value) !== 'object')
    || (value === null)
    || (!('pid' in value))
    || ((typeof value.pid) !== 'number')) {
    throw new Error('Watcher sidecar lacks numeric PID.',);
  }
  return value.pid;
}

/**
 * Waits until watcher table follows secondary physical interface.
 *
 * @param fixture - Disposable namespace.
 *
 * @param table - Claimed bypass table.
 *
 * @example
 * ```ts
 * await waitForSecondaryRoute({ fixture, table: 52002 });
 * ```
 */
async function waitForSecondaryRoute(
  {
    fixture,
    table,
  }: {
    readonly fixture: BypassFixture;
    readonly table: number;
  },
): Promise<void> {
  /**
   * Mutable bounded probe count.
   */
  const cursor = { attempt: 0, };
  while (cursor.attempt < WATCH_PROBE_ATTEMPTS) {
    /**
     * Current IPv4 bypass defaults.
     */
    // oxlint-disable-next-line no-await-in-loop -- polling must observe route state after each bounded delay.
    const routes = await runNamespaceIp({
      fixture,
      args: [
        '-4',
        'route',
        'show',
        'table',
        String(table,),
      ],
    },);
    if (routes.includes(`dev ${fixture.peerSecondary}`,)
      && (!routes.includes(`dev ${fixture.peerPrimary}`,)))
      return;
    // oxlint-disable-next-line eslint/no-await-in-loop -- Bounded watcher readiness probe avoids busy spin.
    await wait(WATCH_PROBE_DELAY_MS,);
    cursor.attempt += 1;
  }
  throw new Error('Detached bypass watcher did not synchronize changed default route.',);
}

await using fixture = await createBypassFixture();

//region Dynamic ownership and full-tunnel shapes

await runNamespaceIp({
  fixture,
  args: [
    '-4',
    'route',
    'add',
    'blackhole',
    '203.0.113.0/24',
    'table',
    '52000',
  ],
},);
await addBypass({
  fixture,
  watchRouteChanges: false,
},);
/**
 * State proving occupied table 52000 was skipped.
 */
const firstState = await readFixtureState({ fixture, },);
assert.equal(firstState.table, 52_001,);
await runNamespaceIp({ fixture, args: ['route', 'add', '0.0.0.0/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['route', 'add', '128.0.0.0/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'add', '::/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'add', '8000::/1', 'dev', 'wgtest',], },);
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'get', '8.8.8.8',], },)).includes('dev wgtest',));
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'get', '8.8.8.8', 'mark', String(EXEMPT_MARK,),], },)).includes(`table ${String(firstState.table,)}`,));
assert.ok((await runNamespaceIp({ fixture, args: ['-6', 'route', 'get', '2001:4860:4860::8888',], },)).includes('dev wgtest',));
assert.ok((await runNamespaceIp({ fixture, args: ['-6', 'route', 'get', '2001:4860:4860::8888', 'mark', String(EXEMPT_MARK,),], },)).includes(`table ${String(firstState.table,)}`,));
await runNamespaceIp({ fixture, args: ['route', 'delete', '0.0.0.0/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['route', 'delete', '128.0.0.0/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'delete', '::/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'delete', '8000::/1', 'dev', 'wgtest',], },);
await runNamespaceIp({ fixture, args: ['-4', 'route', 'add', 'default', 'dev', 'wgtest', 'table', '51820',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'add', 'default', 'dev', 'wgtest', 'table', '51820',], },);
await runNamespaceIp({ fixture, args: ['-4', 'rule', 'add', 'not', 'fwmark', '51820', 'table', '51820', 'pref', '1000',], },);
await runNamespaceIp({ fixture, args: ['-6', 'rule', 'add', 'not', 'fwmark', '51820', 'table', '51820', 'pref', '1000',], },);
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'get', '8.8.8.8',], },)).includes('table 51820',));
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'get', '8.8.8.8', 'mark', String(EXEMPT_MARK,),], },)).includes(`table ${String(firstState.table,)}`,));
assert.ok((await runNamespaceIp({ fixture, args: ['-6', 'route', 'get', '2001:4860:4860::8888',], },)).includes('table 51820',));
assert.ok((await runNamespaceIp({ fixture, args: ['-6', 'route', 'get', '2001:4860:4860::8888', 'mark', String(EXEMPT_MARK,),], },)).includes(`table ${String(firstState.table,)}`,));

//endregion Dynamic ownership and full-tunnel shapes

//region Exact teardown ownership

await runNamespaceIp({ fixture, args: ['-4', 'route', 'add', 'blackhole', '198.18.0.0/15', 'table', String(firstState.table,), 'proto', 'boot',], },);
await removeBypass({ fixture, },);
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'show', 'table', '52000',], },)).includes('blackhole 203.0.113.0/24',));
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'show', 'table', String(firstState.table,),], },)).includes('blackhole 198.18.0.0/15',));
assert.equal((await runNamespaceIp({ fixture, args: ['-4', 'rule', 'show',], },)).includes(`fwmark 0x22b8 lookup ${String(firstState.table,)}`,), false,);

//endregion Exact teardown ownership

//region Detached route-change watcher

await addBypass({
  fixture,
  watchRouteChanges: true,
},);
/**
 * State after two deliberately occupied bypass tables.
 */
const watcherState = await readFixtureState({ fixture, },);
assert.equal(watcherState.table, 52_002,);
/**
 * Detached watcher PID expected to disappear during teardown.
 */
const detachedPid = await watcherPid({ fixture, },);
await runNamespaceIp({ fixture, args: ['route', 'replace', 'default', 'via', '198.51.101.1', 'dev', fixture.peerSecondary, 'metric', '50',], },);
await runNamespaceIp({ fixture, args: ['route', 'delete', 'default', 'via', '198.51.100.1', 'dev', fixture.peerPrimary, 'metric', '100',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'replace', 'default', 'via', '2001:db8:2::1', 'dev', fixture.peerSecondary, 'metric', '50',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'delete', 'default', 'via', '2001:db8:1::1', 'dev', fixture.peerPrimary, 'metric', '100',], },);
await waitForSecondaryRoute({
  fixture,
  table: watcherState.table,
},);
assert.ok((await runNamespaceIp({ fixture, args: ['-4', 'route', 'get', '8.8.8.8', 'mark', String(EXEMPT_MARK,),], },)).includes(`dev ${fixture.peerSecondary}`,));
assert.ok((await runNamespaceIp({ fixture, args: ['-6', 'route', 'get', '2001:4860:4860::8888', 'mark', String(EXEMPT_MARK,),], },)).includes(`dev ${fixture.peerSecondary}`,));
await removeBypass({ fixture, },);
assert.notEqual((await runSudoAllowingFailure({ args: ['test', '-e', `/proc/${String(detachedPid,)}`,], },)).exitCode, 0,);

//endregion Detached route-change watcher

//region Missing physical defaults and single-family fail-closed route

await runNamespaceIp({ fixture, args: ['route', 'delete', 'default', 'via', '198.51.101.1', 'dev', fixture.peerSecondary, 'metric', '50',], },);
await runNamespaceIp({ fixture, args: ['-6', 'route', 'delete', 'default', 'via', '2001:db8:2::1', 'dev', fixture.peerSecondary, 'metric', '50',], },);
/**
 * Expected setup failure with no physical default in either family.
 */
const missingDefault = await runBypassOperationAllowingFailure({
  fixture,
  source: `await addExemptRule({ interfaceName: 'wgtest', mark: ${String(EXEMPT_MARK,)}, watchRouteChanges: false });`,
},);
assert.notEqual(missingDefault.exitCode, 0,);
assert.ok(missingDefault.stderr.includes('no IPv4 or IPv6 physical default route exists',));
assert.notEqual((await runSudoAllowingFailure({ args: ['test', '-e', fixture.statePath,], },)).exitCode, 0,);
await runNamespaceIp({ fixture, args: ['route', 'add', 'default', 'via', '198.51.100.1', 'dev', fixture.peerPrimary, 'metric', '100',], },);
await addBypass({
  fixture,
  watchRouteChanges: false,
},);
/**
 * State for IPv4-only physical connectivity.
 */
const singleFamilyState = await readFixtureState({ fixture, },);
assert.ok((await runNamespaceIp({ fixture, args: ['-6', 'route', 'show', 'table', String(singleFamilyState.table,),], },)).includes('unreachable default',));
await removeBypass({ fixture, },);

//endregion Missing physical defaults and single-family fail-closed route

console.log('wg-quicker bypass integration passed',);
