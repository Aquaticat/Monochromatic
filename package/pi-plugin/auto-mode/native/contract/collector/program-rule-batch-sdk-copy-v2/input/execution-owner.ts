/**
 Execution ownership composes original custody and native entry without reading live dependencies eagerly. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { createExecutionOwnership } from './execution-ownership.ts';
import { createExecutionEntry } from './execution-entry.ts';
import type {
  JudgmentExecutionInput,
  JudgmentExecutionOwnership,
  JudgmentExecutionEntry
} from './execution-types.ts';
import type { ProgramMemberRecord } from './program-state-types.ts';

/**
 Diagnostics never include native input, original source, or opaque execution identities.
 */
const l = tagged({ tag: 'auto-mode-judgment-executions' });

//region Original judgment owns the execution map for its entire retained lifetime.
/**
 Allocate original execution custody shared by native entry and program ownership.

 @param input - original member records, closure state, and enclosing identities

 @returns original execution operation surface

 @example createJudgmentExecutions(input);
 */
export function createJudgmentExecutions(input: JudgmentExecutionInput): JudgmentExecutionOwnership & JudgmentExecutionEntry {
  /**
   Construction diagnostics do not read lazy judgment or closure capabilities.
   */
  const rl = tagged({
    tag: createJudgmentExecutions.name,
    l
  });
  rl.debug('binding original execution ownership');
  /**
   Only successful entry reservation publishes an original member record here.
   */
  const executions = new WeakMap<object, ProgramMemberRecord>();
  /**
   Original custody and entry methods share exactly one private execution map.
   */
  const context = {
    input,
    executions
  };
  /**
   Identity readers are reused by execution and program operations.
   */
  const ownership = createExecutionOwnership(context);
  return {
    ...ownership,
    ...createExecutionEntry({
      ...context,
      ownership
    })
  };
}
//endregion
