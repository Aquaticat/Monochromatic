import {
  idListFlag,
  wholeNumberFlag,
} from './command-flags.ts';

//region Coverage probe arguments
// What the coverage probe is asked on its command line, kept apart from the
// probe so the reading can be tested without a subprocess, as
// `judge-fidelity-args.ts` and `rendering-audit-settled-args.ts` are. All
// three read their flags through `command-flags.ts` (ledger B73).

/**
 How many candidates one invocation asks about by default.

 Small on purpose: the first run of anything that spends quota should be
 readable in full before a larger one is bought.

 COUNTED IN ATTEMPTS RATHER THAN IN ROWS, because a cap on successes lets a
 failing roster spend without bound and hides the failures from the count a
 reader checks.
 */
export const DEFAULT_CANDIDATE_CAP = 12;

/**
 Reads the entry filter and cap from the command line.

 @param argv - process arguments, passed rather than read so this is testable
 without a subprocess

 @returns Entry ids to probe, empty for every entry, and the candidate cap

 @throws StatedRefusalError when a flag was written without a usable value:
 nothing after it, a cap that is not a whole number written in digits or is
 below zero, or an entry filter naming no entry

 @example
 ```ts
 const { onlyIds, cap, } = readCoverageProbeArguments({ argv: process.argv, },);
 ```
 */
export function readCoverageProbeArguments(
  { argv, }: { readonly argv: readonly string[]; },
): {
  readonly onlyIds: readonly string[];
  readonly cap: number;
} {
  /**
   Arguments after the script path.
   */
  const args = argv
    .slice(2,);
  return {
    onlyIds: idListFlag({
      args,
      flag: '--only',
    },),
    cap: wholeNumberFlag({
      args,
      flag: '--cap',
      unwritten: DEFAULT_CANDIDATE_CAP,
      leaveOffTo: `ask about the default of ${String(DEFAULT_CANDIDATE_CAP,)} candidates`,
    },),
  };
}

//endregion Coverage probe arguments
