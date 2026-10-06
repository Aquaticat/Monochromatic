/**
 Guards the bounds tests set on the real clock (`mistake-prevention.md`,
 "Tests on the real clock"). A test that drives scripted work under a
 wall-clock bound fails when a loaded machine outlasts the bound, for a reason
 the case's name never states: a 5,000 ms signal on a whole drive of two
 scripted slices ran out before the drive did, twice under load (commit
 `5086b6c6f`), and two 100 ms grace windows a 30 ms voice had to land inside
 could be outrun (ledger B318). A
 bound that only stops a hang is `HANG_STOP_MS` (`hang-stop.test-fixture.ts`),
 60,000 ms, which no case waits for; any other bound a test writes is a choice
 a reader must see the reason for.

 WHAT THE SCAN READS, in test files and test fixtures only: the argument of
 `AbortSignal.timeout`; the delay of a global `setTimeout` or `setInterval`;
 the first argument of `setTimeout` imported from `node:timers/promises` and
 of `wait` imported from `@monochromatic-dev/module-async-time/ts`, under any
 local name; and the value of an object literal's key, or the default of a
 destructured parameter, named in `BOUND_KEYS`: the per-call deadlines, grace
 windows, stream bounds, caps, budgets, holds and the runner's own `timeout`
 that production arms a timer with or compares elapsed time against. A read
 whose value is the shared constant, imported from its fixture under any
 local name, is left alone; every other value, a number, another constant,
 a parameter handed on or an expression, is a finding, keyed
 `path#site: form value`, where the site is the nearest enclosing named
 function, `<module>` outside one.

 OUT OF ITS REACH: a timer reached through `globalThis` or another object,
 a key outside `BOUND_KEYS` (a retry backoff, a poll interval, a field a
 report reads), a duration handed through an environment variable as text,
 an elapsed time a case measures with `performance.now` and compares, and a
 sleep inside a child process's script text. Waits a case's work takes, such
 as `baseMs` or `pollMs`, are left out on purpose: load only lengthens them,
 and a race against one shows up at the bound or the sleep on its other side.

 THE LISTED BOUNDS name every finding that stands, with how many times its
 key occurs, its class (`reached`: a bound a case means to reach, whose work
 cannot end before it on any machine; `read back`: a value a case asserts or
 reads back, such as a production default or a field of a record; `other`:
 what it is, said in the reason) and why. A listed key the source no longer
 holds as often fails the scan, so the list cannot outlive its reasons. The
 files in `DEFERRED` are another change's to edit first: their findings are
 not listed one by one, and a deferred file that no longer holds a finding
 fails the scan until its line is removed.

 THE FIXTURE CASE COMES FIRST, so the package-wide case is read against a
 scan shown able to find each form (ledger M21). Fixtures are cat-themed; the
 package case reads this package's own tests.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  childNodes,
  identifierName,
  isTreeNode,
  literalText,
  memberName,
  parseSource,
  readPackageSource,
  resolveSpecifier,
  type SourceText,
  type TreeNode,
  unwrapped,
} from './source-scan.test-fixture.ts';
import { expectFindingsAsListed, } from './scan-findings.test-fixture.ts';

//region Real-clock bounds
// The scan itself: which nodes set a bound on the real clock, which value is
// the shared hang stop, and the walk that keys each other bound by its file,
// its enclosing named function, its form and its value.

/**
 Path of the fixture that declares the shared hang stop, relative to `src`.
 */
const HANG_STOP_PATH = 'hang-stop.test-fixture.ts';

/**
 Name the fixture exports the shared hang stop under.
 */
const HANG_STOP_NAME = 'HANG_STOP_MS';

/**
 Option keys production arms a timer with, or compares elapsed time against.
 */
const BOUND_KEYS: ReadonlySet<string> = new Set([
  'boundMs',
  'cooldownMs',
  'exchangeTimeoutMs',
  'firstByteMs',
  'freshForMs',
  'graceMs',
  'hardCapMs',
  'idleMs',
  'modelHoldMs',
  'perCallTimeoutMs',
  'rateLimitBackoffMs',
  'runBudgetMs',
  'softBudgetMs',
  'statedWaitMs',
  'streamBoundMsOverride',
  'streamFirstByteMs',
  'streamIdleMs',
  'timeout',
  'timeoutMs',
  'windowMs',
],);

/**
 Node kinds that open a named function, which names the site of the bounds
 inside.
 */
const NAMING_KINDS: ReadonlySet<string> = new Set([
  'FunctionDeclaration',
  'FunctionExpression',
],);

/**
 What a listed bound is, as the census of 2026-10-06 (UTC) sorted them.
 */
type BoundClass = 'reached' | 'read back' | 'other';

/**
 A bound that stands with a value of its own.
 */
type ListedBound = {
  /**
   How many reads the key stands for in its file.
   */
  readonly count: number;

  /**
   What the bound is.
   */
  readonly bound: BoundClass;

  /**
   Why it keeps its own value.
   */
  readonly reason: string;
};

/**
 Why a deferred file's bounds wait: changes in flight on 2026-10-06 (UTC)
 edit it, and the census's rule is applied to it once they have merged.
 */
const DEFERRED_REASON = 'other changes in flight edit this file; its bounds take the census\'s rule once they merge';

/**
 Files another change edits first, each with why its bounds wait.
 */
const DEFERRED: Readonly<Record<string, string>> = {
  'corpus-run/coverage-probe-run.unit.test.ts': DEFERRED_REASON,
  'corpus-run/recall-benchmark-run.unit.test.ts': DEFERRED_REASON,
  'corpus-run/sentinel-probe-run.unit.test.ts': DEFERRED_REASON,
  'corpus-run/settled-carve.unit.test.ts': DEFERRED_REASON,
  'corpus-run/translate-probe-run.unit.test.ts': DEFERRED_REASON,
  'corpus-run/window-trial-probe-run.unit.test.ts': DEFERRED_REASON,
  'stage-round.unit.test.ts': DEFERRED_REASON,
};

