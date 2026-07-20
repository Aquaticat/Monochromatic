import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import { createSessionStorageSink, } from './session-storage.ts';
import { detectSessionStorageQuotaChars, } from './session-storage-quota.ts';
import type { LogRecord, } from '../types.ts';

/**
 * Swaps `globalThis.sessionStorage` for `fake`, restoring the real backend when
 * the returned guard leaves `using` scope, so a fake never leaks into a later
 * test in the serial suite.
 *
 * @param fake - Storage stand-in to install for the duration of the scope.
 *
 * @returns Disposable that restores the original `sessionStorage` on exit.
 */
function installFakeStorage(fake: Storage,): Disposable {
  const original = globalThis.sessionStorage;
  globalThis.sessionStorage = fake;
  return {
    [Symbol.dispose](): void {
      globalThis.sessionStorage = original;
    },
  };
}

/**
 * Builds an in-memory `Storage` stand-in that rejects a `setItem` once stored
 * value lengths would exceed `byteBudget`, throwing the same
 * `QuotaExceededError` a real backend raises. Records every `removeItem` under
 * `removed` so a test can assert exactly which keys the sink evicted.
 *
 * @param byteBudget - Total value length the store accepts before overflowing.
 *
 * @returns Storage stand-in exposing the evicted-key log as `removed`.
 */
function createQuotaStorage(byteBudget: number,): Storage & { readonly removed: string[]; } {
  const store = new Map<string, string>();
  const removed: string[] = [];
  const used = { bytes: 0, };
  return {
    removed,
    clear(): void {
      store.clear();
      used.bytes = 0;
    },
    getItem(key: string,) {
      return store.get(key,) ?? null;
    },
    setItem(key: string, value: string,): void {
      const priorLength = store.get(key,)?.length ?? 0;
      const nextBytes = (used.bytes - priorLength) + value.length;
      if (nextBytes > byteBudget)
        throw new DOMException('exceeded the quota', 'QuotaExceededError',);
      store.set(key, value,);
      used.bytes = nextBytes;
    },
    removeItem(key: string,): void {
      removed.push(key,);
      const priorLength = store.get(key,)?.length ?? 0;
      if (store.delete(key,))
        used.bytes -= priorLength;
    },
  } as unknown as Storage & { readonly removed: string[]; };
}

/**
 * Builds an in-memory `Storage` stand-in whose first `setItem` succeeds and
 * every later one throws a non-quota error, so a test can prove the sink does
 * not evict for failures other than a quota overflow. Records `removeItem`
 * calls under `removed`.
 *
 * @returns Storage stand-in exposing the evicted-key log as `removed`.
 */
function createFlakyStorage(): Storage & { readonly removed: string[]; } {
  const store = new Map<string, string>();
  const removed: string[] = [];
  const calls = { setItem: 0, };
  return {
    removed,
    getItem(key: string,) {
      return store.get(key,) ?? null;
    },
    setItem(key: string, value: string,): void {
      calls.setItem += 1;
      if (calls.setItem > 1)
        throw new Error('sessionStorage disabled mid-session',);
      store.set(key, value,);
    },
    removeItem(key: string,): void {
      removed.push(key,);
      store.delete(key,);
    },
  } as unknown as Storage & { readonly removed: string[]; };
}

/**
 * Captures `console.warn` output, restoring the real method when the returned
 * guard leaves `using` scope, so a test can count the sink's give-up reports.
 *
 * @returns Disposable exposing captured warn lines as `calls`.
 */
function spyConsoleWarn(): Disposable & { readonly calls: string[]; } {
  const original = console.warn;
  const calls: string[] = [];
  console.warn = (...args: unknown[]): void => {
    calls.push(args.map(String,)
      .join(' ',),);
  };
  return {
    calls,
    [Symbol.dispose](): void {
      console.warn = original;
    },
  };
}

/**
 * Counts captured warn lines that are the sessionStorage sink's give-up report.
 *
 * @param calls - Captured `console.warn` lines from {@link spyConsoleWarn}.
 *
 * @returns How many lines report a sink write failure.
 */
function sinkFailureCount(calls: readonly string[],): number {
  return calls.filter(function isSinkFailure(line,) {
    return line.includes('sessionStorage sink record write failed',);
  },).length;
}

