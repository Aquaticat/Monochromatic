/**
 Private program state retains original parent, group, slot, and result occurrences. @module
 */
import type { NativeScriptValueGuardError } from './script-value-guard.ts';
import type { NativeReturnConsumer, NativeReturnSlot } from './native-return-types.ts';
import type {
  DeclaredProgramGroup,
  DeclaredResultProgram,
  OriginalProgramView,
  PreparedProgramView,
  ProgramPreparedMember,
  ReachedProgramView
} from './program-declaration-types.ts';

/**
 Execution state is shared with the original judgment's entry and terminal operations.
 */
export type ProgramMemberExecution = {
  readonly token: object;
  state: 'active' | 'returned';
  readonly origin: Readonly<{ signal: AbortSignal }>;
};

/**
 Prepared-member records remain owned by the original judgment across program construction.
 */
export type ProgramMemberRecord = {
  readonly prepared: ProgramPreparedMember;
  readonly parent?: object;
  readonly effectiveSignal: AbortSignal;
  readonly group?: ProgramGroup;
  execution?: ProgramMemberExecution;
  program?: ProgramScope;
  preparedProgram?: Readonly<{
    view: PreparedProgramView;
    assertCurrent: () => void;
  }>;
};

/**
 Original execution lookup authenticates a reserved execution record before program entry.
 */
export type ProgramExecutionRecord = ProgramMemberRecord & { execution: ProgramMemberExecution };

/**
 Program lookup contains only records whose scope has already been published.
 */
export type ProgramOwnerRecord = ProgramExecutionRecord & { program: ProgramScope };

/**
 Native slots add group custody and later member publication to the original return consumer's state.
 */
export type ProgramSlot = Omit<NativeReturnSlot, 'member'> & {
  readonly handle: object;
  readonly group: ProgramGroup;
  readonly ordinal: number;
  member?: object;
};

/**
 Reached-group lifecycle keeps failed construction terminal and inspectable.
 */
export type ProgramGroup = {
  readonly handle: object;
  readonly program: object;
  readonly definition: DeclaredProgramGroup;
  state: 'unreached' | 'reached' | 'binding' | 'bound' | 'preparing' | 'prepared' | 'failed';
  view?: ReachedProgramView;
  slots: ProgramSlot[];
  members?: readonly object[];
  consumer?: NativeReturnConsumer;
  failure?: unknown;
};

/**
 Producer value receipts preserve the exact native invocation and prepared member.
 */
export type ProgramValueReceipt = Readonly<{
  slot: object;
  member?: object;
  native: object;
  value: string;
}>;

/**
 Scope state preserves first guard failure and every distinct original guard occurrence.
 */
export type ProgramScope = {
  readonly handle: object;
  status: 'opening' | 'open' | 'failed';
  declaration?: DeclaredResultProgram;
  view?: OriginalProgramView;
  groups: ProgramGroup[];
  valueReceipt?: ProgramValueReceipt;
  guardFailure?: NativeScriptValueGuardError;
  readonly guardFailures: NativeScriptValueGuardError[];
  readonly seenGuards: WeakSet<NativeScriptValueGuardError>;
  failure?: unknown;
};

/**
 Owner-private maps authenticate opaque handles without relying on copied metadata.
 */
export type ProgramOwnerState = Readonly<{
  programs: WeakMap<object, ProgramOwnerRecord>;
  groups: WeakMap<object, ProgramGroup>;
  slots: WeakMap<object, ProgramSlot>;
}>;

/**
 Bootstrap capabilities retain the original judgment's synchronous dependency and operation boundaries.
 */
export type JudgmentProgramsInput = Readonly<{
  readJudgment: () => object;
  response: object;
  stream: object;
  signal: AbortSignal;
  knownMember: (member: unknown) => ProgramMemberRecord;
  knownExecution: (token: object) => ProgramExecutionRecord;
  ready: () => void;
  dependencyCheck: (assertCurrent: () => void) => void;
  assertDependenciesCurrent: () => void;
  parentCurrent: (record: ProgramMemberRecord) => void;
  bindings: WeakMap<object, ProgramMemberRecord>;
  childGroups: ProgramGroup[];
  operation: <Result>(run: () => Result) => Result;
}>;