/**
 Why a field of a record keeps its value: the case builds an error, a stream
 progress reading or a log line with it and reads it back, and nothing arms a
 timer with it.
 */
const RECORD_FIELD = 'a field of a record or a stream progress reading the case builds and reads back; '
  + 'nothing arms a timer with it';

/**
 Why a call config keeps its value: it is the configuration an artifact
 records, production's per-call deadline written down, which nothing arms.
 */
const CALL_CONFIG = 'the call configuration an artifact records, production\'s per-call deadline as written into '
  + 'the record; nothing arms a timer with it';

/**
 Why a window on an injected clock keeps its value: the case moves that clock
 by hand and reads the window back, and no timer is armed with it.
 */
const SCRIPTED_CLOCK = 'a window on the case\'s own injected clock, which the case moves by hand and reads '
  + 'back; no timer is armed with it';

/**
 Why a launch value keeps its value: the case reads it back in a printed line.
 */
const PRINTED = 'a value the case reads back in a printed line, as given; no timer is armed with it';

/**
 Why a timer turn of length 0 stands: it orders continuations by the event
 loop's turns, not by time.
 */
const TIMER_TURN = 'a timer turn of 0 that lets settled continuations run before the case reads; '
  + 'nothing races it, so its order is the event loop\'s, not the clock\'s';

/**
 Why a meter's hold stands: the overlap it holds for is in place within one
 turn of the event loop.
 */
const SAME_TURN_METER = 'a meter hold whose overlap is in place within one turn of the event loop: '
  + 'the case passes with a hold of microtask turns only and fails with none (census of 2026-10-06), '
  + 'so no timer can fire between the arrivals it waits for';

/**
 Why a serial run's head start stands: at overlap 1 nothing runs beside it.
 */
const SERIAL_HEAD_START = 'a head start in the runs where the driver admits one call at a time, so it only '
  + 'delays; the run at overlap 2 waits on a gate instead';

/**
 Why a parameter handed on is not a value of its own.
 */
const HANDED_ON = 'hands on its caller\'s value, which is read where the caller gives it';

/**
 Bounds that keep a value of their own, keyed `path#site: form value`.
 */
