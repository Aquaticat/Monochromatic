/** Allocate native membership once, independently of whether automatic policy collection succeeds. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { captureJudgmentMembership } from '../../collector/program-rule-batch-sdk-copy-v2/input/judgment-membership.ts';
import { capturePreparedJudgmentJSON } from '../../collector/program-rule-batch-sdk-copy-v2/input/judgment-prepared-input.ts';
import { publishJudgmentMembers } from '../../collector/program-rule-batch-sdk-copy-v2/input/judgment-preparation-publication.ts';
import { createJudgmentExecutions } from '../../collector/program-rule-batch-sdk-copy-v2/input/execution-owner.ts';
import { JudgmentConstructionError } from '../../collector/program-rule-batch-sdk-copy-v2/input/judgment-error.ts';
import type { PreparedGroupContext, PreparedGroupContextInput } from './prepared-group-types.ts';

//region Preparation and policy collection share the same original records.
/** Construct state without reading live execution eligibility before the caller reaches native entry.
 @param input - original group identities and lazy entry checks
 @returns shared membership and execution state
 */
export function createPreparedGroupContext(input: PreparedGroupContextInput): PreparedGroupContext {
  /** Logging identifies ownership without retaining operation inputs. */
  const l = tagged({ tag: createPreparedGroupContext.name, l: tagged({ tag: 'auto-mode-prepared-group' }) });
  l.debug('allocating original native group state');
  /** Membership is captured at the original source-construction boundary. */
  const membership = captureJudgmentMembership(input.response);
  /** Root and child policy bindings refer to these same native member records. */
  const bindings: PreparedGroupContext['bindings'] = new WeakMap();
  /** Identifier lookup preserves original declaration order. */
  const byMember: PreparedGroupContext['byMember'] = new Map();
  /** Reached program groups retain their original shared owner. */
  const childGroups: PreparedGroupContext['childGroups'] = [];
  /** Serialization is published only after the complete native preparation is admitted. */
  const state: { members?: Parameters<PreparedGroupContext['prepare']>[0]; json?: string } = {};
  /** Native entry uses the compiler's original dependency check without reentering its public operation wrapper. */
  const source: { check?: () => unknown } = {};
  /** Native caller, automatic review, and manual review share one execution map. */
  const executions = createJudgmentExecutions({ ...input, bindings, byMember });

  /** Bind the original compiler dependency check once source construction reaches that boundary. */
  function bindSourceCheck(check: () => unknown): void {
    tagged({ tag: bindSourceCheck.name, l }).debug('binding original source dependency check');
    if (source.check !== undefined) throw new JudgmentConstructionError('Native group already has its original source check');
    source.check = check;
  }
  /** Validate dependencies directly while an enclosing compiler operation already owns reentrancy protection. */
  function assertSourceCurrent(): void {
    tagged({ tag: assertSourceCurrent.name, l }).debug('checking original source dependencies');
    if (source.check === undefined) throw new JudgmentConstructionError('Native group has no original source dependency check');
    source.check();
  }

  /** Publish complete prepared members before choosing automatic or manual review. */
  function prepare(members: Parameters<PreparedGroupContext['prepare']>[0]): void {
    tagged({ tag: prepare.name, l }).debug('publishing complete native membership');
    if (state.members !== undefined) throw new JudgmentConstructionError('Native group preparation cannot be repeated');
    /** Capture before publishing so a partial or replaced group cannot acquire executable members. */
    const json = capturePreparedJudgmentJSON({ members, declaredNames: membership.declaredNames });
    publishJudgmentMembers({ members, bindings, byMember, signal: input.signal });
    state.members = members;
    state.json = json;
  }

  /** Read the native caller's serialization rather than cloning another prepared group. */
  function preparedJSON(members: Parameters<PreparedGroupContext['prepare']>[0]): string {
    tagged({ tag: preparedJSON.name, l }).debug('reading original prepared membership');
    if (state.members !== members || state.json === undefined)
      throw new JudgmentConstructionError('Policy review requires this native group\'s exact prepared members');
    return state.json;
  }

  return Object.freeze({ ...membership, bindings, byMember, childGroups, executions, prepare, preparedJSON,
    bindSourceCheck, assertSourceCurrent });
}
//endregion
