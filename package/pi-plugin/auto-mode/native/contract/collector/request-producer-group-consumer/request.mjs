//region Combine independently issued origin and current wire observations without creating permission.
/** Return current main-agent request receipt for the exact SDK response and bound stream consumer. */
export function readMainAgentRequest({
  producerOwner,
  observer,
  stream,
  response
}) {
  producerOwner.assertMainAgentResponse({
    stream,
    response
  });
  return observer.observationFor(response);
}
//endregion
