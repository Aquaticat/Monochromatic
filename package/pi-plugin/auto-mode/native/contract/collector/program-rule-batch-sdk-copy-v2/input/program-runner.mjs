import {createDeclaredProgramFacade} from './program-runner-facade.ts';
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
    createDeclaredProgram(input){
      const runner=this;
      return createDeclaredProgramFacade({...input,
        bindGroup(binding){return runner.#bindGroup(binding);},
        executeGroup(execution){return runner.#executeGroup(execution);},
        createReachedProgramRun,
        NativeExecutionGuardError
      });
    }
    #bindGroup(input){return bindReachedProgramGroup({...input,runner:this,NestedCallRecorder});}
    async #executeGroup(input){await executeReachedProgramGroup({...input,runner:this,dispatchPreparedBatch});}
    takeRecord(toolCallId){const scope=this.scopes
      .get(toolCallId); const result=super.takeRecord(toolCallId);if(scope?.owner)this.scopes
        .delete(scope.owner);return result;}
  };
}
