import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  ArgvParseError,
  type ArgvSpec,
  parseArgv,
} from './argv.ts';

/**
 * Parse returned instead of refusing, which every refusal test rejects.
 */
const NO_REFUSAL: unique symbol = Symbol('parse returned without refusing',);

/**
 * Declared surface mirroring the optique parser this module replaced, used to
 * pin behavior observed from `@optique/core` 1.1.1 before the migration.
 */
const spec: ArgvSpec = {
  flags: { allFlags: { names: [
    '-a',
    '--all',
  ], }, },
  valueOptions: { message: { names: [
    '-m',
    '--message',
  ], }, },
};

/**
 * Parses one region against the shared declared surface.
 *
 * @param args - exact argv region
 *
 * @returns compact facts comparable with observed optique output
 */
function parse(args: readonly string[],) {
  /**
   * Parsed region facts.
   */
  const result = parseArgv({
    args,
    spec,
  },);
  return {
    a: result.flagCounts
      .allFlags
      ?? 0,
    m: result.optionValues
      .message
      ?? [],
    pos: result.positionals,
    unk: result.unknownOptions,
  };
}

await describe({
  name: 'git argv region parser',
  children: [
    it({
      name: 'takes a declared option value and keeps following positionals',
      fn: async function testOptionValue() {
        expect(parse([
          '-m',
          'msg',
          'a.txt',
        ],),).toEqual({
          a: 0,
          m: ['msg',],
          pos: ['a.txt',],
          unk: [],
        },);
      },
    },),
    it({
      name: 'counts a declared flag without consuming following positionals',
      fn: async function testFlag() {
        expect(parse([
          '-a',
          'a.txt',
          'b.txt',
        ],),).toEqual({
          a: 1,
          m: [],
          pos: [
            'a.txt',
            'b.txt',
          ],
          unk: [],
        },);
      },
    },),
    it({
      name: 'counts every repeated declared flag occurrence',
      fn: async function testRepeatedFlag() {
        expect(parse([
          '-a',
          '-a',
        ],),).toEqual({
          a: 2,
          m: [],
          pos: [],
          unk: [],
        },);
      },
    },),
    it({
      name: 'lets an undeclared option consume one following plain token',
      fn: async function testUnknownConsumes() {
        expect(parse([
          '-q',
          'a.txt',
        ],),).toEqual({
          a: 0,
          m: [],
          pos: [],
          unk: [
            '-q',
            'a.txt',
          ],
        },);
      },
    },),
    it({
      name: 'stops an undeclared option from consuming a dash-led token',
      fn: async function testUnknownSpares() {
        expect(parse([
          '-q',
          '-a',
        ],),).toEqual({
          a: 1,
          m: [],
          pos: [],
          unk: ['-q',],
        },);
      },
    },),
    it({
      name: 'stops an undeclared option from consuming the terminator',
      fn: async function testUnknownSparesTerminator() {
        expect(parse([
          '-q',
          '--',
          'a.txt',
        ],),).toEqual({
          a: 0,
          m: [],
          pos: ['a.txt',],
          unk: ['-q',],
        },);
      },
    },),
    it({
      name: 'leaves an undeclared option at end of region unconsumed',
      fn: async function testUnknownAtEnd() {
        expect(parse(['-q',],),).toEqual({
          a: 0,
          m: [],
          pos: [],
          unk: ['-q',],
        },);
      },
    },),
    it({
      name: 'takes a declared joined option value',
      fn: async function testJoinedDeclared() {
        expect(parse([
          '--message=msg',
          'a.txt',
        ],),).toEqual({
          a: 0,
          m: ['msg',],
          pos: ['a.txt',],
          unk: [],
        },);
      },
    },),
    it({
      name: 'treats an undeclared joined token as an undeclared option, never a path',
      fn: async function testJoinedUndeclared() {
        // Reading this as a path is what hands `--untracked-files=no` to the
        // commit-only rule as a pathspec.
        expect(parse([
          '--unknown=v',
          'a.txt',
        ],),).toEqual({
          a: 0,
          m: [],
          pos: ['a.txt',],
          unk: ['--unknown=v',],
        },);
      },
    },),
    it({
      name: 'keeps an ordinary undeclared joined git option working',
      fn: async function testOrdinaryJoinedOption() {
        // `git commit -m msg --untracked-files=no a.txt` is valid git; these
        // specs declare a subset of git's options, so it arrives undeclared.
        expect(parse([
          '-m',
          'msg',
          '--untracked-files=no',
          'a.txt',
        ],),).toEqual({
          a: 0,
          m: ['msg',],
          pos: ['a.txt',],
          unk: ['--untracked-files=no',],
        },);
      },
    },),
    it({
      name: 'names the offending token and region when refusing',
      fn: async function testRefusalDetail() {
        /**
         * Refusal captured from a value option missing its value.
         */
        const caught = (function captureRefusal() {
          try {
            parse([
              '-a',
              '-m',
            ],);
            return NO_REFUSAL;
          }
          catch (error: unknown) {
            return error;
          }
        })();
        expect(caught,).toBeInstanceOf(ArgvParseError,);
        if (caught instanceof ArgvParseError) {
          expect(caught.token,).toBe('-m',);
          expect(caught.index,).toBe(1,);
          expect(caught.region,).toEqual([
            '-a',
            '-m',
          ],);
          expect(caught.message,).toContain('-m',);
        }
      },
    },),
    it({
      name: 'refuses a declared option missing its value',
      fn: async function testOptionMissingValue() {
        expect(function parseOptionMissingValue() {
          parse(['-m',],);
        },).toThrow(ArgvParseError,);
      },
    },),
    it({
      name: 'takes a dash-led token as a declared option value',
      fn: async function testDashLedValue() {
        expect(parse([
          '-m',
          '-a',
        ],),).toEqual({
          a: 0,
          m: ['-a',],
          pos: [],
          unk: [],
        },);
      },
    },),
    it({
      name: 'parses declared options appearing after positionals',
      fn: async function testOptionAfterPositional() {
        expect(parse([
          'a.txt',
          '-m',
          'msg',
        ],),).toEqual({
          a: 0,
          m: ['msg',],
          pos: ['a.txt',],
          unk: [],
        },);
      },
    },),
    it({
      name: 'treats a lone dash as positional',
      fn: async function testLoneDash() {
        expect(parse(['-',],),).toEqual({
          a: 0,
          m: [],
          pos: ['-',],
          unk: [],
        },);
      },
    },),
    it({
      name: 'treats every token after the terminator as positional',
      fn: async function testTerminator() {
        expect(parse([
          '--',
          '-a',
        ],),).toEqual({
          a: 0,
          m: [],
          pos: ['-a',],
          unk: [],
        },);
      },
    },),
    it({
      name: 'parses declared flags before the terminator',
      fn: async function testFlagBeforeTerminator() {
        expect(parse([
          '-a',
          '--',
          'a.txt',
        ],),).toEqual({
          a: 1,
          m: [],
          pos: ['a.txt',],
          unk: [],
        },);
      },
    },),
    it({
      name: 'rejects a declared spelling that cannot introduce an option',
      fn: async function testInvalidSpec() {
        expect(function parseInvalidSpec() {
          parseArgv({
            args: [],
            spec: { flags: { bad: { names: ['nodash',], }, }, valueOptions: {}, },
          },);
        },).toThrow();
      },
    },),
  ],
},);
