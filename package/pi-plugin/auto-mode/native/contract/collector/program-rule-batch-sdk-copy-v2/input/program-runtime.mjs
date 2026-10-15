import {createReachedGroupRun} from "./program-collector.mjs";
import {NativeScriptValueGuardError} from "./script-value-guard.ts";

export class ReachedProgramRuntimeError extends Error {constructor(message){super(message);this.name=this.constructor
  .name;}}

/** Program guard category survives script errors and closes later native release. */
export function createReachedProgramRun({
  judgment,
  program,
  signal,
  assertParentCurrent,
  dispatchGroup,
  scriptValueFor
}){
  const {declaration} = judgment.programFor(program);
    const reached=new Map();
    const sites=new WeakMap();
    const lifetime={closed:false};
  function current(){if(lifetime.closed)throw new ReachedProgramRuntimeError('Native program body has returned');assertParentCurrent();judgment.programFor(program);}
  function guarded(run){try{return run();}catch(error){throw judgment.markProgramGuard({
    program,
    error
  });}}
  function groupFor(site){return guarded(function readOriginalGroup(){
    current();const view=judgment.reachProgramGroup({
      program,
      ordinal:site.group
    });
    const existing=reached.get(site.group);
    if(existing){
      if(existing.view!==view)throw new ReachedProgramRuntimeError('Program group identity changed');
      return existing;
    }
    const run=createReachedGroupRun({
      group:view.handle,
      readGroup(handle){return judgment.reachedGroupFor(handle);},
      signal,
      assertParentCurrent:current,
      dispatchGroup
    });const entry={
      view,
      run
    };reached.set(
      site.group,
      entry
    );
    return entry;
  });}
  const tools=Object.freeze(declaration.sites
    .map(function createProgramTool(site){const tool=Object.freeze({
      name:site.alias,
      async execute(
        args,
        context
      ){const entry=groupFor(site);return await entry.run
        .tools[site.ordinal]
        .execute(
          args,
          context
        );}
    });sites.set(
      tool,
      site
    );return tool;}));
  function consumeScriptValue({entry,site,outcome}){
    try{return scriptValueFor({group:entry.view.handle,ordinal:site.ordinal,outcome});}
    catch(error){if(error instanceof NativeScriptValueGuardError)throw judgment.markProgramGuard({program,error});throw error;}
  }
  function valueFor({
    tool,
    outcome
  }){
    const {
      site,
      entry
    }=guarded(function readResultOrigin(){current();const site=sites.get(tool);if(!site)throw new ReachedProgramRuntimeError('Script result tool is not an owned program callsite');const entry=reached.get(site.group);if(!entry)throw new ReachedProgramRuntimeError('Script result group was not reached');return {
      site,
      entry
    };});
    const value=consumeScriptValue({entry,site,outcome});
    guarded(current);return value;
  }
  function retire(){if(lifetime.closed)return;lifetime.closed=true;for(const {run} of reached.values())run.retire();}
  async function drain(){
    const outcomes=await Promise.allSettled([...reached.values()].map(function drainReachedRun({run}){return run.drain();}));
    for(const outcome of outcomes)if(outcome.status==='rejected')judgment.markProgramGuard({
      program,
      error:outcome.reason
    });
    for(const {run} of reached.values()){const retained=run.inspect();if(retained.failed)judgment.markProgramGuard({
      program,
      error:retained.failure
    });}
    const failures=judgment.inspectProgram(program)
      .guardFailures;if(failures.length > 0)throw failures[0];
  }
  function inspect(){return Object.freeze({
    retainedOnly:true,
    closed:lifetime.closed,
    reachedGroups:Object.freeze([...reached].map(function inspectReachedRun([ordinal,{run}]){return Object.freeze({
      ordinal,
      collector:run.inspect()
    });}))
  });}
  return Object.freeze({
    declaration,
    tools,
    valueFor,
    retire,
    drain,
    inspect
  });
}
