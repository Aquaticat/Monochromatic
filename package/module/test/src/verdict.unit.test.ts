/**
 * Tests outcome tags emitted by test and suite runners.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  createLogger,
  type Logger,
  type LogRecord,
  type Sink,
} from '@monochromatic-dev/module-logger/ts';

/**
 * Runner outcomes encoded by dedicated logger tags.
 *
 * @example
 * ```ts
 * const verdict: Verdict = 'PASS';
 * ```
 */
type Verdict = 'FAIL' | 'PASS' | 'SKIP';

/**
 * Capturing logger plus records received by its only sink.
 *
 * @example
 * ```ts
 * const capture = await createCapture();
 * capture.logger.info('message');
 * ```
 */
type Capture = {
  readonly logger: Logger;
  readonly records: LogRecord[];
};

/**
 * Builds logger whose sink retains every record for assertions.
 *
 * @returns initialized logger and mutable record collection owned by sink
 *
 * @example
 * ```ts
 * const capture = await createCapture();
 * await capture.logger.flush();
 * ```
 */
async function createCapture(): Promise<Capture> {
  /** Records retained in sink arrival order. */
  const records: LogRecord[] = [];
  /** Sink exposing logger records without console or file formatting. */
  const sink: Sink = {
    verify: function verify(): Promise<boolean> {
      return Promise.resolve(true,);
    },
    write: function write(record: LogRecord,): Promise<void> {
      records.push(record,);
      return Promise.resolve();
    },
  };
  /** Logger and initialization boundary built over capturing sink. */
  const {
    initPromise,
    logger,
  } = createLogger({ sinks: [sink,], },);
  await initPromise;
  return {
    logger,
    records,
  };
}

/**
 * Selects records carrying exact bracketed outcome token.
 *
 * @param records - captured logger records to inspect
 *
 * @param verdict - outcome token required in message
 *
 * @returns records containing dedicated verdict tag
 *
 * @example
 * ```ts
 * const failed = recordsForVerdict({ records, verdict: 'FAIL', });
 * ```
 */
function recordsForVerdict({
  records,
  verdict,
}: {
  readonly records: readonly LogRecord[];
  readonly verdict: Verdict;
},): readonly LogRecord[] {
  /** Bracketed logger tag boundary used by console and JSONL consumers. */
  const tag = `[${verdict}]`;
  return records.filter(function hasVerdict(record,) {
    return record.message.includes(tag,);
  },);
}

