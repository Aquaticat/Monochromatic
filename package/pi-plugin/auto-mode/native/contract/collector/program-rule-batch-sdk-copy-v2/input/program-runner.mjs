import {executeReachedProgramGroup} from './program-runner-execution.ts';
import {createReachedProgramRun} from "./program-runtime.mjs";
import {NativeExecutionGuardError} from "../../../lifecycle/execution-context-carrier/execute.mjs";
import {bindReachedProgramGroup} from './program-runner-binding.ts';

/** Reuse native scope, queue and recorder objects across reached groups of one program. */
export function createReachedRunnerClass({
  NestedToolCallRunner,
  NestedCallRecorder,
  dispatchPreparedBatch
}){
  return class ReachedProgramNestedRunner extends NestedToolCallRunner{
    createDeclaredProgram({tools,
      origin,
      carrier,
      code,
      assertParentCurrent
    }){
if(!Array.isArray(tools)||!Object.isFrozen(tools))throw new Error("Original request tool snapshot is unavailable");

      assertParentCurrent();if(code
        !==origin.prepared
        .input
        .code)throw new Error('Declared program differs from original prepared input');
      const {judgment} = origin;
        const toolNames=tools
          .map(function readToolName(tool) { return tool.name; });
        const program=judgment.openProgram({
        parentToken:carrier.token,
        toolNames
      });
        const nativeGroups=new Map();
        const works=[];
        const failures=[];
      const runner=this;
      const run=createReachedProgramRun({
        judgment,
        program,
        signal:origin.signal,
        assertParentCurrent,
        dispatchGroup(group){
          const bound=runner.#bindGroup({tools,
            origin,
            carrier,
            group,
            assertParentCurrent
          });nativeGroups.set(
            group.handle,
            bound
          );
          async function settle(owner){
            try{await owner.#executeGroup({
              origin,
              program,
              group,
              bound,
              assertParentCurrent
            });}
            catch(error){failures.push(error);for(const ticket of bound.tickets)ticket.reject(error);}
          }
          works.push(settle(runner));return bound.tickets
            .map(function readResultTicket(ticket) { return ticket.promise; });
        },
        scriptValueFor({
          group,
          ordinal,
          outcome
        }){
          const bound=nativeGroups.get(group);if(!bound)throw new Error('Native group has no owned result slots');
          return judgment.scriptValueFor({
            group,
            slot:bound.slots[ordinal],
            outcome
          });
        }
      });
      return Object.freeze({
        ...run,
        async drain(){
        const drained=await Promise.allSettled([
          run.drain(),
          ...works
        ]);
        const errors=[
          ...failures,
          ...drained.filter(function isRejected(value) { return value.status==='rejected'; })
            .map(function readRejection(value) { return value.reason; })
        ];
        if(errors.length > 0)throw new NativeExecutionGuardError({
          errors,
          phase:'validation',
          toolCallId:origin.prepared
            .id,
          toolName:origin.prepared
            .name
        });
      }
      });
    }
    #bindGroup(input){return bindReachedProgramGroup({...input,runner:this,NestedCallRecorder});}
    async #executeGroup(input){await executeReachedProgramGroup({...input,runner:this,dispatchPreparedBatch});}
    takeRecord(toolCallId){const scope=this.scopes
      .get(toolCallId); const result=super.takeRecord(toolCallId);if(scope?.owner)this.scopes
        .delete(scope.owner);return result;}
  };
}