const LISTED: Readonly<Record<string, ListedBound>> = {
  'abandon-kind.unit.test.ts#<module>: firstByteMs: -1': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'abandon-kind.unit.test.ts#<module>: firstByteMs: 40': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'abandon-kind.unit.test.ts#cutWith: firstByteMs: firstByteMs': { count: 1, bound: 'other', reason: HANDED_ON, },
  'absolute-naturalness-review-stage.unit.test.ts#<module>: wait of module-async-time 0': {
    count: 1,
    bound: 'other',
    reason: TIMER_TURN,
  },
  'absolute-naturalness-review-stage.unit.test.ts#reviewClient: wait of module-async-time 30': {
    count: 1,
    bound: 'other',
    reason: 'makes the rejecting seat late: its peers answer in microtasks, so it lands after quorum on any '
      + 'machine, inside a window that is the hang stop',
  },
  'absolute-naturalness-review-stage.unit.test.ts#runReview: graceMs = 0': {
    count: 1,
    bound: 'reached',
    reason: 'the window of 0 the held-seat case reaches: that seat answers only when the case opens its gate after '
      + 'the review settles, and every other seat answers in microtasks, before any timer can close it',
  },
  'absolute-naturalness-review-stage.unit.test.ts#runReview: graceMs: graceMs': {
    count: 1,
    bound: 'other',
    reason: HANDED_ON,
  },
  'all-in-input-order.unit.test.ts#settle: wait of module-async-time 0': { count: 1, bound: 'other', reason: TIMER_TURN, },
  'bedrock-client.unit.test.ts#<module>: exchangeTimeoutMs: 50': {
    count: 1,
    bound: 'reached',
    reason: 'the deadline the case reaches and reads back in the refusal: the transport answers only once its '
      + 'exchange is aborted',
  },
  'bedrock-client.unit.test.ts#<module>: streamBoundMsOverride: TEST_BOUND_MS': {
    count: 2,
    bound: 'reached',
    reason: 'the stream bound two cases cross: one cuts a sleep armed after it and twice as long, which ends after '
      + 'the bound on any machine; in the other both attempts answer at once and the backoff between them outlasts it',
  },
  'bedrock-client.unit.test.ts#queuedPastTheBound: sleepFor of node:timers/promises TEST_BOUND_MS * 2': {
    count: 1,
    bound: 'reached',
    reason: 'the work the stream bound cuts: armed after the bound and twice as long, so the bound ends first on any '
      + 'machine (measured 2026-10-06: timers armed in that order fire in it however long the loop stalls)',
  },
  'call-deadline.unit.test.ts#<module>: timeoutMs: SHORT_DEADLINE_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the deadline the case reaches: armed before the case\'s wait of three times its length, so it fires '
      + 'first on any machine',
  },
  'call-deadline.unit.test.ts#<module>: wait of module-async-time PAST_DEADLINE_MS': {
    count: 2,
    bound: 'reached',
    reason: 'the wait that must outlast a deadline armed before it, three times its length, so the deadline fires '
      + 'first on any machine, and one disposal failed to defuse would fire too',
  },
  'call-deadline.unit.test.ts#armAndDispose: timeoutMs: SHORT_DEADLINE_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the deadline disposal must defuse: armed before the case\'s longer wait, so one disposal left armed '
      + 'fires inside it on any machine',
  },
  'client-log-context.unit.test.ts#note: wait of module-async-time 0': { count: 1, bound: 'other', reason: TIMER_TURN, },
  'client-log-context.unit.test.ts#transport: wait of module-async-time 0': {
    count: 1,
    bound: 'other',
    reason: 'a timer turn that keeps a call in its one slot while the queued calls wait behind it; the order is the '
      + 'slot\'s, not the clock\'s',
  },
  'consolidate-driver.unit.test.ts#driveWith: wait of module-async-time startPosition === 0 ? 20 : 5': {
    count: 1,
    bound: 'other',
    reason: SERIAL_HEAD_START,
  },
  'corpus-run/artifact-two-lane-build.unit.test.ts#catArtifact: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/artifact-two-lane-corpus-verify.unit.test.ts#writeAndRead: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/cap-census-log.test-fixture.ts#streamLine: firstByteMs: 3_644': {
    count: 1,
    bound: 'read back',
    reason: RECORD_FIELD,
  },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: hardCapMs: 120_000': { count: 1, bound: 'read back', reason: PRINTED, },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: hardCapMs: 25_200_000': {
    count: 2,
    bound: 'read back',
    reason: 'production\'s built-in cap of 420 minutes, read back in the launch lines',
  },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: hardCapMs: 450_000': { count: 1, bound: 'read back', reason: PRINTED, },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: hardCapMs: 600_000': { count: 1, bound: 'read back', reason: PRINTED, },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: hardCapMs: 60_000': { count: 1, bound: 'read back', reason: PRINTED, },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: hardCapMs: 90_000': { count: 1, bound: 'read back', reason: PRINTED, },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: softBudgetMs: 259_200_000': {
    count: 1,
    bound: 'read back',
    reason: 'production\'s soft budget of three days, read back in the start line',
  },
  'corpus-run/corpus-pass-lines.unit.test.ts#<module>: softBudgetMs: 60_000': { count: 1, bound: 'read back', reason: PRINTED, },
  'corpus-run/corpus-pass-queue.unit.test.ts#<module>: softBudgetMs: 1_000': {
    count: 5,
    bound: 'read back',
    reason: 'a soft budget judged against the case\'s scripted clock readings, which the case lists; no timer is '
      + 'armed with it',
  },
  'corpus-run/corpus-pass-run.unit.test.ts#runPass: hardCapMs: 25_200_000': {
    count: 1,
    bound: 'read back',
    reason: 'production\'s built-in cap of 420 minutes, read back in the start line every case reads',
  },
  'corpus-run/coverage-control-probe-run.unit.test.ts#<module>: exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS': {
    count: 1,
    bound: 'read back',
    reason: 'the deadline the scripted control records, read back in what it was asked; the inert client arms none',
  },
  'corpus-run/coverage-control-probe-run.unit.test.ts#scripted: exchangeTimeoutMs: input.exchangeTimeoutMs': {
    count: 1,
    bound: 'other',
    reason: HANDED_ON,
  },
  'corpus-run/coverage-control-probe-run.unit.test.ts#walk: exchangeTimeoutMs: EXCHANGE_TIMEOUT_MS': {
    count: 1,
    bound: 'read back',
    reason: 'the deadline handed to the walk, which the scripted control records and the case reads back',
  },
  'corpus-run/damage-region-entry-id.unit.test.ts#censusOverOneEntry: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/model-health-probe.unit.test.ts#askThrowingModel: timeoutMs: TIMEOUT_MS': {
    count: 1,
    bound: 'read back',
    reason: 'the deadline the probe hands its call, read back off the request the client saw',
  },
  'corpus-run/model-health-probe.unit.test.ts#askWith: timeoutMs: TIMEOUT_MS': {
    count: 1,
    bound: 'read back',
    reason: 'the deadline the probe hands its call, read back off the request the client saw',
  },
  'corpus-run/pass-entry.unit.test.ts#entryClient: wait of module-async-time 10': {
    count: 1,
    bound: 'other',
    reason: SAME_TURN_METER,
  },
  'corpus-run/pass-schema-guard.unit.test.ts#emptyVersionTwoArtifact: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/pass-stop-before-next.unit.test.ts#<module>: softBudgetMs: ROOMY_BUDGET_MS': {
    count: 5,
    bound: 'read back',
    reason: 'a budget handed to a pure decision beside the elapsed time the case gives it; no clock is read',
  },
  'corpus-run/recall-scorecard-store.unit.test.ts#<module>: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/required-providers.unit.test.ts#refusesHyperFirst: wait of module-async-time 0': {
    count: 1,
    bound: 'other',
    reason: TIMER_TURN,
  },
  'corpus-run/run-timing-report.test-fixture.ts#timedCallLine: firstByteMs: 40': {
    count: 1,
    bound: 'read back',
    reason: RECORD_FIELD,
  },
  'corpus-run/run-timing.unit.test.ts#<module>: firstByteMs: 40': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'corpus-run/settled-artifact.test-fixture.ts#settledArtifactOver: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/settled-artifact.test-fixture.ts#settledArtifactOverRows: perCallTimeoutMs: 600_000': {
    count: 1,
    bound: 'read back',
    reason: CALL_CONFIG,
  },
  'corpus-run/run-timing.unit.test.ts#<module>: graceMs: 30_001': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'document-lanes.unit.test.ts#lanesClient: wait of module-async-time 10': {
    count: 1,
    bound: 'other',
    reason: SAME_TURN_METER,
  },
  'hyper-client.unit.test.ts#<module>: wait of module-async-time SLOW_TRANSPORT_MS': {
    count: 1,
    bound: 'other',
    reason: 'a settle wait for calls to reach a gated transport, which they do within one turn of the event loop: '
      + 'the case passes with microtask turns only and fails with none (census of 2026-10-06)',
  },
  'hyper-client.unit.test.ts#transport: wait of module-async-time SLOW_TRANSPORT_MS': {
    count: 1,
    bound: 'other',
    reason: SAME_TURN_METER,
  },
  'lane-contest-driver.unit.test.ts#drive: wait of module-async-time startPosition < ROSTER.length ? 20 : 5': {
    count: 1,
    bound: 'other',
    reason: SERIAL_HEAD_START,
  },
  'lane-contest-stage.unit.test.ts#<module>: graceMs: 0': {
    count: 1,
    bound: 'reached',
    reason: 'the window of 0 that cuts the seats scripted to answer only past twice the hang stop, abandoned at '
      + 'quorum on any machine',
  },
  'lane-contest-stage.unit.test.ts#cannedTransport: abortableWait of node:timers/promises delayByModel[at] ?? 0': {
    count: 1,
    bound: 'other',
    reason: 'the delay each case scripts per seat: none, 30 ms for voices that land inside a window that is the hang '
      + 'stop, or twice the hang stop for seats a window of 0 cuts',
  },
  'log-context.unit.test.ts#settleOne: wait of module-async-time 0': { count: 1, bound: 'other', reason: TIMER_TURN, },
  'monotonic-clock.unit.test.ts#<module>: wait of module-async-time 5': {
    count: 1,
    bound: 'other',
    reason: 'a real wait the case crosses, after which it asserts only that the reading has not gone back, which '
      + 'load cannot break',
  },
  'openrouter-abandoned-spend.unit.test.ts#<module>: firstByteMs: 500': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'overlapped-map.unit.test.ts#settle: wait of module-async-time 0': { count: 1, bound: 'other', reason: TIMER_TURN, },
  'provider-budget.unit.test.ts#<module>: cooldownMs: 10_000': { count: 7, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#<module>: cooldownMs: 300': { count: 2, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#<module>: freshForMs: 100': { count: 1, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#<module>: freshForMs: 500': { count: 2, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#<module>: rateLimitBackoffMs: 300': { count: 7, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#<module>: rateLimitBackoffMs: 50': { count: 2, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#<module>: statedWaitMs: 5_000': { count: 2, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'provider-budget.unit.test.ts#credits: wait of module-async-time 20': {
    count: 4,
    bound: 'other',
    reason: 'a meter read held while reads launched in the same turn arrive; the cases pass with no hold at all '
      + '(census of 2026-10-06), so it decides nothing',
  },
  'provider-budget.unit.test.ts#quotas: wait of module-async-time 20': {
    count: 2,
    bound: 'other',
    reason: 'a meter read held while reads launched in the same turn arrive; the cases pass with no hold at all '
      + '(census of 2026-10-06), so it decides nothing',
  },
  'provider-router-decide.unit.test.ts#expectMarkedAndThrown: statedWaitMs: statedWaitMsOf({ error: refusal, },)': {
    count: 1,
    bound: 'read back',
    reason: 'the wait a refusal states, read back in what the router marked',
  },
  'provider-router-decide.unit.test.ts#markRefused: statedWaitMs: statedWaitMs': {
    count: 1,
    bound: 'other',
    reason: HANDED_ON,
  },
  'provider-router-model-hold.unit.test.ts#<module>: modelHoldMs: HOLD_MS': {
    count: 1,
    bound: 'read back',
    reason: SCRIPTED_CLOCK,
  },
  'provider-router-stream-bound.unit.test.ts#chatText: boundMs: BOUND_MS': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'provider-router-stream-bound.unit.test.ts#chatText: firstByteMs: 15_000': {
    count: 1,
    bound: 'read back',
    reason: RECORD_FIELD,
  },
  'provider-router-stream-bound.unit.test.ts#routerOver: modelHoldMs: HOLD_MS': {
    count: 1,
    bound: 'read back',
    reason: 'a hold on the case\'s own injected clock, which the case moves by hand and reads back in the refusal',
  },
  'provider-router.unit.test.ts#chatText: wait of module-async-time SLOT_HOLD_MS': {
    count: 1,
    bound: 'other',
    reason: 'a slot hold the cases pass without (census of 2026-10-06), so it decides nothing',
  },
  'provider-router.unit.test.ts#markRefused: statedWaitMs = 0': {
    count: 1,
    bound: 'read back',
    reason: 'the default of a stub\'s parameter, recording the stated wait the router hands it',
  },
  'refine-phase.unit.test.ts#measuringRefiners: wait of module-async-time startPosition === 0 ? 20 : 5': {
    count: 1,
    bound: 'other',
    reason: SERIAL_HEAD_START,
  },
  'repair-benchmark.unit.test.ts#<module>: runBudgetMs: 0': {
    count: 1,
    bound: 'reached',
    reason: 'a budget of 0 that every entry finds spent, on any machine',
  },
  'repair-benchmark.unit.test.ts#<module>: runBudgetMs: HOUR_MS': {
    count: 1,
    bound: 'read back',
    reason: 'the budget of an hour the case\'s name states, against a two-hour step of the stubbed wall clock; the '
      + 'run takes milliseconds of the monotonic clock it is judged on',
  },
  'repair-translation.unit.test.ts#steeringClient: wait of module-async-time 10': {
    count: 2,
    bound: 'other',
    reason: SAME_TURN_METER,
  },
  'request-pace.unit.test.ts#<module>: windowMs: 1_000': { count: 1, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'request-pace.unit.test.ts#<module>: windowMs: REAL_WINDOW_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the window the case sleeps through on the real clock, with the pacer\'s clock held still until the '
      + 'second take sleeps, and only a lower bound asserted',
  },
  'request-pace.unit.test.ts#<module>: windowMs: WINDOW_MS': { count: 6, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'request-pace.unit.test.ts#builds: windowMs: 1_000': {
    count: 2,
    bound: 'read back',
    reason: 'a window of a pacer whose construction is refused, so it is never armed',
  },
  'request-pace.unit.test.ts#patienceRunsOut: pause of module-async-time RELEASE_PATIENCE_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the patience that fails the case when a release is stuck; the release settles before any timer (the '
      + 'case passes with a patience of 0, census of 2026-10-06)',
  },
  'request-pace.unit.test.ts#scriptedPace: windowMs: WINDOW_MS': { count: 1, bound: 'read back', reason: SCRIPTED_CLOCK, },
  'retry-abort-after-transport-failure.unit.test.ts#<module>: setTimeout 0': {
    count: 1,
    bound: 'reached',
    reason: 'the caller abort, armed before the ladder\'s backoff of at least 10 s, so it fires first on any machine',
  },
  'stage-call.unit.test.ts#callWith: exchangeTimeoutMs: 1_000': {
    count: 1,
    bound: 'read back',
    reason: 'the deadline the pass-through case reads back off the request the client saw; the scripted client arms '
      + 'none',
  },
  'stage-quorum.unit.test.ts#<module>: graceMs: 50': {
    count: 1,
    bound: 'reached',
    reason: 'the window the abandoning case reaches: the hung seat answers only once it is aborted',
  },
  'stage-quorum.unit.test.ts#<module>: graceMs: RECOVERY_GRACE_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the window the bounded recovery case reaches: the re-asked seat answers only once it is aborted',
  },
  'stage-quorum.unit.test.ts#hangingClient: wait of module-async-time lateMs': {
    count: 1,
    bound: 'other',
    reason: 'the delay of a late voice, 20 ms, which lands inside a window that is the hang stop',
  },
  'stage-round-refill.unit.test.ts#<module>: graceMs: GRACE_MS': {
    count: 3,
    bound: 'reached',
    reason: 'the window that cuts the slow seat, which answers only once it is aborted',
  },
  'stage-windowed-rounds.unit.test.ts#runBench: graceMs: graceMs': { count: 1, bound: 'other', reason: HANDED_ON, },
  'stream-bound.unit.test.ts#<module>: boundMs: SHORT_BOUND_MS': {
    count: 2,
    bound: 'reached',
    reason: 'the bound the cutting case reaches, armed before its wait of twice the length, and the same value as the '
      + 'bound field of the error the reading case builds',
  },
  'stream-bound.unit.test.ts#<module>: firstByteMs: 15_000': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'stream-bound.unit.test.ts#<module>: wait of module-async-time SHORT_BOUND_MS * 2': {
    count: 1,
    bound: 'reached',
    reason: 'the wait that must outlast a bound armed before it and half its length, so the bound fires first on '
      + 'any machine',
  },
  'stream-cut.unit.test.ts#<module>: firstByteMs: 40': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'stream-drain.unit.test.ts#<module>: firstByteMs: 40': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'stream-drain.unit.test.ts#<module>: idleMs: 60_000': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'stream-idle-guard.unit.test.ts#<module>: firstByteMs: TINY_MS': {
    count: 3,
    bound: 'reached',
    reason: 'the window the tripping cases reach, waited out by polling the guard\'s own signal, and the one the '
      + 'disposal case defuses',
  },
  'stream-idle-guard.unit.test.ts#<module>: idleMs: 1_500': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'stream-idle-guard.unit.test.ts#<module>: idleMs: TINY_MS': {
    count: 3,
    bound: 'reached',
    reason: 'the window the tripping cases reach, waited out by polling the guard\'s own signal, and the one the '
      + 'disposal case defuses',
  },
  'stream-idle-guard.unit.test.ts#<module>: wait of module-async-time TINY_MS': {
    count: 1,
    bound: 'other',
    reason: 'a real span so the first byte lands past zero; the case asserts only lower bounds, which load widens',
  },
  'stream-idle-guard.unit.test.ts#settle: setTimeout TINY_MS * 5': {
    count: 1,
    bound: 'reached',
    reason: 'the wait past windows a disposal defused, armed after them and five times as long, so a window left '
      + 'armed fires inside it on any machine',
  },
  'stream-idle-guard.unit.test.ts#tick: setTimeout TINY_MS': {
    count: 1,
    bound: 'other',
    reason: 'the poll interval of a wait that ends on the guard\'s own signal, not on time',
  },
  'stream-overrun.unit.test.ts#<module>: firstByteMs: 40': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'synthetic-client.unit.test.ts#<module>: exchangeTimeoutMs: 50': {
    count: 1,
    bound: 'reached',
    reason: 'the deadline the hung-exchange case reaches: the transport answers only once it is aborted',
  },
  'synthetic-client.unit.test.ts#<module>: exchangeTimeoutMs: QUEUED_DEADLINE_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the deadline the queued call must not reach: shorter than its wait in the queue, while its exchange '
      + 'answers at once when its slot opens',
  },
  'synthetic-client.unit.test.ts#<module>: wait of module-async-time SETTLE_MS': {
    count: 2,
    bound: 'other',
    reason: 'a settle wait for calls to reach a gated transport, which they do within one turn of the event loop: '
      + 'the case passes with microtask turns only and fails with none (census of 2026-10-06)',
  },
  'synthetic-client.unit.test.ts#holdFirstReply: wait of module-async-time QUEUE_HOLD_MS': {
    count: 1,
    bound: 'reached',
    reason: 'the hold that keeps the queued call waiting past its own deadline',
  },
  'transient-retry.unit.test.ts#<module>: firstByteMs: 10': { count: 1, bound: 'read back', reason: RECORD_FIELD, },
  'transient-retry.unit.test.ts#<module>: setTimeout 0': {
    count: 1,
    bound: 'reached',
    reason: 'the caller abort, armed before the ladder\'s backoff of at least 10 s, so it fires first on any machine',
  },
  'translate-document.unit.test.ts#laneClient: wait of module-async-time 10': {
    count: 1,
    bound: 'other',
    reason: SAME_TURN_METER,
  },
  'twin-memo.unit.test.ts#settle: wait of module-async-time 0': { count: 1, bound: 'other', reason: TIMER_TURN, },
  'wall-clock-stub.unit.test.ts#<module>: sleepFor of node:timers/promises 1': {
    count: 1,
    bound: 'other',
    reason: 'a timer turn the case crosses to show the stub holds across it; its length decides nothing',
  },
};