await describe({
  name: 'verdict tags',
  children: [
    it({
      name: 'separate test outcomes from names and diagnostics containing verdict words',
      fn: async () => {
        /** Capture for direct test-level outcomes. */
        const capture = await createCapture();

        await it({
          name: 'name contains PASS FAIL PASSAGE FAILURE',
          l: capture.logger,
          fn: async () => {},
        },);

        /** Failure descriptor whose diagnostic repeats every collision word. */
        const failed = it({
          name: 'diagnostic collision',
          l: capture.logger,
          fn: async () => {
            throw new Error('diagnostic contains PASS FAIL PASSAGE FAILURE',);
          },
        },);
        /** Caught failure proving inner test ran without failing outer harness test. */
        let caught: unknown;
        try {
          await failed;
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);

        await it({
          name: 'skipped collision PASSAGE FAILURE',
          l: capture.logger,
          skip: 'reason contains PASS FAIL PASSAGE FAILURE',
          fn: async () => {},
        },);
        await capture.logger.flush();

        /** Passing verdict records selected independently from bare words. */
        const passes = recordsForVerdict({
          records: capture.records,
          verdict: 'PASS',
        },);
        /** Failing verdict records selected independently from diagnostics. */
        const failures = recordsForVerdict({
          records: capture.records,
          verdict: 'FAIL',
        },);
        /** Skipped verdict records selected independently from reason text. */
        const skips = recordsForVerdict({
          records: capture.records,
          verdict: 'SKIP',
        },);

        expect(passes,).toHaveLength(1,);
        expect(failures,).toHaveLength(1,);
        expect(skips,).toHaveLength(1,);
        expect(passes[0]?.level,).toBe('debug',);
        expect(failures[0]?.level,).toBe('error',);
        expect(skips[0]?.level,).toBe('info',);
        expect(passes[0]?.message,).toContain(
          '[name contains PASS FAIL PASSAGE FAILURE] [PASS] (',
        );
        expect(failures[0]?.message,).toContain(
          '[diagnostic collision] [FAIL] (',
        );
        expect(failures[0]?.message,).toContain(
          'diagnostic contains PASS FAIL PASSAGE FAILURE',
        );
        expect(skips[0]?.message,).toContain(
          '[skipped collision PASSAGE FAILURE] [SKIP] reason contains PASS FAIL PASSAGE FAILURE',
        );
      },
    },),

    it({
      name: 'tags test and suite records while preserving hierarchy',
      fn: async () => {
        /** Capture for nested suite outcomes. */
        const capture = await createCapture();
        /** Mixed suite proving fulfilled-child summary and failure rollup carry separate verdicts. */
        const mixedSuite = describe({
          name: 'suite contains PASSAGE FAILURE',
          l: capture.logger,
          concurrency: 1,
          children: [
            it({
              name: 'child contains PASS',
              fn: async () => {},
            },),
            it({
              name: 'child contains FAILURE',
              fn: async () => {
                throw new Error('suite diagnostic contains PASS FAIL PASSAGE FAILURE',);
              },
            },),
          ],
        },);
        /** Caught mixed-suite failure retained for behavior assertion. */
        let caught: unknown;
        try {
          await mixedSuite;
        }
        catch (error: unknown) {
          caught = error;
        }
        expect(caught,).toBeInstanceOf(Error,);
        await capture.logger.flush();

        /** Test pass plus fulfilled-child summary. */
        const passes = recordsForVerdict({
          records: capture.records,
          verdict: 'PASS',
        },);
        /** Test failure plus suite failure rollup. */
        const failures = recordsForVerdict({
          records: capture.records,
          verdict: 'FAIL',
        },);

        expect(passes,).toHaveLength(2,);
        expect(failures,).toHaveLength(2,);
        expect(passes[0]?.level,).toBe('debug',);
        expect(passes[1]?.level,).toBe('info',);
        expect(failures[0]?.level,).toBe('error',);
        expect(failures[1]?.level,).toBe('error',);
        expect(passes[0]?.message,).toContain(
          '[suite contains PASSAGE FAILURE] [child contains PASS] [PASS] (',
        );
        expect(passes[1]?.message,).toBe(
          '[suite contains PASSAGE FAILURE] [PASS] child contains PASS',
        );
        expect(failures[0]?.message,).toContain(
          '[suite contains PASSAGE FAILURE] [child contains FAILURE] [FAIL] (',
        );
        expect(failures[1]?.message,).toContain(
          '[suite contains PASSAGE FAILURE] [FAIL] (',
        );
      },
    },),

    it({
      name: 'tags skipped and empty suites',
      fn: async () => {
        /** Capture for suite paths with no child execution. */
        const capture = await createCapture();

        await describe({
          name: 'skipped suite PASSAGE FAILURE',
          l: capture.logger,
          skip: 'blocked by PASS FAIL diagnostic',
          children: [],
        },);
        await describe({
          name: 'empty suite PASSAGE FAILURE',
          l: capture.logger,
          children: [],
        },);
        await capture.logger.flush();

        /** Empty-suite pass verdict. */
        const passes = recordsForVerdict({
          records: capture.records,
          verdict: 'PASS',
        },);
        /** Skipped-suite verdict. */
        const skips = recordsForVerdict({
          records: capture.records,
          verdict: 'SKIP',
        },);

        expect(passes,).toHaveLength(1,);
        expect(skips,).toHaveLength(1,);
        expect(passes[0]?.level,).toBe('info',);
        expect(skips[0]?.level,).toBe('info',);
        expect(passes[0]?.message,).toContain(
          '[empty suite PASSAGE FAILURE] [PASS] (',
        );
        expect(skips[0]?.message,).toBe(
          '[skipped suite PASSAGE FAILURE] [SKIP] suite "skipped suite PASSAGE FAILURE": blocked by PASS FAIL diagnostic',
        );
      },
    },),
  ],
},);
