/**
 Original runner binding shares parent scope and associates native member signals by call identity. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { requireProgramScope } from './program-scope.ts';
import type { ProgramNativeCall } from './program-operation-types.ts';
import type {
  ProgramRunnerBinding,
  ProgramRunnerBindingInput,
} from './program-runner-binding-types.ts';

/**
 Binding diagnostics omit original arguments, tool labels, and parent identifiers.
 */
const l = tagged({ tag: 'auto-mode-program-runner-binding' });



//region Original scope counters, complete native calls, and result slots remain one binding operation.
/** Bind original source members to native callbacks while preserving parent recorder and call numbering.
 @param runner - original runner whose native callback is captured once
 
 @param tools - original complete request tool snapshot
 
 @param origin - original prepared parent and judgment owner
 
 @param carrier - original execution occurrence token
 
 @param group - original complete reached member association
 
 @param assertParentCurrent - original parent eligibility check before scope access
 
 @param NestedCallRecorder - original recorder constructor used only for a new scope
 
 @returns original shared scope, complete native calls, admitted slots, and unresolved result tickets
 
 @example bindReachedProgramGroup({ runner, tools, origin, carrier, group, assertParentCurrent, NestedCallRecorder });
 */
export function bindReachedProgramGroup<const Recorder extends object>({
  runner,
  tools,
  origin,
  carrier,
  group,
  assertParentCurrent,
  NestedCallRecorder,
}: ProgramRunnerBindingInput<Recorder>): ProgramRunnerBinding<Recorder> {
  /**
   Native call binding retains the original parent and judgment ownership boundary.
   */
  const rl = tagged({
    tag: bindReachedProgramGroup.name,
    l
  });
  rl.debug('binding original reached native group');
  assertParentCurrent();
  /**
   Parent identifier supplies native child labels without replacing its private scope owner.
   */
  const parentId = origin.prepared
    .id;
  /**
   Reached groups reuse one original parent recorder and monotonically increasing call counter.
   */
  const scope = requireProgramScope({
    runner,
    carrier,
    parentId,
    NestedCallRecorder
  });
  /**
   Complete member association preserves original argument objects and declared order.
   */
  const calls = group.members
    .map(function createNativeChildCall(member): ProgramNativeCall {
    return {
      type: 'toolCall',
      id: `${parentId}/${scope.nextId++}`,
      name: member.declaration
        .name,
      arguments: member.declaration
        .args
    };
  });
  /**
   Native callback identifiers select only their original member ordinal.
   */
  const ordinals = new Map(calls.map(function indexNativeCall(
    call,
    index
  ) {
    return [
      call.id,
      index
    ] as const;
  }));
  /**
   Judgment admission receives original tool lookup results, including absent definitions.
   */
  const slots = origin.judgment
    .bindProgramCalls({
    group: group.handle,
    calls,
    tools: calls.map(function readNativeDefinition(call) {
      return tools.find(function matchesCall(tool) {
        return tool.name === call.name;
      });
    }),
  });
  rl.debug('published original native slots and member result tickets');
  return {
    scope,
    calls,
    ordinals,
    tools,
    slots,
    tickets: calls.map(function createResultTicket() { 
      return Promise.withResolvers<unknown>(); 
    })
  };
}
//endregion