/**
 Local names one file's imports give the timers and the shared hang stop.
 */
type TimerNames = {
  /**
   Local names of `setTimeout` from `node:timers/promises`.
   */
  readonly promiseSleeps: ReadonlySet<string>;

  /**
   Local names of `wait` from `@monochromatic-dev/module-async-time/ts`.
   */
  readonly waits: ReadonlySet<string>;

  /**
   Local names of the shared hang stop.
   */
  readonly hangStops: ReadonlySet<string>;
};

/**
 Reads the local names a file's imports bind to the timers and the shared
 hang stop.

 @param file - file read, whose path resolves its relative imports

 @param program - file's program

 @returns The local names, empty sets where the file imports none

 @example
 ```ts
 const names = timerNamesOf({ file, program, },);
 ```
 */
function timerNamesOf(
  {
    file,
    program,
  }: {
    readonly file: SourceText;
    readonly program: TreeNode;
  },
): TimerNames {
  /**
   Local names of the promise sleep.
   */
  const promiseSleeps = new Set<string>();
  /**
   Local names of the module-async-time wait.
   */
  const waits = new Set<string>();
  /**
   Local names of the shared hang stop.
   */
  const hangStops = new Set<string>();
  for (const statement of (program.body as readonly TreeNode[])) {
    if (statement.type !== 'ImportDeclaration')
      continue;
    /**
     Module the declaration names.
     */
    const from = literalText({ node: statement.source, },);
    /**
     Where a relative specifier lands, empty for a package import.
     */
    const landsAt = from.startsWith('.',)
      ? resolveSpecifier({
        fromPath: file.path,
        specifier: from,
      },)
      : '';
    for (const specifier of (statement.specifiers as readonly TreeNode[])) {
      if (specifier.type !== 'ImportSpecifier')
        continue;
      /**
       Name the module exports, written as an identifier or a string.
       */
      const exported = identifierName({ node: specifier.imported, },) || literalText({ node: specifier.imported, },);
      /**
       Name the file uses.
       */
      const local = identifierName({ node: specifier.local, },);
      if ((from === 'node:timers/promises') && (exported === 'setTimeout'))
        promiseSleeps.add(local,);
      if ((from === '@monochromatic-dev/module-async-time/ts') && (exported === 'wait'))
        waits.add(local,);
      if ((landsAt === HANG_STOP_PATH) && (exported === HANG_STOP_NAME))
        hangStops.add(local,);
    }
  }
  return {
    promiseSleeps,
    waits,
    hangStops,
  };
}

