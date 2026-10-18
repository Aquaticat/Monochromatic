/** One native group owns review disposition, confirmation, and execution through cleanup. @module */
import {createHash} from 'node:crypto';
import {inspect} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {caughtValueText} from '@monochromatic-dev/module-caught-value/ts';
import {bindPreparedTuiApproval} from '../../lifecycle/incumbent-tui-group/approval-presentation.mjs';
import {projectOperationSummary} from '../action-policy/wire-material.mjs';
import {EstablishedPolicyDecisionError} from '../action-policy/decision-core.mjs';
import {resolveConfirmedOutcome} from '../action-policy/review-outcome.ts';
import {createPreparedGroupContext} from './prepared-group-context.ts';

//region Native ownership exists before automatic source collection can fail.
export class PreparedGroupError extends Error {}

/** Keep original member records across automatic review and a scoped manual fallback. */
export function createPreparedGroup({response,stream,signal,assertOperationCurrent,captureHost,origins,
  constructSource,reviewSource,preparePrograms,retainSources,readBypass}){
  const l=tagged({tag:createPreparedGroup.name,l:tagged({tag:'auto-mode-prepared-group'})});
  const parentJSON=JSON.stringify(response.content);
  const bypass=readBypass();
  const state={context:undefined,scope:undefined,reviewed:undefined,automaticReview:undefined,automaticFailure:undefined,
    manual:false,bypassed:false,closed:false,approval:undefined,answer:undefined};

  /** Original operation identity remains independent of automatic evidence availability. */
  function baseCurrent(){
    tagged({tag:baseCurrent.name,l}).debug('checking original operation');
    if(state.closed)throw new PreparedGroupError('The prepared operation has ended');
    signal.throwIfAborted();assertOperationCurrent();
    if(JSON.stringify(response.content)!==parentJSON)throw new PreparedGroupError('The proposed operation changed during review');
    if(bypass&&!readBypass())throw new PreparedGroupError('Explicit bypass was disabled before this group completed; retry with guardrail checks');
  }
  /** The first automatic failure remains available to confirmation and diagnostics. */
  function retainFailure(error){
    const dl=tagged({tag:retainFailure.name,l});
    dl.debug('automatic assessment failed; retaining cause for manual approval');
    dl.debug(inspect(error,{depth:8,customInspect:false,getters:false}));
    state.automaticFailure??={error};
  }
  /** Existing reviewed outcomes perform their own original source and approval checks. */
  function current(){
    tagged({tag:current.name,l}).debug('checking original group eligibility');
    baseCurrent();
    if(state.manual){
      state.automaticReview?.assertCurrent();
      if(state.answer&&!state.answer.decision.block)state.approval.assertOriginalAllow(state.answer);
      return;
    }
    if(state.automaticFailure||!state.scope)return;
    if(state.reviewed){state.reviewed.assertCurrent();return;}
    if(state.bypassed){state.scope.assertDependenciesCurrent();return;}
    try{
      state.scope.checkpoint();
      if(state.scope.inspect().prepared)state.scope.assertDependenciesCurrent();
    }catch(error){retainFailure(error);}
  }
  /** Native entry already has its caller's operation guard; use the original compiler dependency check directly. */
  function entryCurrent(){
    tagged({tag:entryCurrent.name,l}).debug('checking original native entry');
    baseCurrent();
    if(state.manual){
      if(state.answer&&!state.answer.decision.block)state.approval.assertOriginalAllow(state.answer);
      return;
    }
    context().assertSourceCurrent();
  }
  /** Confirmation checks original source dependencies directly, including when a compiler operation owns its wrapper. */
  function confirmationCurrent(){
    tagged({tag:confirmationCurrent.name,l}).debug('checking original confirmation scope');
    baseCurrent();
    if(state.automaticReview)context().assertSourceCurrent();
  }
  /** One context is shared with the policy compiler and every reached child. */
  function context(){
    if(state.context)return state.context;
    const original=createPreparedGroupContext({response,stream,signal,
      assertDependenciesCurrent:entryCurrent,
      readJudgment(){return state.scope??api;},
      readClosure(){return {finished:state.manual?state.answer?.decision.block===false:
        !state.automaticFailure&&(state.bypassed||state.reviewed?.outcome.verdict==='approve'),closeFailed:false};}
    });
    const core=original.executions;
    const executions={...core,
      beginExecution(member){
        const token=core.beginExecution(member);
        const manual=state.manual;
        const entry={origin:undefined};
        origins.set(token,function readOriginalEntry(carrier){
          if(carrier.response!==response||carrier.stream!==stream)throw new PreparedGroupError('Execution context belongs to another original operation');
          const origin=core.executionEntryFor(token);
          entry.origin??=manual?Object.freeze({...origin,manualApproval:true}):origin;
          return entry.origin;
        });
        return token;
      },
      finishExecution(token){core.finishExecution(token);origins.delete(token);}
    };
    state.context=Object.freeze({...original,executions});
    return state.context;
  }
  /** Both resolved approval routes retain original dependencies before execution can append receipts. */
  function retainApprovedDependencies(reviewed){
    tagged({tag:retainApprovedDependencies.name,l}).debug('checking resolved approval source retention');
    if(reviewed.outcome.state!=='resolved'||reviewed.outcome.verdict!=='approve')return;
    retainSources();reviewed.assertCurrent();
  }
  /** Scoped user confirmation uses the same original prepared membership. */
  async function requestManual(error,members){
    tagged({tag:requestManual.name,l}).debug('requesting complete-group confirmation');
    baseCurrent();
    if(state.closed||state.approval)throw new PreparedGroupError('Manual approval requires one complete unreviewed group');
    const host=captureHost();
    if(state.automaticReview&&state.automaticReview.outcome.state!=='resolved'&&!host?.ctx.hasUI){
      state.manual=false;return state.automaticReview;
    }
    if(!host)throw new PreparedGroupError('Automatic assessment is unavailable and this session has no manual approval interface',{cause:error});
    state.automaticReview?.assertCurrent();
    const scope=JSON.stringify({parentProgram:projectOperationSummary(JSON.parse(parentJSON)),preparedGroup:members});
    state.approval=bindPreparedTuiApproval({...host,action:`Complete prepared group:\n${scope}`,
      approvalFingerprint:createHash('sha256').update(scope).digest('hex'),
      closure:state.automaticReview?.closure??Object.freeze({kind:'manual-prepared-group'}),signal,
      assertPreparedCurrent:confirmationCurrent,
      explanation:error===undefined
        ?`Automatic review could not establish whether this operation is allowed. ${state.automaticReview.outcome.reason} Review the complete prepared operation and choose Allow or Stop.`
        :`Auto-mode could not assess this operation: ${caughtValueText(error)}. Review the complete prepared operation and choose Allow or Stop.`});
    state.answer=await state.approval.request();
    if(!state.answer.decision.block){state.automaticReview?.assertCurrent();state.approval.assertOriginalAllow(state.answer);}
    const outcome=state.answer.decision.block||!state.automaticReview
      ?Object.freeze({state:'resolved',verdict:state.answer.decision.block?'deny':'approve',reason:state.answer.decision.reason})
      :resolveConfirmedOutcome({program:state.automaticReview.compiledPolicy,reconsideredOutcome:state.automaticReview.operationDecision?.outcome});
    const reviewed=Object.freeze({...state.automaticReview,manualFallback:state.automaticReview===undefined,approval:state.answer,
      automaticOutcome:state.automaticReview?.outcome,outcome,
      assertCurrent:current});
    if(state.automaticReview)retainApprovedDependencies(reviewed);
    return reviewed;
  }
  /** Complete native preparation precedes either review route and never allocates alternate execution records. */
  async function assess({members}){
    if(state.closed)throw new PreparedGroupError('The prepared operation has ended');
    context().prepare(members);
    if(!state.automaticFailure){
      try{
        state.scope.prepare(members);
        if(bypass){
          current();state.scope.finalize();retainSources();state.bypassed=true;
        }else{
          preparePrograms(state.scope);
          state.reviewed=await reviewSource();
          state.reviewed.assertCurrent();
          retainApprovedDependencies(state.reviewed);
        }
      }catch(error){
        if(error instanceof EstablishedPolicyDecisionError)throw error;
        retainFailure(error);
      }
    }
    if(state.automaticFailure){
      baseCurrent();
      try{if(state.scope&&state.scope.inspect().finalRecord===undefined)state.scope.finalize();}
      catch(error){tagged({tag:assess.name,l}).debug(`automatic evidence closure failed: ${inspect(error,{depth:8})}`);}
      state.manual=true;
      state.reviewed=await requestManual(state.automaticFailure.error,members);
    }else if(!state.bypassed&&(state.reviewed.outcome.state!=='resolved'||state.reviewed.outcome.verdict==='ask')){
      state.automaticReview=state.reviewed;
      state.manual=true;
      state.reviewed=await requestManual(undefined,members);
    }
    return state.bypassed||state.reviewed?.outcome.verdict==='approve'?{block:false}:{block:true,
      reason:state.reviewed.outcome.reason??'Execution is withheld because the complete group has no established policy outcome'};
  }
  /** Closed contexts retain their terminal outcome; the runtime separately retains its latest full diagnostic. */
  function close(){
    tagged({tag:close.name,l}).debug('retiring completed group review inputs');
    state.closed=true;
    if(state.reviewed)state.reviewed=Object.freeze({
      outcome:state.reviewed.outcome,
      assertCurrent(){throw new PreparedGroupError('The prepared operation has ended');}
    });
    state.automaticReview=undefined;
  }
  /** Retained review data is diagnostic and does not publish execution authority. */
  function review(){return state.reviewed;}
  const api=Object.freeze({current,assess,close,review,
    memberFor(id){return context().executions.memberFor(id);},
    beginExecution(member){return context().executions.beginExecution(member);},
    executionFor(token){return context().executions.executionFor(token);},
    finishExecution(token){return context().executions.finishExecution(token);}
  });
  try{state.scope=constructSource(context);}
  catch(error){retainFailure(error);}
  return api;
}
//endregion
