/** Original runtime retirement and draining retain already reached native work. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import type { ProgramRuntimeLifetime, ProgramRuntimeLifetimeInput, ProgramRuntimeInspection } from './program-runtime-types.ts';

/** Runtime lifetime logs omit original guard failures and native result contents. */
const l = tagged({ tag: 'auto-mode-program-runtime-lifetime' });

//region Retirement closes entry first while draining and inspection retain original native work.
/** Bind original reached-program lifetime without reconstructing its native execution.
 @param judgment - original guard retention and retained inspection owner
 @param program - original open program identity
 @param lifetime - original shared runtime closure state
 @param reached - original reached groups in insertion order
 @returns original retirement, draining, and retained inspection operations
 @example createProgramRuntimeLifetime({ judgment, program, lifetime, reached });
 */
export function createProgramRuntimeLifetime({ judgment, program, lifetime, reached }: ProgramRuntimeLifetimeInput): ProgramRuntimeLifetime {
  /** Lifetime operations share original closure state with live program entry. */
  const rl = tagged({ tag: createProgramRuntimeLifetime.name, l });
  rl.debug('binding original reached-program lifetime');
  /** Publish runtime closure before retiring original reached collectors in insertion order. */
  function retire(): void {
    /** Retirement logs distinguish first publication from an already closed runtime. */
    const tl = tagged({ tag: retire.name, l: rl });
    if (lifetime.closed) {
      tl.debug('original program runtime already closed');
      return;
    }
    lifetime.closed = true;
    tl.debug('retiring original reached collectors');
    for (const { run } of reached.values()) run.retire();
  }
  /** Drain the captured reached work before retaining current group failures and the first program guard.
   @throws NativeScriptValueGuardError when original program guard retention reports a failure
   */
  async function drain(): Promise<void> {
    /** Drain logs retain original lifetime boundaries without inspecting failure contents. */
    const dl = tagged({ tag: drain.name, l: rl });
    dl.debug('draining original reached collectors');
    /** Original reached snapshot determines which native work is awaited by this invocation. */
    const outcomes = await Promise.allSettled([...reached.values()].map(function drainReachedRun({ run }) { return run.drain(); }));
    for (const outcome of outcomes) {
      if (outcome.status === 'rejected') judgment.markProgramGuard({ program, error: outcome.reason });
    }
    for (const { run } of reached.values()) {
      /** Current retained inspection includes groups reached while the captured work was draining. */
      const retained = run.inspect();
      if (retained.failed) judgment.markProgramGuard({ program, error: retained.failure });
    }
    /** Original guard history determines failure precedence after all retained observations. */
    const failures = judgment.inspectProgram(program).guardFailures;
    if (failures.length > 0) throw nonNullishOrThrow(failures[0]);
    dl.debug('original reached collectors drained without retained guards');
  }
  /** Snapshot original runtime closure and retained group observations without currentness checks.
   @returns frozen original retained runtime evidence
   */
  function inspect(): ProgramRuntimeInspection {
    /** Inspection logs omit original native contents and declaration text. */
    const il = tagged({ tag: inspect.name, l: rl });
    il.debug('inspecting retained original reached collectors');
    return Object.freeze({
      retainedOnly: true,
      closed: lifetime.closed,
      reachedGroups: Object.freeze([...reached].map(function inspectReachedRun([ordinal, { run }]) {
        return Object.freeze({ ordinal, collector: run.inspect() });
      })),
    });
  }
  return { retire, drain, inspect };
}
//endregion