/**
 A bound one node sets: its form as the key writes it and the expression
 that gives its value.
 */
type BoundRead = {
  /**
   Form, such as `AbortSignal.timeout` or `graceMs:`.
   */
  readonly form: string;

  /**
   Value expression, absent where a timer is called without a delay.
   */
  readonly value: unknown;
};

/**
 The bounds a call node sets.

 @param node - call expression read

 @param names - local names the file gives the timers

 @returns One read where the call arms a timer, none otherwise

 @example
 ```ts
 const reads = callBounds({ node, names, },);
 ```
 */
function callBounds(
  {
    node,
    names,
  }: {
    readonly node: TreeNode;
    readonly names: TimerNames;
  },
): readonly BoundRead[] {
  /**
   The callee inside any parentheses and casts.
   */
  const { inner: callee, } = unwrapped({ node: node.callee, },);
  /**
   Arguments the call passes.
   */
  const args = node.arguments as readonly unknown[];
  if (isTreeNode(callee,) && (callee.type === 'MemberExpression')) {
    return ((memberName({ node: callee, },) === 'timeout') && (identifierName({ node: callee.object, },) === 'AbortSignal'))
      ? [{
        form: 'AbortSignal.timeout',
        value: args[0],
      },]
      : [];
  }
  /**
   The callee's name, empty for anything but a plain identifier.
   */
  const name = identifierName({ node: callee, },);
  if (names.promiseSleeps.has(name,)) {
    return [{
      form: `${name} of node:timers/promises`,
      value: args[0],
    },];
  }
  if (names.waits.has(name,)) {
    return [{
      form: `${name} of module-async-time`,
      value: args[0],
    },];
  }
  return ((name === 'setTimeout') || (name === 'setInterval'))
    ? [{
      form: name,
      value: args[1],
    },]
    : [];
}

