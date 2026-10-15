/**
 Original runner binding shares parent scope and associates native member signals by call identity. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { requireProgramScope } from './program-scope.ts';
import type { NativeReturnCall } from './native-return-types.ts';
import type { ProgramNativeCall } from './program-operation-types.ts';
import type {
  ProgramRunnerBinding,
  ProgramRunnerBindingInput,
  ProgramRunnerGroup
} from './program-runner-binding-types.ts';

/**
 Binding diagnostics omit original arguments, tool labels, and parent identifiers.
 */
const l = tagged({ tag: 'auto-mode-program-runner-binding' });

/** Copy native options with JavaScript spread semantics before replacing only the original member signal.
 @param options - original native callback options, including opaque primitive spread inputs
 
 @param readSignal - original member lookup evaluated after native option getters
 
 @returns original enumerable options with the member's cancellation source
 */
function memberOptions<const Options>({
  options,
  readSignal
}: Readonly<{
  options: Options;
  readSignal: () => ProgramRunnerGroup['members'][number]['signal'];
}>): Options & Readonly<{ signal: ProgramRunnerGroup['members'][number]['signal'] }> {
  /** Option copying preserves original getter order before native member lookup. */
  const ol = tagged({ tag: memberOptions.name, l });
  ol.debug('copying original native options before reading member cancellation');
  return {
    ...options,
    signal: readSignal()
  };
}

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
   Capture the native function once and invoke it without binding a replacement receiver.
   */
  const nativeRun = runner.host
    .runOwnedToolCall;
  /** Forward original native call after copying options and resolving its member signal.
   @param call - original native call identity supplied by the judgment
   @param options - original opaque native option spread input
   @returns exact native callback return value
   */
  function runNative(
      call: NativeReturnCall,
      options: unknown
    ): unknown {
      /**
       Native callback logs identify the boundary without inspecting opaque options or arguments.
       */
      const nl = tagged({
        tag: runNative.name,
        l: rl
      });
      nl.debug('forwarding original native member with its associated cancellation');
      /** Read member cancellation only after original option spread getters complete.
       @returns original reached member signal
       */
      function readMemberSignal(): ProgramRunnerGroup['members'][number]['signal'] {
        /** Bound call lookup follows the original native option-copy boundary. */
        const sl = tagged({ tag: readMemberSignal.name, l: nl });
        sl.debug('reading original bound native member cancellation');
        /** Successfully bound calls have their original member ordinal before native entry. */
        const ordinal = nonNullishOrThrow(ordinals.get(call.id));
        /** Original complete-group association remains the source of the member signal. */
        const member = nonNullishOrThrow(group.members[ordinal]);
        return member.signal;
      }
      return nativeRun(
        call,
        memberOptions({
          options,
          readSignal: readMemberSignal
        })
      );
    }
  /** Judgment admission receives original tool lookup results, including absent definitions. */
  const slots = origin.judgment.bindProgramCalls({
    group: group.handle,
    calls,
    tools: calls.map(function readNativeDefinition(call) {
      return tools.find(function matchesCall(tool) {
        return tool.name === call.name;
      });
    }),
    runNative,
  });
  rl.debug('published original native slots and member result tickets');
  return {
    scope,
    calls,
    ordinals,
    tools,
    slots,
    tickets: calls.map(function createResultTicket() { return Promise.withResolvers<unknown>(); })
  };
}
//endregion
