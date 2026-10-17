/**
 Original dispatch callbacks preserve reached-member admission and native call ownership. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { NativeReturnEntry } from './native-return-types.ts';
import type { ProgramPreparedMember } from './program-declaration-types.ts';
import type {
  ProgramExecutionCallbacks,
  ProgramExecutionCallbacksInput,
  ProgramNativePhasePipeline
} from './program-runner-execution-types.ts';

/** Each genuine slot retains its actual preparation, per-call signal, and terminal continuation. */
type ChildNativePhase = { lifetime: NativeReturnEntry; pipeline?: ProgramNativePhasePipeline; prepared?: unknown };

/**
 Dispatch diagnostics omit prepared member arguments and opaque host hooks.
 */
const l = tagged({ tag: 'auto-mode-program-runner-execution-callbacks' });

//region Native callbacks preserve original admission publication and callback receivers.
/** Create the original group callbacks over one retained assessment publication.
 @param runner - original host for native preparation and completion hooks
 
 @param judgment - original judgment captured before host callbacks
 
 @param group - original complete reached member association
 
 @param bound - original native identifiers and admitted slots
 
 @param assertParentCurrent - original parent currentness check
 
 @param parentId - original prepared parent identifier
 
 @param assessment - original mutable prepared member publication
 
 @returns original native dispatch callbacks
 
 @example createProgramExecutionCallbacks({ runner, judgment, group, bound, assertParentCurrent, parentId, assessment });
 */
export function createProgramExecutionCallbacks({
  runner,
  judgment,
  group,
  bound,
  assertParentCurrent,
  parentId,
  assessment,
  context,
  response,
  signal
}: ProgramExecutionCallbacksInput): ProgramExecutionCallbacks {
  /**
   Factory diagnostics retain callback boundary tags.
   */
  const cl = tagged({
    tag: createProgramExecutionCallbacks.name,
    l
  });
  cl.debug('creating original reached-group execution callbacks');
  /**
   Native identifier lookup selects only original group member ordinals.
   */
  const {
    ordinals,
    slots
  } = bound;
  /** The SDK phase factory is captured before preparation callbacks can replace host properties. */
  const phaseFactory = runner.host.createOwnedToolPhases;
  /** Native call associations remain private to this reached group. */
  const nativeCalls = new Map<string, ChildNativePhase>();
  /**
   Native dispatcher dictates positional callbacks while private publication remains shared.
   */
  const callbacks: ProgramExecutionCallbacks = {
    /** Read the original admitted execution handle only after assessment publication.
     @param id - original native call identifier
     @returns original prepared execution handle
     @throws Error when no original admitted execution handle exists
     */
    memberForExecution(
      this: void,
      id: string
    ): object {
      /**
       Lookup diagnostics never inspect the caller's native identifier.
       */
      const ml = tagged({
        tag: callbacks.memberForExecution
          .name,
        l: cl
      });
      ml.debug('reading original admitted member handle');
      /**
       Missing assessment must reject before even consulting the native ordinal map.
       */
      const { handles } = assessment;
      if (handles === undefined) throw new Error('Prepared child has no owned execution handle');
      /**
       Original call association is consulted only after prepared members exist.
       */
      const ordinal = ordinals.get(id);
      if (ordinal === undefined) throw new Error('Prepared child has no owned execution handle');
      /**
       Sparse or absent original handles remain rejected at the native boundary.
       */
      const member = handles[ordinal];
      if (!member) throw new Error('Prepared child has no owned execution handle');
      return member;
    },
    /** The actual slot owns reservation and terminal capture across SDK phases. */
    nativePhases: {
      async prepare({call,before}) {
        const nl = tagged({tag: callbacks.nativePhases.prepare.name, l: cl});
        nl.debug('reserving original child before native preparation');
        const ordinal = nonNullishOrThrow(ordinals.get(call.id));
        const slot = nonNullishOrThrow(slots[ordinal]);
        const lifetime = slot.open(call);
        const record: ChildNativePhase = {lifetime};
        nativeCalls.set(call.id,record);
        const memberSignal = nonNullishOrThrow(group.members[ordinal]).signal ?? signal;
        const pipeline = phaseFactory({tools:bound.tools,context,
          assistantMessage:response,signal:memberSignal});
        record.pipeline = pipeline;
        record.prepared = await pipeline.prepare({call,before});
        return record.prepared;
      },
      run(input) {
        tagged({tag: callbacks.nativePhases.run.name, l: cl}).debug('running original prepared child');
        const record = nonNullishOrThrow(nativeCalls.get(input.call.id));
        if(record.prepared!==input.prepared)throw new Error('Child execution requires its original native preparation');
        return nonNullishOrThrow(record.pipeline).run(input);
      },
      retain({call,outcome}) {
        tagged({tag: callbacks.nativePhases.retain.name, l: cl}).debug('retaining original child completion');
        nonNullishOrThrow(nativeCalls.get(call.id)).lifetime.complete(outcome);
      },
      failed({call,error}) {
        tagged({tag: callbacks.nativePhases.failed.name, l: cl}).debug('retaining child native phase failure');
        nativeCalls.get(call.id)?.lifetime.fail(error);
      }
    },
    /** Forward original preparation to the original host and parent.
     @param hook - opaque native preparation hook
     @returns original host preparation result
     */
    prepare(
      this: void,
      hook: unknown
    ): unknown {
      /**
       Preparation logs identify the host boundary without reading opaque hook contents.
       */
      const pl = tagged({
        tag: callbacks.prepare
          .name,
        l: cl
      });
      pl.debug('forwarding original native preparation');
      return runner.host
        .prepareOwnedToolCall(
          hook,
          parentId
        );
    },
    /** Forward original completion to the original host and parent.
     @param hook - opaque native completion hook
     @returns original host completion result
     */
    after(
      this: void,
      hook: unknown
    ): unknown {
      /**
       Completion logs retain the original callback boundary.
       */
      const al = tagged({
        tag: callbacks.after
          .name,
        l: cl
      });
      al.debug('forwarding original native completion');
      return runner.host
        .finishOwnedToolCall(
          hook,
          parentId
        );
    },
    /**
     Recheck parent currentness before reading original reached-group eligibility.
     */
    assertFresh(this: void): void {
      /**
       Original parent validation precedes original group validation.
       */
      const fl = tagged({
        tag: callbacks.assertFresh
          .name,
        l: cl
      });
      fl.debug('checking original parent and reached group');
      assertParentCurrent();
      judgment.reachedGroupFor(group.handle);
    },
    /** Publish original prepared member handles only after complete group admission returns.
     @param members - complete original native prepared group
     @returns original non-blocking native transport decision after successful admission
     */
    assess(
      this: void,
      { members }: Readonly<{ members: readonly ProgramPreparedMember[] }>
    ): Readonly<{ block: false }> {
      /**
       Assessment publication retains the original judgment as sole admission owner.
       */
      const al = tagged({
        tag: callbacks.assess
          .name,
        l: cl
      });
      al.debug('admitting original complete reached member group');
      assessment.handles = judgment.prepareReachedMembers({
        group: group.handle,
        members,
        nativeSignals: group.members
          .map(function readMemberSignal(member) {
          return member.signal;
        })
      });
      return { block: false };
    }
  };
  return callbacks;
}
//endregion
