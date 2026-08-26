/**
 * Tests for the rendering audit's command line surface.
 *
 * EVERY CASE HERE IS ABOUT A FLAG THE OPERATOR GOT WRONG, because the cases
 * where they got it right were never the risk. A reader of a command line has
 * exactly one dangerous failure mode: reading a typo as a default and running
 * anyway. This one had two of those.
 *
 * `--cap once` PARSED TO `NaN`. `capped` in `rendering-audit-settled.ts` returns
 * every subject when the cap is negative and `slice(0, cap)` otherwise; `NaN
 * < 0` is false and `slice(0, NaN)` is empty, so a mistyped cap audited zero
 * subjects, printed the archive population it had read, and exited clean. The
 * operator would have read that as an audit of the whole archive.
 *
 * `--cap` AT THE END OF THE LINE PARSED TO "buy everything", which is the
 * opposite of a cap, because a flag written with nothing after it and a flag
 * never written both came back as the empty string. `--only` at the end of the
 * line had the same shape and the same opposite meaning: audit every entry.
 *
 * ALL THREE NOW REFUSE IN OUR OWN WORDS, at exit code 6 through
 * `reportingRefusals`, and the message may repeat the operator's own argument
 * because `StatedRefusalError` is exactly the marker for text they typed.
 *
 * @module
 */

import { homedir, } from 'node:os';
import { join, } from 'node:path';

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  readAuditArguments,
  readReportArguments,
  StatedRefusalError,
} from '../../dist/final/node/index.mjs';

//region Settled rendering audit argument tests

/**
 * What `process.argv` carries before the arguments a person typed.
 *
 * Named after what they are rather than filled with anything readable, so a
 * reader that stopped skipping them would meet values that are obviously not
 * flags.
 */
const BEFORE_ARGUMENTS: readonly string[] = [
  '/usr/bin/node',
  '/somewhere/rendering-audit-settled.mjs',
];

/**
 * Archive a run reads when nobody names one.
 */
const DEFAULT_ARCHIVE = join(
  homedir(),
  'translation-repair-v2-archive',
);

/**
 * Corpus clone a run reads when nobody names one.
 */
const DEFAULT_CLONE = join(
  homedir(),
  'one-among-us',
  'data',
);

/**
 * Cap meaning "buy every subject", which is what no `--cap` asks for.
 */
const EVERY_SUBJECT = -1;

/**
 * Archive one operator named instead.
 */
const OTHER_ARCHIVE = '/tmp/tabby-archive';

/**
 * Clone one operator named instead.
 */
const OTHER_CLONE = '/tmp/tabby-clone';

/**
 * Entry one operator asked for.
 */
const ONE_CAT = 'saffron';

/**
 * Second entry, so a comma has something on both sides of it.
 */
const ANOTHER_CAT = 'pepperbox';

/**
 * Cap one operator asked for.
 */
const SMALL_BUY = 4;

/**
 * Cap that reads the archive and asks nobody anything, which is meaningful.
 */
const READ_ONLY_BUY = 0;

/**
 * Builds a command line the way `process.argv` presents one.
 *
 * @param typed - what the operator wrote after the script path
 *
 * @returns Whole argument vector, script path and all
 *
 * @example
 * ```ts
 * const argv = commandLine({ typed: ['--cap', '4',], },);
 * ```
 */
function commandLine(
  { typed, }: { readonly typed: readonly string[]; },
): readonly string[] {
  return [
    ...BEFORE_ARGUMENTS,
    ...typed,
  ];
}

