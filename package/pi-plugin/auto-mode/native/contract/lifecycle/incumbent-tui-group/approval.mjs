import {createHash} from 'node:crypto';
export class OriginalTuiApprovalError extends Error {
  constructor(message){super(message);this.name=this.constructor.name;}
}
const sha=value=>createHash('sha256').update(value).digest('hex');
/**
 * Reuse the incumbent askUser implementation and fixed native Pi capabilities.
 * Bootstrap owns these dependencies; returned labels or copied verdict entries do not establish ownership.
 */
export function bindOriginalTuiApproval({judgment,producerOwner,observer,collector,response,stream,pi,ctx,askUser,verdictEntryType,explanation,notificationInvoker,trace}){
  if(typeof askUser!=='function'||typeof trace!=='function'||typeof explanation!=='string'||typeof verdictEntryType!=='string')throw new OriginalTuiApprovalError('Existing askUser, fixed entry type, explanation and trace are required');
  if(producerOwner.judgmentFor({response,stream})!==judgment)throw new OriginalTuiApprovalError('TUI approval must use the response original judgment');
  const source=observer.observationFor(response),closure=judgment.inspect().finalRecord;
  // The original judgment already owns its assessed snapshot; never recapture after evidence closure.
  const sources=judgment.sourceSnapshot??source.sources;
  if(closure?.status!=='evidence-closed'||judgment.inspect().accounting.finished!==true)throw new OriginalTuiApprovalError('TUI approval requires closed original assessment evidence');
  const states=judgment.inspect().memberExecutions;
  if(states.length===0||states.some(value=>value.state!=='unentered'))throw new OriginalTuiApprovalError('TUI approval must precede entry of the prepared group');
  const members=states.map(({id})=>{const handle=judgment.memberFor(id);return Object.freeze({handle,...judgment.preparedMemberFor(handle)});});
  const ui=ctx.ui,select=ui.select,appendEntry=pi.appendEntry,abort=ctx.abort;
  if(typeof select!=='function'||typeof appendEntry!=='function'||typeof abort!=='function')throw new OriginalTuiApprovalError('Native TUI selection, verdict append and abort capabilities are required');
  const signal=AbortSignal.any(members.map(value=>value.signal));
  const scope=JSON.stringify({parentProgram:JSON.parse(closure.parentJSON),preparedGroup:members.map(value=>value.prepared)});
  const action='Complete prepared group:\n'+scope;
  const approvalFingerprint=sha(JSON.stringify({scope,policy:sha(sources.mandatoryPolicy.content),request:sha(source.request.body)}));
  let phase='created',prompt,choice,selectionReturned=false,entry,forwarded=false,decision,result,failure;
  function current(){
    if(phase==='failed')throw failure;
    try{
      if(producerOwner.judgmentFor({response,stream})!==judgment||judgment.inspect().finalRecord!==closure)throw new OriginalTuiApprovalError('Original TUI judgment closure changed');
      if((judgment.sourceSnapshot??source.sources)!==sources)throw new OriginalTuiApprovalError('Original approval judgment source snapshot changed');
      observer.assertFresh(source);collector.assertObservedFresh(sources);judgment.assertDependenciesCurrent();signal.throwIfAborted();
      if(ctx.ui!==ui||ui.select!==select||pi.appendEntry!==appendEntry||ctx.abort!==abort)throw new OriginalTuiApprovalError('Original native approval capabilities changed');
      for(const member of members)if(judgment.preparedMemberFor(member.handle).prepared!==member.prepared)throw new OriginalTuiApprovalError('Original prepared group changed');
    }catch(error){failure=error;phase='failed';throw error;}
  }
  current();
  const scopedUi=Object.freeze({
    async select(title,options,opts){
      current();if(prompt)throw new OriginalTuiApprovalError('Incumbent askUser opened more than one selector');
      if(JSON.stringify(options)!==JSON.stringify(['Allow','Deny','Stop'])||!title.includes(action))throw new OriginalTuiApprovalError('Incumbent selector did not present the complete original group');
      prompt=Object.freeze({title,options:Object.freeze([...options])});trace('tui-select');
      const signals=opts?.signal?[signal,opts.signal]:[signal];
      choice=await Reflect.apply(select,ui,[title,options,{...opts,signal:AbortSignal.any(signals)}]);
      selectionReturned=true;trace('tui-selected');
      // Let the incumbent record the response even if current release eligibility was lost while waiting.
      return choice;
    },
  });
  const scopedContext=Object.freeze({
    get hasUI(){return ctx.hasUI;},
    get ui(){if(ctx.ui!==ui)throw new OriginalTuiApprovalError('Native TUI context changed before presentation');return scopedUi;},
    abort(){trace('tui-stop');return Reflect.apply(abort,ctx,[]);},
  });
  const scopedPi=Object.freeze({
    appendEntry(customType,data){
      if(entry||customType!==verdictEntryType||data.action!==action||data.approvalFingerprint!==approvalFingerprint)throw new OriginalTuiApprovalError('Verdict append differs from the original group');
      const expected=selectionReturned&&choice==='Allow'?'user-approve':'user-deny';
      if(data.verdict!==expected)throw new OriginalTuiApprovalError('Verdict append differs from the original selector result');
      entry=Object.freeze({...data});trace('tui-verdict-append');
      Reflect.apply(appendEntry,pi,[customType,data]);forwarded=true;
    },
  });
  async function request(){
    if(phase!=='created')throw new OriginalTuiApprovalError('Original group TUI approval is one-shot');
    phase='pending';trace('tui-approval-entry');
    try{
      current();
      decision=await askUser({pi:scopedPi,ctx:scopedContext,action,approvalFingerprint,explanation,reflectExplanationOnDeny:true,...(notificationInvoker?{notificationInvoker}:{})});
      if(!forwarded||!entry)throw new OriginalTuiApprovalError('Incumbent verdict was not recorded');
      if(!decision.block&&(!selectionReturned||choice!=='Allow'||entry.verdict!=='user-approve'))throw new OriginalTuiApprovalError('Allow result lacks its original selection and verdict append');
      result=Object.freeze({decision:Object.freeze({...decision}),action,approvalFingerprint,closure,origin:'incumbent-askUser-invocation',productionPermission:false});
      if(!decision.block)current();
      phase='responded';trace('tui-approval-complete');return result;
    }catch(error){failure=error;phase='failed';trace('tui-approval-failed');throw error;}
  }
  /** Retained Allow is not reusable after source, cancellation or host-capability changes. */
  function assertOriginalAllow(value){
    if(phase!=='responded'||value!==result||value.decision.block)throw new OriginalTuiApprovalError('No current original Allow result for this group');
    current();
  }
  function inspect(){return Object.freeze({retainedOnly:true,phase,prompt,choice,selectionReturned,entry,forwarded,result,failure,productionPermission:false});}
  return Object.freeze({request,assertOriginalAllow,inspect});
}