/**
 The bounds an object node sets: each bound key's value in an object
 literal, and each bound key's default in a destructuring pattern, where a
 key with no default binds a name and sets nothing.

 @param node - object literal or object pattern read

 @returns One read per bound key that sets a value, none for any other node

 @example
 ```ts
 const reads = objectBounds({ node, },);
 ```
 */
function objectBounds({ node, }: { readonly node: TreeNode; },): readonly BoundRead[] {
  if ((node.type !== 'ObjectExpression') && (node.type !== 'ObjectPattern'))
    return [];
  return (node.properties as readonly TreeNode[]).flatMap(function boundOf(property,): readonly BoundRead[] {
    /**
     The key, written as an identifier or a string; empty where computed.
     */
    const key = ((property.type !== 'Property') || (property.computed === true))
      ? ''
      : (identifierName({ node: property.key, },) || literalText({ node: property.key, },));
    if (!BOUND_KEYS.has(key,))
      return [];
    /**
     The property's value: an expression, or in a pattern a binding.
     */
    const { value, } = property;
    if (node.type === 'ObjectExpression') {
      return [{
        form: `${key}:`,
        value,
      },];
    }
    return (isTreeNode(value,) && (value.type === 'AssignmentPattern'))
      ? [{
        form: `${key} =`,
        value: value.right,
      },]
      : [];
  },);
}

