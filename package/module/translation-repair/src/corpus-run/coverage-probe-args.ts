//region Coverage probe arguments
// What the coverage probe is asked on its command line, kept apart from the
// probe so the reading can be tested without a subprocess, as
// `judge-fidelity-args.ts` and `rendering-audit-settled-args.ts` are.

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

  /**
   Entry ids named after `--only`, comma separated.
   */
  const onlyAt = args.indexOf('--only',);

  /**
   Cap named after `--cap`.
   */
  const capAt = args.indexOf('--cap',);

  /**
   Cap as written, when one was named.
   */
  const capText = (capAt === (-1)) ? '' : (args[capAt + 1] ?? '');

  /**
   Cap as a number, falling back when it is not one.
   */
  const cap = (capText === '')
    ? Number.NaN
    : Math.trunc(Number(capText,),);
  return {
    onlyIds: (onlyAt === (-1))
      ? []
      : (args[onlyAt + 1] ?? '')
        .split(',',)
        .filter(function isNamed(id,): boolean {
          return id !== '';
        },),
    cap: Number.isNaN(cap,) ? DEFAULT_CANDIDATE_CAP : cap,
  };
}

//endregion Coverage probe arguments
