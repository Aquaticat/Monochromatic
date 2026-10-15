import {createHash} from 'node:crypto';

export class OriginalTuiApprovalError extends Error {
  constructor(message){super(message);this.name=this.constructor
    .name;}
}
function sha(value) { return createHash('sha256')
  .update(value)
  .digest('hex'); }
/**
 Reuse the incumbent askUser implementation and fixed native Pi capabilities.
 Bootstrap owns these dependencies; returned labels or copied verdict entries do not establish ownership.
 */
export function bindOriginalTuiApproval({
  judgment,
  producerOwner,
  observer,
  response,
  stream,
  pi,
  ctx,
  askUser,
  verdictEntryType,
  explanation,
  notificationInvoker,
  trace
}){
  if(((typeof askUser)!=='function')||((typeof trace)!=='function')
    ||((typeof explanation)!=='string')
    ||((typeof verdictEntryType)!=='string'))throw new OriginalTuiApprovalError('Existing askUser, fixed entry type, explanation and trace are required');
  if(producerOwner.judgmentFor({
    response,
    stream
  })!==judgment)throw new OriginalTuiApprovalError('TUI approval must use the response original judgment');
  const source=observer.observationFor(response);
  const closure=judgment.inspect()
    .finalRecord;
  // The original judgment already owns its assessed snapshot; never recapture after evidence closure.
  const sources=judgment.readSourceSnapshot?.()??judgment.sourceSnapshot
    ??source.sources;
  if((closure?.status!=='evidence-closed')||(judgment.inspect()
    .accounting
    .finished
    !==true))throw new OriginalTuiApprovalError('TUI approval requires closed original assessment evidence');
  const states=judgment.inspect()
    .memberExecutions;
  if((states.length===0)||states.some(function hasEnteredApprovalMember(value) { return (value.state!=='unentered'); }))throw new OriginalTuiApprovalError('TUI approval must precede entry of the prepared group');
  const members=states.map(function captureOriginalPreparedMember({id}) {const handle=judgment.memberFor(id);return Object.freeze({
    handle,
    ...judgment.preparedMemberFor(handle)
  });});
  const {ui} = ctx;
    const {select} = ui;
    const {appendEntry} = pi;
    const {abort} = ctx;
  if(((typeof select)!=='function')||((typeof appendEntry)!=='function')
    ||((typeof abort)!=='function'))throw new OriginalTuiApprovalError('Native TUI selection, verdict append and abort capabilities are required');
  const signal=AbortSignal.any(members.map(function readPreparedSignal(value) { return (value.signal); }));
  const scope=JSON.stringify({
    parentProgram:JSON.parse(closure.parentJSON),
    preparedGroup:members.map(function readPreparedOperation(value) { return (value.prepared); })
  });
  const action=`Complete prepared group:\n${scope}`;
  const approvalFingerprint=sha(JSON.stringify({
    scope,
    policy:sha(sources.mandatoryPolicy
      .content),
    request:sha(source.request
      .body)
  }));
  const selectionState={
    choice:undefined,
    decision:undefined,
    entry:undefined,
    failure:undefined,
    forwarded:false,
    phase:'created',
    prompt:undefined,
    result:undefined,
    selectionReturned:false
  };
    
    
    
    
    
    
    
    
  function current(){
    if(selectionState.phase==='failed')throw selectionState.failure;
    try{
      if((producerOwner.judgmentFor({
        response,
        stream
      })!==judgment)||(judgment.inspect()
        .finalRecord
        !==closure))throw new OriginalTuiApprovalError('Original TUI judgment closure changed');
      const currentBinding=judgment.readCurrentSourceBinding();
      if(currentBinding.request!==source)throw new OriginalTuiApprovalError('Original approval request receipt changed');
      if(currentBinding.sources!==sources)throw new OriginalTuiApprovalError('Original approval judgment source snapshot changed');
      signal.throwIfAborted();
      if((ctx.ui!==ui)||(ui.select!==select)
        ||(pi.appendEntry!==appendEntry)
        ||(ctx.abort!==abort))throw new OriginalTuiApprovalError('Original native approval capabilities changed');
      for(const member of members)if(judgment.preparedMemberFor(member.handle)
        .prepared
        !==member.prepared)throw new OriginalTuiApprovalError('Original prepared group changed');
    }catch(error){selectionState.failure=error;selectionState.phase='failed';throw error;}
  }
  current();
  const scopedUi=Object.freeze({
    async select(
      title,
      options,
      opts
    ){
      current();if(selectionState.prompt)throw new OriginalTuiApprovalError('Incumbent askUser opened more than one selector');
      if((JSON.stringify(options)!==JSON.stringify([
        'Allow',
        'Stop'
      ]))||(!title.includes(action)))throw new OriginalTuiApprovalError('Incumbent selector did not present the complete original group');
      selectionState.prompt=Object.freeze({
        title,
        options:Object.freeze([...options])
      });trace('tui-select');
      const signals=opts?.signal?[
        signal,
        opts.signal
      ]:[signal];
      selectionState.choice=await Reflect.apply(
        select,
        ui,
        [
          title,
          options,
          {
            ...opts,
            signal:AbortSignal.any(signals)
          }
        ]
      );
      selectionState.selectionReturned=true;trace('tui-selected');
      // Let the incumbent record the response even if current release eligibility was lost while waiting.
      return selectionState.choice;
    },
  });
  const scopedContext=Object.freeze({
    get hasUI(){return ctx.hasUI;},
    get ui(){if(ctx.ui!==ui)throw new OriginalTuiApprovalError('Native TUI context changed before presentation');return scopedUi;},
    abort(){trace('tui-stop');return Reflect.apply(
      abort,
      ctx,
      []
    );},
  });
  const scopedPi=Object.freeze({
    appendEntry(
      customType,
      data
    ){
      if(selectionState.entry||(customType!==verdictEntryType)
        ||(data.action!==action)
        ||(data.approvalFingerprint!==approvalFingerprint))throw new OriginalTuiApprovalError('Verdict append differs from the original group');
      const expected=selectionState.selectionReturned&&(selectionState.choice==='Allow')?'user-approve':'user-deny';
      if(data.verdict!==expected)throw new OriginalTuiApprovalError('Verdict append differs from the original selector result');
      selectionState.entry=Object.freeze({...data});trace('tui-verdict-append');
      Reflect.apply(
        appendEntry,
        pi,
        [
          customType,
          data
        ]
      );selectionState.forwarded=true;
    },
  });
  async function request(){
    if(selectionState.phase!=='created')throw new OriginalTuiApprovalError('Original group TUI approval is one-shot');
    selectionState.phase='pending';trace('tui-approval-entry');
    try{
      current();
      selectionState.decision=await askUser({
        pi:scopedPi,
        ctx:scopedContext,
        action,
        approvalFingerprint,
        explanation,
        ...(notificationInvoker?{notificationInvoker}:{})
      });
      if((!selectionState.forwarded)||(!selectionState.entry))throw new OriginalTuiApprovalError('Incumbent verdict was not recorded');
      if((!selectionState.decision.block)&&((!selectionState.selectionReturned)||(selectionState.choice!=='Allow')
        ||(selectionState.entry.verdict!=='user-approve')))throw new OriginalTuiApprovalError('Allow result lacks its original selection and verdict append');
      selectionState.result=Object.freeze({
        decision:Object.freeze({...selectionState.decision}),
        action,
        approvalFingerprint,
        closure,
        origin:'incumbent-askUser-invocation',
        productionPermission:false
      });
      if(!selectionState.decision.block)current();
      selectionState.phase='responded';trace('tui-approval-complete');return selectionState.result;
    }catch(error){selectionState.failure=error;selectionState.phase='failed';trace('tui-approval-failed');throw error;}
  }
  /** Retained Allow is not reusable after source, cancellation or host-capability changes. */
  function assertOriginalAllow(value){
    if((selectionState.phase!=='responded')
      ||(value!==selectionState.result)
      ||value.decision
      .block)throw new OriginalTuiApprovalError('No current original Allow result for this group');
    current();
  }
  function inspect(){return Object.freeze({
    retainedOnly:true,
    phase:selectionState.phase,
    prompt:selectionState.prompt,
    choice:selectionState.choice,
    selectionReturned:selectionState.selectionReturned,
    entry:selectionState.entry,
    forwarded:selectionState.forwarded,
    result:selectionState.result,
    failure:selectionState.failure,
    productionPermission:false
  });}
  return Object.freeze({
    request,
    assertOriginalAllow,
    inspect
  });
}
