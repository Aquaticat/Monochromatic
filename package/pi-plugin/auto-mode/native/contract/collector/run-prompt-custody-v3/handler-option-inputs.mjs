import {createHash} from 'node:crypto';

/**
 Represent already-owned callback option snapshots, not a second native observation or caller coverage claim.
 The run owner supplies validated immutable snapshots; the run publication authenticates membership.
 */
export function captureHandlerOptionInputs({
  observations,
  runOccurrence
}){
 return Object.freeze(observations.map(function captureHandlerOptions(observation) {
  const content=JSON.stringify(observation.before
    .options);
  return Object.freeze({
    kind:'native-run-handler-options-input',
    content,
    contentFormat:'native-content-json',
    inputLocation:Object.freeze({
      field:'handlerOptions',
      ordinal:observation.ordinal,
      metadataJSON:JSON.stringify({
        method:'before_agent_start',
        phase:'input',
        contentFormat:'native-content-json'
      })
    }),
    sha256:createHash('sha256')
      .update(content)
      .digest('hex'),
    occurrence:Object.freeze({}),
    runOccurrence,
    registration:undefined,
    permission:false
  });
 }));
}
