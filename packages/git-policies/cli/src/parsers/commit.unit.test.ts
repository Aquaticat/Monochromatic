import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { parseCommitRegion, } from './commit.ts';

/** Post-`commit` argv forms git treats as dry runs that record no commit. */
const DRY_RUN_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Post-subcommand argv passed to the commit region parser. */
  readonly args: readonly string[];
}[] = [
  {
    name: '--dry-run',
    args: [
      '--dry-run',
      '-m',
      'message',
      'file.ts',
    ],
  },
  {
    name: '--dr abbreviation',
    args: [
      '--dr',
      '-m',
      'message',
      'file.ts',
    ],
  },
  {
    name: '--short',
    args: [
      '--short',
      '-m',
      'message',
      'file.ts',
    ],
  },
  {
    name: '--sh abbreviation',
    args: [
      '--sh',
      'file.ts',
    ],
  },
  {
    name: '--porcelain',
    args: [
      '--porcelain',
      'file.ts',
    ],
  },
  {
    name: '--por abbreviation',
    args: [
      '--por',
      'file.ts',
    ],
  },
  {
    name: '--long',
    args: [
      '--long',
      'file.ts',
    ],
  },
  {
    name: '--l abbreviation',
    args: [
      '--l',
      'file.ts',
    ],
  },
  {
    name: '-z',
    args: [
      '-z',
      'file.ts',
    ],
  },
  {
    name: '--null',
    args: [
      '--null',
      'file.ts',
    ],
  },
  {
    name: '--nu abbreviation',
    args: [
      '--nu',
      'file.ts',
    ],
  },
];

/** Post-`commit` argv forms that are real commits, not dry runs. */
const REAL_COMMIT_CASES: readonly {
  /** Human-readable case name shown in test output. */
  readonly name: string;
  /** Post-subcommand argv passed to the commit region parser. */
  readonly args: readonly string[];
}[] = [
  {
    name: 'plain message commit',
    args: [
      '-m',
      'message',
      'file.ts',
    ],
  },
  {
    name: 'amend commit',
    args: [
      '--amend',
      '--no-edit',
      'file.ts',
    ],
  },
  {
    name: 'dry-run token past pathspec separator is a pathspec',
    args: [
      '-m',
      'message',
      '--',
      '--dry-run',
    ],
  },
];

await describe({
  name: parseCommitRegion.name,
  children: [
    ...DRY_RUN_CASES.map(function mapDryRunCase(dryRunCase,) {
      return it({
        name: `detects dry run for ${dryRunCase.name}`,
        fn: async function testDryRunCase(): Promise<void> {
          expect(parseCommitRegion(dryRunCase.args,).isDryRun,).toBe(true,);
        },
      },);
    },),
    ...REAL_COMMIT_CASES.map(function mapRealCommitCase(realCase,) {
      return it({
        name: `reports real commit for ${realCase.name}`,
        fn: async function testRealCommitCase(): Promise<void> {
          expect(parseCommitRegion(realCase.args,).isDryRun,).toBe(false,);
        },
      },);
    },),
    it({
      name: 'detects include flag in short, long, and abbreviated forms',
      fn: async function testIncludeFlagForms(): Promise<void> {
        expect(parseCommitRegion([
          '-i',
          'file.ts',
        ],).hasIncludeFlag,)
          .toBe(true,);
        expect(parseCommitRegion([
          '--include',
          'file.ts',
        ],).hasIncludeFlag,)
          .toBe(true,);
        expect(parseCommitRegion([
          '--inc',
          'file.ts',
        ],).hasIncludeFlag,)
          .toBe(true,);
      },
    },),
    it({
      name: 'extracts pathspecs without wrapper flags or option values',
      fn: async function testPathspecExtraction(): Promise<void> {
        expect(parseCommitRegion([
          '--no-enforce-fixture/policy',
          '--author',
          'Author <author@example.invalid>',
          '-m',
          'message',
          'first.txt',
          '--',
          '--dash-path',
        ],).pathspecs,).toEqual([
          'first.txt',
          '--dash-path',
        ],);
      },
    },),
    it({
      name: 'reports no include flag for plain commits',
      fn: async function testNoIncludeFlag(): Promise<void> {
        expect(parseCommitRegion([
          '-m',
          'message',
          'file.ts',
        ],).hasIncludeFlag,)
          .toBe(false,);
      },
    },),
  ],
},);