// Node exposes an in-memory Web Storage `sessionStorage` (on by default in the
// v26 the test runner uses), so write mechanics are exercised directly against
// a genuine backend here: records persist under incrementing namespaced keys
// and eviction obeys quota accounting. Verification is a separate concern:
// the sink is browser-scoped, so verify rejects Node-branded runtimes even
// though their backend works, keeping server processes on the file sink and
// off the per-record synchronous `setItem` cost. The browser availability
// path is covered by `session-storage.browser.test.ts`; OPFS, whose backend
// node lacks, covers the unavailable-verify fallback in `opfs.unit.test.ts`.
await describe({
  name: 'sessionStorage sink (node web storage)',
  // Serial because every test shares the one process-global sessionStorage.
  concurrency: 1,
  children: [
    it({
      name: 'verify resolves false under a Node-branded runtime despite a working backend',
      fn: async () => {
        // Node's web storage round-trips, so a probe alone would elect this
        // sink and duplicate the file sink on every server log record; verify
        // must reject on runtime brand before probing.
        const sink = createSessionStorageSink();
        expect(await sink.verify(),)
          .toBe(false,);
      },
    },),

    it({
      name: 'write persists each record under an incrementing namespaced key',
      fn: async () => {
        globalThis.sessionStorage
          .clear();
        const sink = createSessionStorageSink();
        await sink.verify();

        /**
         * First record written; lands on the fresh sink's initial counter slot.
         */
        const first: LogRecord = {
          level: 'info',
          message: 'one',
          timestamp: 0,
        };
        /**
         * Second record written; the counter increment puts it on the next slot.
         */
        const second: LogRecord = {
          level: 'warn',
          message: 'two',
          timestamp: 0,
        };
        await sink.write(first,);
        await sink.write(second,);

        // A fresh sink's counter starts at zero, so the two writes land on
        // sequential `monochromatic.log.N` keys, each holding the JSONL record.
        expect(globalThis.sessionStorage
          .getItem('monochromatic.log.0',),)
          .toBe(JSON.stringify(first,),);
        expect(globalThis.sessionStorage
          .getItem('monochromatic.log.1',),)
          .toBe(JSON.stringify(second,),);
      },
    },),

    it({
      name: 'keeps only its newest entries against the real backend, evicting oldest as it writes',
      fn: async () => {
        globalThis.sessionStorage
          .clear();
        const sink = createSessionStorageSink();
        await sink.verify();

        // Each record's message is about a megabyte; twelve of them exceed the
        // half-quota cap several times over, so the sink evicts oldest-first and
        // the earliest slot is gone while the newest survives.
        const bulk = 'x'.repeat(1_024 * 1_024,);
        const writeCount = 12;
        await Promise.all(
          Array.from(
            { length: writeCount, },
            function writeBulk(_unused, index,) {
              return sink.write({ level: 'info', message: bulk, timestamp: index, },);
            },
          ),
        );

        // The newest slot always lands; the very first was reclaimed long ago.
        expect(
          globalThis.sessionStorage
            .getItem(`monochromatic.log.${writeCount - 1}`,) !== null,
        )
          .toBe(true,);
        expect(
          globalThis.sessionStorage
            .getItem('monochromatic.log.0',) !== null,
        )
          .toBe(false,);
      },
    },),

    it({
      name: 'caps its own footprint at half the runtime quota, proactively evicting oldest',
      fn: async () => {
        /**
         * Half the detected runtime quota: the footprint ceiling the sink enforces.
         */
        const capChars = detectSessionStorageQuotaChars() / 2;
        // A fake store far larger than the cap, so only the proactive half-quota
        // cap (never a real overflow) drives the eviction under test.
        const fake = createQuotaStorage(capChars * 10,);
        using _restore = installFakeStorage(fake,);
        const sink = createSessionStorageSink();

        // Each record is about 40% of the cap: two fit under half the quota, but
        // the third would breach it, so the oldest is dropped first.
        const chunk = 'y'.repeat(Math.floor(capChars * 0.4,),);
        await sink.write({ level: 'info', message: chunk, timestamp: 0, },);
        await sink.write({ level: 'info', message: chunk, timestamp: 1, },);
        await sink.write({ level: 'info', message: chunk, timestamp: 2, },);

        // Exactly the oldest slot was proactively reclaimed; the two newest stay.
        expect(fake.removed
          .join(',',),)
          .toBe('monochromatic.log.0',);
        expect(
          globalThis.sessionStorage
            .getItem('monochromatic.log.0',) !== null,
        )
          .toBe(false,);
        expect(
          globalThis.sessionStorage
            .getItem('monochromatic.log.2',) !== null,
        )
          .toBe(true,);
      },
    },),

    it({
      name: 'leaves foreign entries intact and drops the write when it has never written',
      fn: async () => {
        // A tiny fake quota already filled by another origin consumer's key, so
        // the sink's first-ever write cannot fit.
        const fake = createQuotaStorage(64,);
        using _restore = installFakeStorage(fake,);
        globalThis.sessionStorage
          .setItem('foreign', 'F'.repeat(64,),);

        const sink = createSessionStorageSink();
        await sink.write({ level: 'info', message: 'hello', timestamp: 0, },);

        // Never having landed a write, the sink must not reclaim foreign data.
        expect(fake.removed.length,)
          .toBe(0,);
        expect(
          globalThis.sessionStorage
            .getItem('foreign',) !== null,
        )
          .toBe(true,);
      },
    },),

    it({
      name: 'evicts every owned entry then gives up for a record larger than the quota',
      fn: async () => {
        const budget = 512;
        const fake = createQuotaStorage(budget,);
        using _restore = installFakeStorage(fake,);
        const sink = createSessionStorageSink();

        // Two small records fit within budget.
        await sink.write({ level: 'info', message: 'a', timestamp: 0, },);
        await sink.write({ level: 'info', message: 'b', timestamp: 1, },);

        // A record larger than the whole budget can never fit; the write must
        // evict both owned entries, then report and return rather than loop.
        await sink.write({ level: 'info', message: 'Z'.repeat(budget * 2,), timestamp: 2, },);

        expect(fake.removed
          .join(',',),)
          .toBe('monochromatic.log.0,monochromatic.log.1',);
        expect(
          globalThis.sessionStorage
            .getItem('monochromatic.log.2',) !== null,
        )
          .toBe(false,);
      },
    },),

    it({
      name: 'does not evict on a non-quota write failure',
      fn: async () => {
        const fake = createFlakyStorage();
        using _restore = installFakeStorage(fake,);
        const sink = createSessionStorageSink();

        // First write lands; the second fails with a non-quota error.
        await sink.write({ level: 'info', message: 'one', timestamp: 0, },);
        await sink.write({ level: 'info', message: 'two', timestamp: 1, },);

        // A non-quota failure is reported without touching earlier entries.
        expect(fake.removed.length,)
          .toBe(0,);
        expect(
          globalThis.sessionStorage
            .getItem('monochromatic.log.0',) !== null,
        )
          .toBe(true,);
      },
    },),

    it({
      name: 'reports an unrecoverable write only once, not once per record',
      fn: async () => {
        // A store that rejects every write and holds nothing of the sink's own,
        // so each write reaches the give-up path.
        const fake = createQuotaStorage(0,);
        using _restore = installFakeStorage(fake,);
        using warn = spyConsoleWarn();
        const sink = createSessionStorageSink();

        await sink.write({ level: 'info', message: 'one', timestamp: 0, },);
        await sink.write({ level: 'info', message: 'two', timestamp: 1, },);
        await sink.write({ level: 'info', message: 'three', timestamp: 2, },);

        // Three failing writes, a single console report rather than a flood.
        expect(sinkFailureCount(warn.calls,),)
          .toBe(1,);
      },
    },),

    it({
      name: 're-arms the give-up report after a write next succeeds',
      fn: async () => {
        // Budget fits one small record; an oversized record can never fit even
        // after evicting the small one, so it reaches the give-up path.
        const fake = createQuotaStorage(200,);
        using _restore = installFakeStorage(fake,);
        using warn = spyConsoleWarn();
        const sink = createSessionStorageSink();
        /**
         * Record larger than the whole budget; unwritable even after eviction.
         */
        const oversized = {
          level: 'info' as const,
          message: 'Z'.repeat(1_000,),
          timestamp: 0,
        };

        await sink.write({ level: 'info', message: 'a', timestamp: 0, },);
        await sink.write(oversized,);
        await sink.write(oversized,);
        await sink.write({ level: 'info', message: 'b', timestamp: 1, },);
        await sink.write(oversized,);

        // First give-up reports; its repeat is suppressed; the landed 'b' write
        // re-arms a single report for the next failure.
        expect(sinkFailureCount(warn.calls,),)
          .toBe(2,);
      },
    },),
  ],
},);
