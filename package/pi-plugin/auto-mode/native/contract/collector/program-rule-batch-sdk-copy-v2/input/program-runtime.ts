/**
 Original source execution retains reached-group ownership and distinct native value failures. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { createReachedGroupRun } from './group-collector.ts';
import { NativeScriptValueGuardError } from './script-value-guard.ts';
import { ReachedProgramRuntimeError } from './program-runtime-error.ts';
import { createProgramRuntimeLifetime } from './program-runtime-lifetime.ts';
import type { DeclaredProgramSite } from './program-declaration-types.ts';
import type { GroupCollectorTool } from './group-collector-types.ts';
import type {
  ProgramRuntime,
  ProgramRuntimeInput,
  ProgramRuntimeEntry
} from './program-runtime-types.ts';

/**
 Runtime logs describe original ownership transitions without source text or native result contents.
 */
const l = tagged({ tag: 'auto-mode-program-runtime' });

//region Original source tools retain one collector per reached group and guarded script-value use.
/** Bind original opened-program execution to its parent and native complete-group consumer.
 @param judgment - original program custody and guard owner
 
 @param program - original already opened program handle
 
 @param signal - original parent cancellation source
 
 @param assertParentCurrent - original enclosing execution currentness check
 
 @param dispatchGroup - original complete-group preparation and native consumer
 
 @param scriptValueFor - original native result conversion associated with its reached group
 
 @returns frozen original program tools, value access, and retained lifetime operations
 
 @example createReachedProgramRun({ judgment, program, signal, assertParentCurrent, dispatchGroup, scriptValueFor });
 */
