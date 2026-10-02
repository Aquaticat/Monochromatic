/**
 Gated disposable-host verification for model retirement.

 Boots a real pi host in a throwaway home with a credential-free `models.json` that
 overrides one context window, loads the probe extension before the built one, and
 asserts what filtering a live catalog actually did. Gated by
 `PI_MODEL_RETIREMENT_VERIFY_HOST=1` so ordinary runs never spawn a host.

 @module
 */

import { fileURLToPath, } from 'node:url';
import {
  createDisposableHome,
  KEEPER_MODEL,
  OVERRIDDEN_CONTEXT_WINDOW,
  piCliPath,
  readSnapshots,
  removeDisposableHome,
  RETIRED_MODEL,
  runDisposableHost,
  TARGET_PROVIDER,
  WRAPPED_KEPT,
  WRAPPED_PROVIDER,
  WRAPPED_RETIRED,
  type Snapshot,
} from './disposable-host.ts';

//region Constants

/**
 Environment variable that arms this verification.
 */
const GATE_VARIABLE = 'PI_MODEL_RETIREMENT_VERIFY_HOST';

/**
 Character count of stderr quoted when the host reports no snapshots.
 */
const STDERR_TAIL_CHARS = 1_200;

//endregion Constants

//region Types

/**
 Assertion outcomes collected during one run.
 */
type Checks = {
  /**
   Claims that held, each with the measured value behind it.
   */
  readonly passes: string[];
  /**
   Claims that did not hold, each with the measured value behind it.
   */
  readonly failures: string[];
};

//endregion Types

//region Assertions

/**
 Record one assertion outcome.

 @param checks - collector the outcome is written to

 @param label - what the assertion claims

 @param ok - whether the claim held

 @param detail - measured value the reader needs when the claim did not hold

 @example
 ```typescript
 check({ checks, label: 'catalog shrank', ok: true, detail: '1532 -> 1017' });
 ```
 */
function check(
  {
    checks,
    label,
    ok,
    detail,
  }: {
    readonly checks: Checks;
    readonly label: string;
    readonly ok: boolean;
    readonly detail: string;
  },
): void {
  if (ok)
    checks.passes
      .push(`${label}: ${detail}`,);
  else
    checks.failures
      .push(`${label}: ${detail}`,);
}

/**
 Assert the two snapshots against each other.

 @param checks - collector the outcomes are written to

 @param before - snapshot taken before the retirement pass ran

 @param after - snapshot taken after the retirement pass ran

 @example
 ```typescript
 assertSnapshots({ checks, before, after });
 ```
 */
function assertSnapshots(
  {
    checks,
    before,
    after,
  }: {
    readonly checks: Checks;
    readonly before: Snapshot;
    readonly after: Snapshot;
  },
): void {
  check({
    checks,
    label: 'catalog readable before filtering',
    ok: before.chatCount > 0,
    detail: `${String(before.chatCount)} chat models`,
  },);
  check({
    checks,
    label: 'filtering shrank the catalog',
    ok: after.chatCount < before.chatCount,
    detail: `${String(before.chatCount)} -> ${String(after.chatCount)} chat models`,
  },);
  check({
    checks,
    label: 'retired model present before',
    ok: before.hasRetired,
    detail: `${TARGET_PROVIDER}/${RETIRED_MODEL} present=${String(before.hasRetired,)}`,
  },);
  check({
    checks,
    label: 'retired model absent after',
    ok: !after.hasRetired,
    detail: `${TARGET_PROVIDER}/${RETIRED_MODEL} present=${String(after.hasRetired,)}`,
  },);
  check({
    checks,
    label: 'keeper survives filtering',
    ok: after.hasKeeper,
    detail: `${TARGET_PROVIDER}/${KEEPER_MODEL} present=${String(after.hasKeeper,)}`,
  },);
  check({
    checks,
    label: 'models.json override applied before filtering',
    ok: before.targetContextWindow === OVERRIDDEN_CONTEXT_WINDOW,
    detail: `contextWindow ${String(before.targetContextWindow,)}`,
  },);
  check({
    checks,
    label: 'models.json override survives re-registration',
    ok: after.targetContextWindow === OVERRIDDEN_CONTEXT_WINDOW,
    detail: `contextWindow ${String(after.targetContextWindow,)} against bundled 272000`,
  },);
  check({
    checks,
    label: 'thinking levels survive re-registration',
    ok: (after.targetThinkingLevels > 0)
      && (after.targetThinkingLevels === before.targetThinkingLevels),
    detail: `${String(before.targetThinkingLevels,)} -> ${String(after.targetThinkingLevels,)} levels`,
  },);
  check({
    checks,
    label: 'image models survive re-registration',
    ok: after.imageCount === before.imageCount,
    detail: `${String(before.imageCount,)} -> ${String(after.imageCount,)}`,
  },);
  check({
    checks,
    label: 'classifier models survive re-registration',
    ok: after.classifierCount === before.classifierCount,
    detail: `${String(before.classifierCount,)} -> ${String(after.classifierCount,)}`,
  },);
  check({
    checks,
    label: 'endpoint-less provider present before wrapping',
    ok: before.hasWrappedRetired,
    detail: `${WRAPPED_PROVIDER}/${WRAPPED_RETIRED} present=${String(before.hasWrappedRetired,)}`,
  },);
  check({
    checks,
    label: 'wrapping filters a provider whose models carry no baseUrl',
    ok: !after.hasWrappedRetired,
    detail: `${WRAPPED_PROVIDER}/${WRAPPED_RETIRED} present=${String(after.hasWrappedRetired,)}`,
  },);
  check({
    checks,
    label: 'endpoint-less provider keeps its family winner',
    ok: after.hasWrappedKeeper,
    detail: `${WRAPPED_PROVIDER}/${WRAPPED_KEPT} present=${String(after.hasWrappedKeeper,)}`,
  },);
}

