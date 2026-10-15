import {createReachedProgramRun} from "./program-runtime.mjs";
import {NativeExecutionGuardError} from "../../../lifecycle/execution-context-carrier/execute.mjs";
import {acquireProgramQueue} from './program-runner-scope.mjs';
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
    async #executeGroup({
      origin,
      group,
      bound,
      assertParentCurrent
    }){
      const {
        scope,
        calls,
        ordinals,
        tools,
        slots,
        tickets
      }=bound;
        const parentId=origin.prepared
          .id; const {judgment} = origin;
        const records=new Map();
      const exclusive=(!scope.holdsQueue)&&(this.host
        .isSequential()
        ||calls.some(function requiresSequentialExecution(call) { return tools.find(function matchesCall(tool) { return tool.name===call.name; })
          ?.executionMode
          ==='sequential'; }));
      const assessment={handles:undefined};
      const runner=this;
      using queueTurn=exclusive ? await acquireProgramQueue(runner) : undefined;
        assertParentCurrent();origin.signal
          .throwIfAborted();
        await dispatchPreparedBatch({
          calls,
          tools,
          assistantMessage:origin.response,
          context:this.host
            .getContext(),
          signal:origin.signal,
          executionJudgment:judgment,
          executionMode:exclusive?'sequential':'parallel',
          memberForExecution(id){const member=assessment.handles?.[ordinals.get(id)];if(!member)throw new Error('Prepared child has no owned execution handle');return member;},
          runToolCall(
            call,
            options
          ){ return judgment.invokeProgramNative({
            group:group.handle,
            slot:slots[ordinals.get(call.id)],
            call,
            options
          }); },
          prepare(hook){ return runner.host
            .prepareOwnedToolCall(
              hook,
              parentId
            ); },
          after(hook){ return runner.host
            .finishOwnedToolCall(
              hook,
              parentId
            ); },
          assertFresh(){assertParentCurrent();judgment.reachedGroupFor(group.handle);},
          assess({members}){assessment.handles=judgment.prepareReachedMembers({
            group:group.handle,
            members,
            nativeSignals:group.members
              .map(function readMemberSignal(member) { return member.signal; })
          });return {block:false};},
          async onStart(call){records.set(
            call.id,
            scope.recorder
              .start(call)
          );await runner.host
            .emit({
              type:'tool_execution_start',
              toolCallId:call.id,
              toolName:call.name,
              args:call.arguments,
              parentToolCallId:parentId
            });},
          async onUpdate(
            partialResult,
            call
          ){await runner.host
            .emit({
              type:'tool_execution_update',
              toolCallId:call.id,
              toolName:call.name,
              args:call.arguments,
              partialResult,
              parentToolCallId:parentId
            });},
          async onFinish(outcome){
            const call=outcome.toolCall;
              const text=(outcome.result
                .content
                ??[]).filter(function isTextPart(part) { return part.type==='text'; })
                .map(function readTextPart(part) { return part.text; })
                .join('\n');scope.recorder
                  .finish(
                    records.get(call.id),
                    outcome.isError,
                    text
                  );if(outcome.result
                    .usage)scope.recorder
                      .addUsage(outcome.result
                        .usage);
            await runner.host
              .emit({
                type:'tool_execution_end',
                toolCallId:call.id,
                toolName:call.name,
                result:outcome.result,
                isError:outcome.isError,
                parentToolCallId:parentId
              });tickets[ordinals.get(call.id)]
                .resolve(outcome);
          }
        });
    }
    takeRecord(toolCallId){const scope=this.scopes
      .get(toolCallId); const result=super.takeRecord(toolCallId);if(scope?.owner)this.scopes
        .delete(scope.owner);return result;}
  };
}