export function createReachedProgramRun<const Value>({
  judgment,
  program,
  signal,
  assertParentCurrent,
  dispatchGroup,
  scriptValueFor
}: ProgramRuntimeInput<Value>): ProgramRuntime<Value> {
  /**
   Original runtime construction reads the already published program before exposing tools.
   */
  const rl = tagged({
    tag: createReachedProgramRun.name,
    l
  });
  rl.debug('binding original opened-program runtime');
  /**
   Caller has already completed original program opening before constructing native execution.
   */
  const { declaration } = nonNullishOrThrow(judgment.programFor(program));
  /**
   Original source group ordinals retain canonical view and collector identities.
   */
  const reached = new Map<number, ProgramRuntimeEntry>();
  /**
   Only original published tool objects can select their source callsite.
   */
  const sites = new WeakMap<object, DeclaredProgramSite>();
  /**
   Runtime closure stops new entry without discarding already reached native work.
   */
  const lifetime = { closed: false };
  /** Check original runtime closure, parent execution, and program custody in order.
   @throws ReachedProgramRuntimeError when original program body has returned
   */
  function current(): void {
    /**
     Currentness logs do not inspect original source content.
     */
    const cl = tagged({
      tag: current.name,
      l: rl
    });
    cl.debug('checking original program runtime currentness');
    if (lifetime.closed) throw new ReachedProgramRuntimeError('Native program body has returned');
    assertParentCurrent();
    judgment.programFor(program);
  }
  /** Retain only failures crossing an original guarded program boundary.
   @param run - original synchronous operation whose failures become program guards
   
   @returns original operation result
   
   @throws NativeScriptValueGuardError after original guard ownership retains a caught failure
   */
  function guarded<const Result>(run: () => Result): Result {
    /**
     Guard logs distinguish boundary retention from ordinary native conversion failures.
     */
    const gl = tagged({
      tag: guarded.name,
      l: rl
    });
    try { 
      return run(); 
    }
    catch (error) {
      gl.debug('retaining original program boundary failure');
      throw judgment.markProgramGuard({
        program,
        error
      });
    }
  }
  /** Reuse an original reached collector only while its canonical view identity remains unchanged.
   @param site - original declared source callsite
   
   @returns original reached group and collector
   */
  function groupFor(site: DeclaredProgramSite): ProgramRuntimeEntry {
    return guarded(function readOriginalGroup() {
      current();
      /**
       Original reachability is read before looking up any retained collector.
       */
      const view = judgment.reachProgramGroup({
        program,
        ordinal: site.group
      });
      /**
       Existing group reuse requires the same original reached-view object.
       */
      const existing = reached.get(site.group);
      if (existing) {
        if (existing.view !== view) throw new ReachedProgramRuntimeError('Program group identity changed');
        return existing;
      }
      /**
       Successful original reaching publishes the view before first collector construction.
       */
      const originalView = nonNullishOrThrow(view);
      /**
       Every collector uses the original judgment reader and parent runtime currentness callback.
       */
      const run = createReachedGroupRun({
        group: originalView.handle,
        readGroup(handle) { 
          return nonNullishOrThrow(judgment.reachedGroupFor(handle)); 
        },
        signal,
        assertParentCurrent: current,
        dispatchGroup,
      });
      /**
       Group publication follows successful collector construction and retains both original objects.
       */
      const entry = {
        view: originalView,
        run
      };
      reached.set(
        site.group,
        entry
      );
      return entry;
    });
  }
  /**
   Frozen original tools remain indexed by source group and member ordinal.
   */
  const tools = Object.freeze(declaration.sites
    .map(function createProgramTool(site): GroupCollectorTool {
    /**
     Original public callback identity is recorded before publication.
     */
    const tool = Object.freeze({
      name: site.alias,
      async execute(
        args: unknown,
        context: Readonly<{ signal: unknown }>
      ): Promise<unknown> {
        /**
         Original source membership selects the same reached native collector on every invocation.
         */
        const entry = groupFor(site);
        return await nonNullishOrThrow(entry.run
          .tools[site.ordinal])
          .execute(
            args,
            context
          );
      },
    });
    sites.set(
      tool,
      site
    );
    return tool;
  }));
  /** Retain original result-binding guards while preserving ordinary native conversion failures.
   @param entry - original reached group selected by owned tool membership
   
   @param site - original source callsite whose ordinal owns the result
   
   @param outcome - exact original native outcome
   
   @returns original script-facing converted value
   */
  function consumeScriptValue({
    entry,
    site,
    outcome
  }: Readonly<{
    entry: ProgramRuntimeEntry;
    site: DeclaredProgramSite;
    outcome: unknown
  }>): Value {
    try { 
      return scriptValueFor({
        group: entry.view
          .handle,
        ordinal: site.ordinal,
        outcome
      }); 
    }
    catch (error) {
      if (error instanceof NativeScriptValueGuardError) throw judgment.markProgramGuard({
        program,
        error
      });
      throw error;
    }
  }
  /** Consume only an original owned tool result and recheck currentness after conversion.
   @param tool - original published program tool object
   
   @param outcome - exact original native outcome
   
   @returns original converted script value
   */
  function valueFor({
    tool,
    outcome
  }: Parameters<ProgramRuntime<Value>['valueFor']>[0]): Value {
    /**
     Guarded origin lookup precedes every native value-conversion callback.
     */
    const {
      site,
      entry
    } = guarded(function readResultOrigin() {
      current();
      /**
       Original tool identity must belong to this exact runtime publication.
       */
      const ownedSite = sites.get(tool);
      if (!ownedSite) throw new ReachedProgramRuntimeError('Script result tool is not an owned program callsite');
      /**
       Owned source membership does not invent a group that was never reached.
       */
      const reachedEntry = reached.get(ownedSite.group);
      if (!reachedEntry) throw new ReachedProgramRuntimeError('Script result group was not reached');
      return {
        site: ownedSite,
        entry: reachedEntry
      };
    });
    /**
     Conversion retains original native failure categories before the guarded tail check.
     */
    const value = consumeScriptValue({
      entry,
      site,
      outcome
    });
    guarded(current);
    return value;
  }
  /**
   Original lifetime operations consume the same reached map and closure flag as live entry.
   */
  const {
    retire,
    drain,
    inspect
  } = createProgramRuntimeLifetime({
    judgment,
    program,
    lifetime,
    reached
  });
  return Object.freeze({
    declaration,
    tools,
    valueFor,
    retire,
    drain,
    inspect
  });
}
//endregion
