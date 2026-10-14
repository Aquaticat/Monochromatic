import {createReachedGroupRun} from "./program-collector.mjs";
import {NativeScriptValueGuardError} from "./script-value-guard.ts";
export class ReachedProgramRuntimeError extends Error {constructor(message){super(message);this.name=this.constructor.name;}}

/** Program guard category survives script errors and closes later native release. */
export function createReachedProgramRun({judgment,program,signal,assertParentCurrent,dispatchGroup,scriptValueFor}){
  const declaration=judgment.programFor(program).declaration,reached=new Map(),sites=new WeakMap();let closed=false;
  function current(){if(closed)throw new ReachedProgramRuntimeError('Native program body has returned');assertParentCurrent();judgment.programFor(program);}
  function guarded(run){try{return run();}catch(error){throw judgment.markProgramGuard({program,error});}}
  function groupFor(site){return guarded(()=>{
    current();const view=judgment.reachProgramGroup({program,ordinal:site.group});let entry=reached.get(site.group);
    if(!entry){const run=createReachedGroupRun({group:view.handle,readGroup:handle=>judgment.reachedGroupFor(handle),signal,assertParentCurrent:current,dispatchGroup});entry={view,run};reached.set(site.group,entry);}
    if(entry.view!==view)throw new ReachedProgramRuntimeError('Program group identity changed');return entry;
  });}
  const tools=Object.freeze(declaration.sites.map(site=>{const tool=Object.freeze({name:site.alias,async execute(args,context){const entry=groupFor(site);return await entry.run.tools[site.ordinal].execute(args,context);}});sites.set(tool,site);return tool;}));
  function valueFor({tool,outcome}){
    const {site,entry}=guarded(()=>{current();const site=sites.get(tool);if(!site)throw new ReachedProgramRuntimeError('Script result tool is not an owned program callsite');const entry=reached.get(site.group);if(!entry)throw new ReachedProgramRuntimeError('Script result group was not reached');return {site,entry};});
    let value;try{value=scriptValueFor({group:entry.view.handle,ordinal:site.ordinal,outcome});}
    catch(error){if(error instanceof NativeScriptValueGuardError)throw judgment.markProgramGuard({program,error});throw error;}
    guarded(current);return value;
  }
  function retire(){if(closed)return;closed=true;for(const {run} of reached.values())run.retire();}
  async function drain(){
    const outcomes=await Promise.allSettled([...reached.values()].map(({run})=>run.drain()));
    for(const outcome of outcomes)if(outcome.status==='rejected')judgment.markProgramGuard({program,error:outcome.reason});
    for(const {run} of reached.values()){const retained=run.inspect();if(retained.failed)judgment.markProgramGuard({program,error:retained.failure});}
    const failures=judgment.inspectProgram(program).guardFailures;if(failures.length)throw failures[0];
  }
  function inspect(){return Object.freeze({retainedOnly:true,closed,reachedGroups:Object.freeze([...reached].map(([ordinal,{run}])=>Object.freeze({ordinal,collector:run.inspect()})))});}
  return Object.freeze({declaration,tools,valueFor,retire,drain,inspect});
}
