import { contextRoot, } from '../log-context.ts';
import { reportingRefusals, } from './cli-refusal.ts';
import type { CommandLineOf, } from './command-lines.ts';
import {
  packageCommit,
  sourcesEditedSince,
} from './coverage-census-commit.ts';
import { placeTally, } from './coverage-census-place.ts';
import { runCoverageCensus, } from './coverage-census-run.ts';
import {
  runSuite,
  tallyCoverage,
} from './coverage-census-steps.ts';

//region Coverage census
// LEDGER T8: which package code the unit suite never runs, as a command: the
// wiring only. What it does, and how it reads the command line, is
// `coverage-census-run.ts`, which says what it measures and how a batch proves
// its reach; the pieces are `coverage-census-build.ts`,
// `coverage-census-reading.ts` and `coverage-census-baseline-lines.ts`. What a
// real process has is the package directory it stands in, its environment and
// the steps that touch git, the suite and the coverage.
//
// RUN FROM THE PACKAGE DIRECTORY, which the task does:
// `mise run //package/module/translation-repair:coverage-census`.

/**
 Logger for the census's progress lines, apart from the report on stdout.
 */
const censusLog = contextRoot({ tag: 'coverage-census', },);

if (import.meta.main)
  await reportingRefusals({
    what: 'coverage-census',
    argv: process.argv,
    run: function runCensus({ line, }: { readonly line: CommandLineOf<'coverage-census'>; },): Promise<void> {
      return runCoverageCensus({
        line,
        packageDirectory: process.cwd(),
        env: process.env,
        steps: {
          packageCommit,
          runSuite,
          tallyCoverage,
          placeTally,
          sourcesEditedSince,
        },
        l: censusLog,
      },);
    },
  },);

//endregion Coverage census