await describe({
  name: readAuditArguments.name,
  children: [
    it({
      name: 'ANSWERS with the defaults for a command line that named nothing',
      fn: async () => {
        expect(readAuditArguments({ argv: commandLine({ typed: [], },), },),).toEqual({
          archiveDir: DEFAULT_ARCHIVE,
          cloneDir: DEFAULT_CLONE,
          onlyIds: [],
          cap: EVERY_SUBJECT,
        },);
      },
    },),
    it({
      name: 'READS every flag the operator did name, in any order',
      fn: async () => {
        expect(readAuditArguments({
          argv: commandLine({
            typed: [
              '--cap',
              String(SMALL_BUY,),
              '--only',
              `${ONE_CAT},${ANOTHER_CAT}`,
              '--clone',
              OTHER_CLONE,
              '--archive',
              OTHER_ARCHIVE,
            ],
          },),
        },),).toEqual({
          archiveDir: OTHER_ARCHIVE,
          cloneDir: OTHER_CLONE,
          onlyIds: [
            ONE_CAT,
            ANOTHER_CAT,
          ],
          cap: SMALL_BUY,
        },);
      },
    },),
    it({
      name: 'KEEPS a cap of zero, which reads the whole archive and buys nothing',
      fn: async () => {
        // Zero is not "no cap": it is the wiring check the audit exists to make
        // cheap. A reader that treated it as absent would spend a roster.
        expect(readAuditArguments({
          argv: commandLine({
            typed: [
              '--cap',
              String(READ_ONLY_BUY,),
            ],
          },),
        },).cap,).toBe(READ_ONLY_BUY,);
      },
    },),
    it({
      name: 'TRUNCATES a fractional cap rather than refusing it',
      fn: async () => {
        expect(readAuditArguments({
          argv: commandLine({
            typed: [
              '--cap',
              '4.9',
            ],
          },),
        },).cap,).toBe(SMALL_BUY,);
      },
    },),
    it({
      name: 'REFUSES a cap that is not a number, instead of auditing nothing in silence',
      fn: async () => {
        expect(() => {
          readAuditArguments({
            argv: commandLine({
              typed: [
                '--cap',
                'once',
              ],
            },),
          },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'REPEATS what the operator typed, since the refusal is in our own words',
      fn: async () => {
        expect(() => {
          readAuditArguments({
            argv: commandLine({
              typed: [
                '--cap',
                'once',
              ],
            },),
          },);
        },).toThrow('--cap needs a whole number, and once is not one',);
      },
    },),
    it({
      name: 'REFUSES a cap below zero rather than reading it as every subject, since a mistyped '
        + 'sign would audit the whole archive in silence',
      fn: async () => {
        expect(() => {
          readAuditArguments({
            argv: commandLine({
              typed: [
                '--cap',
                '-3',
              ],
            },),
          },);
        },).toThrow(StatedRefusalError,);
        expect(() => {
          readAuditArguments({
            argv: commandLine({
              typed: [
                '--cap',
                '-3',
              ],
            },),
          },);
        },).toThrow('--cap cannot be below zero, and -3 is; leave it off to audit every subject',);
      },
    },),
    it({
      name: 'REFUSES a flag written at the end of the line with no value after it',
      fn: async () => {
        expect(() => {
          readAuditArguments({ argv: commandLine({ typed: ['--cap',], },), },);
        },).toThrow('--cap needs a value written after it',);
      },
    },),
    it({
      name: 'REFUSES a flag followed by the next flag rather than by its value',
      fn: async () => {
        // `--only` standing where the archive path should be is a typo, and
        // reading it as a path would send the run at a directory named `--only`.
        expect(() => {
          readAuditArguments({
            argv: commandLine({
              typed: [
                '--archive',
                '--only',
                ONE_CAT,
              ],
            },),
          },);
        },).toThrow('--archive needs a value written after it',);
      },
    },),
    it({
      name: 'REFUSES an entry filter that names nobody, which would read as every entry',
      fn: async () => {
        expect(() => {
          readAuditArguments({
            argv: commandLine({
              typed: [
                '--only',
                ',',
              ],
            },),
          },);
        },).toThrow(StatedRefusalError,);
      },
    },),
    it({
      name: 'DROPS a stray separator inside a filter that still names someone',
      fn: async () => {
        expect(readAuditArguments({
          argv: commandLine({
            typed: [
              '--only',
              `${ONE_CAT},,${ANOTHER_CAT}`,
            ],
          },),
        },).onlyIds,).toEqual([
          ONE_CAT,
          ANOTHER_CAT,
        ],);
      },
    },),
  ],
},);

//endregion Settled rendering audit argument tests

await describe({
  name: readReportArguments.name,
  children: [
    it({
      name: 'ANSWERS with two empty lists for a command line that named nothing, which is the newest '
        + 'kept run and no across-run band',
      fn: async () => {
        expect(readReportArguments({ argv: commandLine({ typed: [], },), },),).toEqual({
          run: [],
          against: [],
        },);
      },
    },),
    it({
      name: 'READS both files the operator named, in any order',
      fn: async () => {
        expect(readReportArguments({
          argv: commandLine({
            typed: [
              '--against',
              '/tmp/tabby-earlier.json',
              '--run',
              '/tmp/tabby-later.json',
            ],
          },),
        },),).toEqual({
          run: ['/tmp/tabby-later.json',],
          against: ['/tmp/tabby-earlier.json',],
        },);
      },
    },),
    it({
      name: 'REFUSES --run written at the end of the line with no value after it, which used to read as '
        + 'absent and silently report the newest kept run',
      fn: async () => {
        expect(() => {
          readReportArguments({ argv: commandLine({ typed: ['--run',], },), },);
        },).toThrow('--run needs a value written after it',);
      },
    },),
    it({
      name: 'REFUSES --against followed by the next flag rather than by its value, which used to read as '
        + 'absent and silently print no across-run band',
      fn: async () => {
        /**
         * What the reader raised.
         */
        let raised: unknown;
        try {
          readReportArguments({
            argv: commandLine({
              typed: [
                '--against',
                '--run',
                '/tmp/tabby-later.json',
              ],
            },),
          },);
        }
        catch (error) {
          raised = error;
        }
        expect(raised,).toBeInstanceOf(StatedRefusalError,);
        expect((raised as Error).message,).toContain('--against needs a value written after it',);
      },
    },),
  ],
},);