//endregion Assertions

//region Verification

/**
 Run one host and assert what filtering did to a live catalog.

 @returns one line per assertion that passed

 @throws listing every assertion that failed, so one run reports the whole picture

 @example
 ```typescript
 console.log(await verifyInDisposableHost());
 ```
 */
async function verifyInDisposableHost(): Promise<string[]> {
  /**
   Throwaway home holding the fixture models file.
   */
  const host = await createDisposableHome();
  /**
   Disposal that removes the throwaway home however this run ends.
   */
  await using cleanup = {
    async [Symbol.asyncDispose](): Promise<void> {
      await removeDisposableHome({ root: host.root, },);
    },
  };
  void cleanup;
  /**
   Probe source, loaded before the built extension so it sees both states.
   */
  const probe = fileURLToPath(new URL(
    'verify-probe.ts',
    import.meta.url,
  ),);
  /**
   Built artifact pi actually loads.
   */
  const extension = fileURLToPath(new URL(
    '../dist/final/node/index.mjs',
    import.meta.url,
  ),);
  /**
   Host run, which exits on its own once stdin closes.
   */
  const run = await runDisposableHost({
    args: [
      piCliPath(),
      '--mode',
      'rpc',
      '--no-extensions',
      '--extension',
      probe,
      '--extension',
      extension,
    ],
    cwd: host.root,
    env: {
      PATH: process.env
        .PATH
        ?? '',
      HOME: host.home,
      PI_CODING_AGENT_DIR: host.agentDir,
      PI_OFFLINE: '1',
      PI_TELEMETRY: '0',
      PI_SKIP_VERSION_CHECK: '1',
    },
  },);
  /**
   Snapshots the probe reported.
   */
  const snapshots = readSnapshots({ stderr: run.stderr, },);
  /**
   Snapshot taken before the retirement pass ran.
   */
  const before = snapshots.find(function isBeforePhase(snapshot,) {
    return snapshot.phase === 'session_start';
  },);
  /**
   Snapshot taken after the retirement pass ran.
   */
  const after = snapshots.find(function isAfterPhase(snapshot,) {
    return snapshot.phase === 'resources_discover';
  },);
  if ((before === undefined) || (after === undefined)) {
    throw new Error(
      `host reported ${String(snapshots.length,)} probe snapshots, needed session_start and resources_discover; stderr tail: ${run.stderr
        .slice(-STDERR_TAIL_CHARS,)}`,
    );
  }
  /**
   Assertion outcomes for this run.
   */
  const checks: Checks = {
    passes: [],
    failures: [],
  };
  assertSnapshots({
    checks,
    before,
    after,
  },);
  /**
   Whether any provider was left unfiltered, which the pass reports as a skip warning.
   */
  const skipped = run.stderr
    .includes('skipped ',);
  check({
    checks,
    label: 'no provider was skipped',
    ok: !skipped,
    detail: skipped
      ? 'a provider was skipped'
      : 'every provider with retirements was filtered',
  },);
  if (checks.failures
    .length
    > 0)
    throw new Error(`disposable host verification failed:\n${checks.failures
      .join('\n',)}`,);
  return checks.passes;
}

//endregion Verification

//region Entry point

if (process.env[GATE_VARIABLE] !== '1') {
  console.log(`skipped: set ${GATE_VARIABLE}=1 to boot a disposable pi host`,);
} else {
  for (const line of await verifyInDisposableHost())
    console.log(`PASS ${line}`,);
  console.log('model retirement verified in a disposable pi host',);
}

//endregion Entry point
