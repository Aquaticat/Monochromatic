//region Probe arguments barrel
// What an operator types to the corpus-run runners: the one reader of the
// whole command line and the declaration of what each runner reads (ledger
// B75), the readers of flag values every probe and audit shares, the bare
// count a bench is asked for, and the coverage and fidelity probes' flags.
// Split out of `corpus-barrel.ts` when that file reached its line budget, at
// the seam its earlier splits used, by AUDIENCE: these readers answer to the
// person at the command line, and the pass driver calls none of them. They are
// here so their tests can import them like every sibling's.

export { readAskedCount, } from './corpus-run/asked-count.ts';
export {
  idListFlag,
  wholeNumberFlag,
  writtenOr,
} from './corpus-run/command-flags.ts';
export type {
  CommandLineFor,
  CommandLineSpec,
  FlagValue,
  PositionalSpec,
} from './corpus-run/command-line-types.ts';
export { readCommandLine, } from './corpus-run/command-line.ts';
export {
  COMMAND_LINES,
  type CommandLineOf,
  type CommandName,
} from './corpus-run/command-lines.ts';
export {
  DEFAULT_CANDIDATE_CAP,
  readCoverageProbeArguments,
} from './corpus-run/coverage-probe-args.ts';
export {
  DAMAGE_KINDS,
  DEFAULT_TRIAL_CAP,
  readFidelityArguments,
} from './corpus-run/judge-fidelity-args.ts';

//endregion Probe arguments barrel
