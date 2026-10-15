/**
 Start the original producer-owned judgment at the native completed response,
 before argument preparation. The installed Agent awaits these listeners.
 This creates no timer: the existing producer owns the clock and constructor.
 It is not a permission check or a complete prepared-group execution gate.
 */
export function registerOriginalJudgmentStart({
  agent,
  producerOwner,
  stream
}){
 return agent.subscribe(function beforePreparation(
   event,
   signal
 ){
  if((event.type!=='message_end')||(event.message
    .role
    !=='assistant'))return;
  const response=event.message;
  // Native run failures synthesize terminal messages without a model-response receipt.
  // The native loop never executes their tool content or prepares a judgment.
  if((response.stopReason==='error')||(response.stopReason==='aborted'))return;
  producerOwner.assertMainAgentResponse({
    response,
    stream
  });
  if(!response.content
    .some(function isToolCallPart(part) { return (part.type==='toolCall'); }))return;
  producerOwner.beginJudgment({
    response,
    stream,
    signal
  });
 });
}
