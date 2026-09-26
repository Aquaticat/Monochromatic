/**
 Policy results for landings that found the target moved or `HEAD` switched.

 Every `concurrent-commit` finding exits `1` and leaves ref,
 real index,
 and worktree bytes unchanged by cli-git.

 @module
 */
import type {
  InvocationCapture,
  PreparationBase,
  SymbolicHeadTarget,
} from './commit-transaction-capture.ts';
import { createCoreFindingEvent, } from './events.ts';
import type { LandingOutcome, } from './commit-landing.ts';
import type { PolicyEngineResult, } from './types.ts';

/**
 Describes a target value.

 @param value - target value

 @returns commit OID or `unborn`
 */
function describeTarget(value: PreparationBase,): string {
  return value.kind === 'commit' ? value.oid : 'unborn';
}

/**
 Describes a symbolic `HEAD` target.

 @param value - symbolic target

 @returns ref name or `detached HEAD`
 */
function describeHead(value: SymbolicHeadTarget,): string {
  return value.kind === 'branch' ? value.ref : 'detached HEAD';
}

/**
 Builds the finding message of an outcome that landed nothing.

 @param outcome - failed landing outcome

 @param capture - invocation capture

 @param preparedOid - prepared commit, absent for a normalization

 @param replayPlumbingMissing - whether the commit could have replayed on a Git with `git merge-tree --merge-base`

 @returns finding code and message
 */
function outcomeFinding({
  outcome,
  capture,
  preparedOid,
  replayPlumbingMissing,
}: Readonly<{
  outcome: Exclude<LandingOutcome, Readonly<{ kind: 'landed'; }>>;
  capture: InvocationCapture;
  preparedOid?: string;
  replayPlumbingMissing: boolean;
}>,): Readonly<{
  code: 'head-moved' | 'branch-switched';
  message: string;
}> {
  /**
   Commit the finding names, when one was prepared.
   */
  const prepared = preparedOid === undefined ? '' : ` The prepared commit ${preparedOid} was discarded.`;
  if (outcome.kind === 'branch-switched')
    return {
      code: 'branch-switched',
      message: `HEAD now names ${describeHead(outcome.current,)} instead of ${describeHead(capture.symbolicHead,)} as it did when this commit started; nothing landed.${prepared} Switch back or commit again on the current branch.`,
    };
  /**
   Why this commit cannot move onto the new target.
   */
  const reason = replayPlumbingMissing
    ? 'this Git cannot replay it: its `git merge-tree` has no `--merge-base` option (Git 2.40.0 or later has it)'
    : (capture.conclusion === 'none'
      ? 'the target no longer names a commit to replay it onto'
      : `an ${capture.conclusion === 'amend' ? 'amend' : `${capture.conclusion} conclusion`} is never replayed`);
  return {
    code: 'head-moved',
    message: `${capture.targetRef} moved from ${describeTarget(capture.base,)} to ${describeTarget(outcome.current,)} while this commit was prepared, and ${reason}; nothing landed.${prepared} Commit again against the new ${capture.targetRef}.`,
  };
}

/**
 Blocking policy result for a landing that landed nothing.

 @param pass - settled policy pass whose events precede the finding

 @param outcome - failed landing outcome

 @param capture - invocation capture

 @param preparedOid - prepared commit, absent for a normalization

 @param replayPlumbingMissing - whether the commit could have replayed on a Git with `git merge-tree --merge-base`

 @returns blocking result with exit `1`

 @example
 ```ts
 landingFindingResult({ pass, outcome, capture, preparedOid });
 ```
 */
export function landingFindingResult({
  pass,
  outcome,
  capture,
  preparedOid,
  replayPlumbingMissing = false,
}: Readonly<{
  pass: PolicyEngineResult;
  outcome: Exclude<LandingOutcome, Readonly<{ kind: 'landed'; }>>;
  capture: InvocationCapture;
  preparedOid?: string;
  replayPlumbingMissing?: boolean;
}>,): PolicyEngineResult {
  /**
   Finding code and message.
   */
  const finding = outcomeFinding({
    outcome,
    capture,
    ...(preparedOid === undefined ? {} : { preparedOid, }),
    replayPlumbingMissing,
  },);
  return {
    ...pass,
    events: [
      ...pass.events,
      createCoreFindingEvent({
        sequence: pass.events
          .length,
        coreId: 'concurrent-commit',
        code: finding.code,
        message: finding.message,
      },),
    ],
    patches: [],
    exitCode: 1,
    shouldForward: false,
  };
}
