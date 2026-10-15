/** Original program runtime links declared source sites to reached native collectors. @module */
import type { JudgmentPrograms } from './program-api.ts';
import type { GroupCollector, GroupCollectorInput, GroupCollectorTool } from './group-collector-types.ts';
import type { GroupLifetimeInspection } from './group-lifetime-types.ts';
import type { DeclaredResultProgram, ReachedProgramView } from './program-declaration-types.ts';

/** Native script-value consumption retains original reached-group identity and opaque outcomes. */
export type ProgramRuntimeValueInput = Readonly<{ group: object; ordinal: number; outcome: unknown }>;
/** Runtime consumes only the original judgment operations required for reached execution. */
export type ProgramRuntimeJudgment = Pick<JudgmentPrograms, 'programFor' | 'reachProgramGroup' | 'reachedGroupFor' | 'markProgramGuard' | 'inspectProgram'>;
/** Original source execution retains its parent capabilities and complete-group native consumer. */
export type ProgramRuntimeInput<Value> = Readonly<{
  judgment: ProgramRuntimeJudgment;
  program: object;
  signal: AbortSignal;
  assertParentCurrent: () => unknown;
  dispatchGroup: GroupCollectorInput['dispatchGroup'];
  scriptValueFor: (input: ProgramRuntimeValueInput) => Value;
}>;
/** Reached group entries retain canonical view identity and their original collector. */
export type ProgramRuntimeEntry = Readonly<{ view: ReachedProgramView; run: GroupCollector }>;
/** Runtime inspection exposes retained transport observations without granting current eligibility. */
export type ProgramRuntimeInspection = Readonly<{
  retainedOnly: true;
  closed: boolean;
  reachedGroups: readonly Readonly<{ ordinal: number; collector: GroupLifetimeInspection<unknown> }>[];
}>;
/** Original runtime retirement, draining, and inspection remain independently callable. */
export type ProgramRuntimeLifetime = Readonly<{
  retire: () => void;
  drain: () => Promise<void>;
  inspect: () => ProgramRuntimeInspection;
}>;
/** Public runtime retains source declaration and original tool membership before script-value access. */
export type ProgramRuntime<Value> = ProgramRuntimeLifetime & Readonly<{
  declaration: DeclaredResultProgram;
  tools: readonly GroupCollectorTool[];
  valueFor: (input: Readonly<{ tool: object; outcome: unknown }>) => Value;
}>;
/** Original lifetime operations consume group lifetimes without inspecting native execution authority. */
export type ProgramRuntimeLifetimeInput = Readonly<{
  judgment: Pick<JudgmentPrograms, 'markProgramGuard' | 'inspectProgram'>;
  program: object;
  lifetime: { closed: boolean };
  reached: ReadonlyMap<number, Readonly<{ run: Pick<GroupCollector, 'retire' | 'drain' | 'inspect'> }>>;
}>;
