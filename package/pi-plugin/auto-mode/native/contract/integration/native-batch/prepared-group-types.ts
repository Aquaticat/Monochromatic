/** Shared group state is internal to the native caller and policy compiler. @module */
import type { JudgmentMembershipSnapshot, JudgmentResponseInput } from '../../collector/program-rule-batch-sdk-copy-v2/input/judgment-member-types.ts';
import type { ProgramMemberRecord, ProgramGroup } from '../../collector/program-rule-batch-sdk-copy-v2/input/program-state-types.ts';
import type { InstructionMember } from '../../collector/program-rule-batch-sdk-copy-v2/input/instruction-types.ts';
import type { ProgramPreparedMember } from '../../collector/program-rule-batch-sdk-copy-v2/input/program-declaration-types.ts';
import type { JudgmentExecutionInput, JudgmentExecutionOwnership, JudgmentExecutionEntry } from '../../collector/program-rule-batch-sdk-copy-v2/input/execution-types.ts';

//region One group owns root membership and every native execution occurrence.
/** Policy construction borrows the native caller's state instead of allocating another execution owner. */
export type PreparedGroupContext = JudgmentMembershipSnapshot & Readonly<{
  bindings: WeakMap<object, ProgramMemberRecord & InstructionMember>;
  byMember: Map<string, object>;
  childGroups: ProgramGroup[];
  executions: JudgmentExecutionOwnership & JudgmentExecutionEntry;
  prepare: (members: readonly ProgramPreparedMember[]) => void;
  preparedJSON: (members: readonly ProgramPreparedMember[]) => string;
}>;

/** Callbacks remain private to the original complete group's native and review lifetimes. */
export type PreparedGroupContextInput = Pick<JudgmentExecutionInput,
  'readClosure' | 'readJudgment' | 'assertDependenciesCurrent' | 'stream'> & Readonly<{
  response: JudgmentResponseInput;
  signal: AbortSignal;
}>;
//endregion