/**
 How a bound's value reads in its key: its source text, each line trimmed
 and the lines joined by a space, or `(none)` where the timer is called
 without a delay.

 @param file - file the value sits in

 @param value - value expression read

 @returns Text for the key

 @example
 ```ts
 const text = valueText({ file, value, },); // '5_000'
 ```
 */
function valueText(
  {
    file,
    value,
  }: {
    readonly file: SourceText;
    readonly value: unknown;
  },
): string {
  if (!isTreeNode(value,))
    return '(none)';
  return file.text
    .slice(
      value.start,
      value.end,
    )
    .split('\n',)
    .map(function trimmed(line,): string {
      return line.trim();
    },)
    .join(' ',);
}

/**
 Every bound on the real clock in the test files and fixtures given whose
 value is not the shared hang stop, keyed `path#site: form value`.

 @param files - files read; package source among them is skipped

 @returns Keys sorted, repeated once per read

 @example
 ```ts
 const found = unsharedBounds({ files, },);
 ```
 */
function unsharedBounds({ files, }: { readonly files: readonly SourceText[]; },): readonly string[] {
  /**
   Keys found so far.
   */
  const found: string[] = [];
  for (const file of files) {
    if (!file.isTest)
      continue;
    /**
     The file's program.
     */
    const { program, } = parseSource({ file, },);
    /**
     Local names the file gives the timers and the hang stop.
     */
    const names = timerNamesOf({
      file,
      program,
    },);
    /**
     Nodes still to visit, each with its enclosing named function.
     */
    const pending: {
      readonly node: TreeNode;
      readonly site: string;
    }[] = [{
      node: program,
      site: '<module>',
    },];
    for (let next = pending.pop(); next !== undefined; next = pending.pop()) {
      /**
       Node visited now, and the site it sits in.
       */
      const {
        node,
        site,
      } = next;
      /**
       Enclosing named function for the node's children.
       */
      const here = (NAMING_KINDS.has(node.type,) && isTreeNode(node.id,)) ? identifierName({ node: node.id, },) : site;
      /**
       Bounds the node sets.
       */
      const reads = (node.type === 'CallExpression')
        ? callBounds({
          node,
          names,
        },)
        : objectBounds({ node, },);
      for (const read of reads) {
        /**
         The value inside any parentheses and casts.
         */
        const { inner, } = unwrapped({ node: read.value, },);
        if (!names.hangStops.has(identifierName({ node: inner, },),)) {
          found.push(`${file.path}#${here}: ${read.form} ${
            valueText({
              file,
              value: inner,
            },)
          }`,);
        }
      }
      pending.push(...childNodes({ node, },).map(function withSite(child,) {
        return {
          node: child,
          site: here,
        };
      },),);
    }
  }
  return found.toSorted();
}

/**
 The path a finding's key names, before its site.

 @param key - finding read

 @returns Its path relative to `src`

 @example
 ```ts
 const path = pathOfKey({ key: 'litter.unit.test.ts#purr: setTimeout 20', },); // 'litter.unit.test.ts'
 ```
 */
function pathOfKey({ key, }: { readonly key: string; },): string {
  return key.slice(
    0,
    key.indexOf('#',),
  );
}

/**
 What the package-wide case compares the scan's findings with: each listed
 key as often as it is listed, and each deferred file that holds no finding,
 so a deferral that outlived its file's bounds shows as a difference.

 @param found - keys the scan found, deferred files' among them

 @param listed - bounds that keep a value of their own

 @param deferred - files whose bounds wait for another change

 @returns The scan's findings outside the deferred files, and the entries
 they must equal, both sorted

 @example
 ```ts
 const { findings, expected, } = againstListed({ found, listed: LISTED, deferred: DEFERRED, },);
 ```
 */
function againstListed(
  {
    found,
    listed,
    deferred,
  }: {
    readonly found: readonly string[];
    readonly listed: Readonly<Record<string, ListedBound>>;
    readonly deferred: Readonly<Record<string, string>>;
  },
): {
  readonly findings: readonly string[];
  readonly expected: readonly string[];
} {
  /**
   Files that hold at least one finding.
   */
  const holding = new Set(found.map(function pathOf(key,): string {
    return pathOfKey({ key, },);
  },),);
  return {
    findings: [
      ...found.filter(function outsideDeferred(key,): boolean {
        return !Object.hasOwn(
          deferred,
          pathOfKey({ key, },),
        );
      },),
      ...Object.keys(deferred,)
        .filter(function holdsNone(path,): boolean {
          return !holding.has(path,);
        },)
        .map(function staleDeferral(path,): string {
          return `${path}: deferred, and holds no bound outside the hang stop`;
        },),
    ].toSorted(),
    expected: Object.entries(listed,)
      .flatMap(function copies([key, entry,],): readonly string[] {
        return Array.from(
          { length: entry.count, },
          function copy(): string {
            return key;
          },
        );
      },)
      .toSorted(),
  };
}

