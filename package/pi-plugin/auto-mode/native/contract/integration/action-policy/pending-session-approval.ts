/**
 Capture the existing native confirmation channel before the prepared tool group enters execution. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { AuthorizationFacts } from '../../../../src/authorization-evidence-types.ts';
import type { NativeApprovalHost } from '../native-batch/runtime-types.ts';

/**
 Only the original judgment's preparation and freshness readers are needed here.
 */
type PreparedJudgment = {
  readonly inspect: () => {
    readonly finalRecord?: unknown;
    readonly memberExecutions: readonly { readonly state: string }[];
  };
  readonly assertDependenciesCurrent: () => void;
};

/**
 A fresh confirmation remains unsatisfied until the incumbent approval binder returns its original Allow.
 */
export type PendingSessionApproval = {
  readonly authorization: AuthorizationFacts;
  readonly assertCurrent: () => void;
};

/**
 Original confirmation capabilities must remain bound to the same native review.
 */
export class PendingSessionApprovalError extends Error {
  override name = 'PendingSessionApprovalError';
}

/**
 Diagnostics omit policy text, tool arguments and native session identifiers.
 */
const l = tagged({ tag: 'auto-mode-pending-session-approval' });

//region Channel facts never supply instruction meaning or operation permission

/**
 Capture available native presentation before any confirmation for this prepared group.
 The compiler uses these facts only for an admitted requirement for a fresh current-session response.
 Generic prerequisites retain their independent authorization evidence path.

 @param judgment - original prepared tool group, before evidence closure or execution

 @param host - current original approval capabilities captured by native bootstrap

 @returns pending confirmation facts and their native capability freshness check

 @throws PendingSessionApprovalError when capture occurs after closure or execution, or capabilities change

 @throws original native dependency or stale-context failure
 */
export function capturePendingSessionApproval({ judgment, host }: {
  readonly judgment: PreparedJudgment;
  readonly host?: NativeApprovalHost;
}): PendingSessionApproval {
  /** Keep native confirmation fact capture separate from semantic interpretation. */
  const fl = tagged({ tag: capturePendingSessionApproval.name, l });
  fl.debug('capturing pending original session confirmation');
  judgment.assertDependenciesCurrent();
  /** The current review has neither completed its decision nor entered a tool. */
  const state = judgment.inspect();
  if ((state.finalRecord !== undefined) || (state.memberExecutions.length === 0)
    || state.memberExecutions.some(function entered(member) { return member.state !== 'unentered'; }))
    throw new PendingSessionApprovalError('Fresh session confirmation must be captured before the original prepared group is decided or entered');
  /** Borrowed native capabilities retain identity through the existing approval binder. */
  const ui = host?.ctx.ui;
  /** The original host decides whether a live presentation channel exists. */
  const hasUI = host?.ctx.hasUI === true;
  /** Selection identity cannot be replaced during semantic assessment. */
  const select = ui?.select;
  /** Verdict recording is part of the original confirmation path. */
  const appendEntry = host?.pi.appendEntry;
  /** Stop must continue to abort the same native session. */
  const abort = host?.ctx.abort;
  /** An unavailable presentation path cannot satisfy an approval requirement. */
  const available = hasUI && typeof select === 'function' && typeof appendEntry === 'function' && typeof abort === 'function';

  /**
   Recheck original capabilities without requesting a response or creating permission.

   @throws PendingSessionApprovalError when original native presentation capabilities change

   @throws original dependency or stale native context failure
   */
  function assertCurrent(): void {
    /** Currentness is checked again after assessment and at execution boundaries. */
    const cl = tagged({ tag: assertCurrent.name, l: fl });
    cl.debug('checking original pending confirmation capabilities');
    judgment.assertDependenciesCurrent();
    if ((host?.ctx.ui !== ui) || ((host?.ctx.hasUI === true) !== hasUI)
      || (ui?.select !== select) || (host?.pi.appendEntry !== appendEntry) || (host?.ctx.abort !== abort))
      throw new PendingSessionApprovalError('Original session confirmation capabilities changed during tool review');
  }
  assertCurrent();
  return Object.freeze({
    authorization: Object.freeze({ satisfaction: 'unsatisfied', channel: available ? 'incumbent-approval' : 'unsupported' }),
    assertCurrent,
  });
}

//endregion Original pending confirmation facts
