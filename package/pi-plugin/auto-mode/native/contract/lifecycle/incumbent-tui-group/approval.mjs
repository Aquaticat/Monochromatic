import {createHash} from 'node:crypto';

import {bindPreparedTuiApproval,OriginalTuiApprovalError} from './approval-presentation.mjs';
export {OriginalTuiApprovalError} from './approval-presentation.mjs';
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

  function assertPreparedCurrent(){
      if((producerOwner.judgmentFor({
        response,
        stream
      })!==judgment)||(judgment.inspect()
        .finalRecord
        !==closure))throw new OriginalTuiApprovalError('Original TUI judgment closure changed');
      const currentBinding=judgment.readCurrentSourceBinding();
      if(currentBinding.request!==source)throw new OriginalTuiApprovalError('Original approval request receipt changed');
      if(currentBinding.sources!==sources)throw new OriginalTuiApprovalError('Original approval judgment source snapshot changed');
      for(const member of members)if(judgment.preparedMemberFor(member.handle)
        .prepared
        !==member.prepared)throw new OriginalTuiApprovalError('Original prepared group changed');
  }
  return bindPreparedTuiApproval({pi,ctx,askUser,verdictEntryType,explanation,notificationInvoker,trace,action,approvalFingerprint,closure,signal,assertPreparedCurrent});
}