//endregion Real-clock bounds

await describe({
  name: 'real-clock bounds in tests (commit 5086b6c6f, ledger B318)',
  children: [
    it({
      name: 'FINDS a bare or local bound in AbortSignal.timeout, a global setTimeout and setInterval, the promise '
        + 'sleep and module-async-time wait under any local name, a bound key\'s value and its destructured default, '
        + 'and an expression over the hang stop, and leaves the imported hang stop under any local name, keys outside '
        + 'the bound keys, timers no import names, package source, and a deferral that still holds a finding',
      fn: async () => {
        /**
         Every form the scan reads, and every form it leaves.
         */
        const files: readonly SourceText[] = [
          {
            path: 'litter.unit.test.ts',
            text: [
              'import { setTimeout as nap, } from \'node:timers/promises\';',
              'import { wait as snooze, } from \'@monochromatic-dev/module-async-time/ts\';',
              'import { HANG_STOP_MS, } from \'./hang-stop.test-fixture.ts\';',
              'const TINY_MS = 20;',
              'export async function purr({ graceMs = 50, perCallTimeoutMs = HANG_STOP_MS, }: { graceMs?: number; '
              + 'perCallTimeoutMs?: number; },): Promise<void> {',
              '  AbortSignal.timeout(5_000,);',
              '  AbortSignal.timeout(HANG_STOP_MS,);',
              '  AbortSignal.timeout(HANG_STOP_MS * 8,);',
              '  setTimeout(purr, 20,);',
              '  setInterval(purr,);',
              '  await nap(30,);',
              '  await snooze(TINY_MS,);',
              '  await snooze(HANG_STOP_MS,);',
              '  void { perCallTimeoutMs: 1_000, exchangeTimeoutMs: (HANG_STOP_MS as number), graceMs, };',
              '  void { timeout: 30_000, elapsedMs: 5, baseMs: 1, \'hardCapMs\': 90_000, };',
              '  const { idleMs, } = { idleMs: HANG_STOP_MS, };',
              '  void idleMs;',
              '}',
              'export const steady = performance.now() + globalThis.setTimeout(purr, 9,) + timers.setTimeout(purr, 9,);',
            ].join('\n',),
            isTest: true,
          },
          {
            path: 'corpus-run/kitten.test-fixture.ts',
            text: [
              'import { HANG_STOP_MS as LONG_NAP_MS, } from \'../hang-stop.test-fixture.ts\';',
              'import { HANG_STOP_MS, } from \'./hang-stop.test-fixture.ts\';',
              'export const nap = { softBudgetMs: LONG_NAP_MS, hardCapMs: HANG_STOP_MS, };',
              'export function wait(ms: number,): number { return ms; }',
              'export const sleepy = wait(40,);',
            ].join('\n',),
            isTest: true,
          },
          {
            path: 'litter.ts',
            text: 'export const signal = AbortSignal.timeout(5_000,);',
            isTest: false,
          },
        ];
        expect(unsharedBounds({ files, },),).toEqual([
          'corpus-run/kitten.test-fixture.ts#<module>: hardCapMs: HANG_STOP_MS',
          'litter.unit.test.ts#purr: AbortSignal.timeout 5_000',
          'litter.unit.test.ts#purr: AbortSignal.timeout HANG_STOP_MS * 8',
          'litter.unit.test.ts#purr: graceMs = 50',
          'litter.unit.test.ts#purr: graceMs: graceMs',
          'litter.unit.test.ts#purr: hardCapMs: 90_000',
          'litter.unit.test.ts#purr: nap of node:timers/promises 30',
          'litter.unit.test.ts#purr: perCallTimeoutMs: 1_000',
          'litter.unit.test.ts#purr: setInterval (none)',
          'litter.unit.test.ts#purr: setTimeout 20',
          'litter.unit.test.ts#purr: snooze of module-async-time TINY_MS',
          'litter.unit.test.ts#purr: timeout: 30_000',
        ],);
        expect(againstListed({
          found: [
            'litter.unit.test.ts#purr: setTimeout 20',
            'tabby.unit.test.ts#<module>: graceMs: 0',
          ],
          listed: {
            'litter.unit.test.ts#purr: setTimeout 20': {
              count: 1,
              bound: 'other',
              reason: 'a purr the cat waits out',
            },
          },
          deferred: {
            'tabby.unit.test.ts': 'another change edits this file first',
            'calico.unit.test.ts': 'another change edits this file first',
          },
        },),).toEqual({
          findings: [
            'calico.unit.test.ts: deferred, and holds no bound outside the hang stop',
            'litter.unit.test.ts#purr: setTimeout 20',
          ],
          expected: ['litter.unit.test.ts#purr: setTimeout 20',],
        },);
      },
    },),
    it({
      name: 'SETS NO BOUND ON THE REAL CLOCK in the package\'s tests but the shared hang stop, the listed bounds as '
        + 'often as listed, and the deferred files\' own',
      fn: async () => {
        /**
         Every package file, tests among them.
         */
        const files = await readPackageSource();
        /**
         The scan's findings and what they must equal.
         */
        const {
          findings,
          expected,
        } = againstListed({
          found: unsharedBounds({ files, },),
          listed: LISTED,
          deferred: DEFERRED,
        },);
        expectFindingsAsListed({
          findings,
          listed: expected,
        },);
      },
    },),
  ],
},);
