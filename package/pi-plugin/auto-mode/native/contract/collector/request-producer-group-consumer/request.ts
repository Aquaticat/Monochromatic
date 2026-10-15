/**
 Original request handoff preserves producer authentication and observer callback receivers. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import type { MainAgentRequestInput } from './request-types.ts';

/**
 Request diagnostics omit original source and response contents.
 */
const l = tagged({ tag: 'auto-mode-main-agent-request' });

//region Producer custody precedes current request observation without creating permission.
/**
 Return the current original receipt for an exact SDK response and bound stream consumer.

 @param producerOwner - original response custody capability

 @param observer - original current request observer

 @param stream - original bound SDK stream

 @param response - original SDK response whose request is being read

 @returns exact observer receipt after producer authentication

 @example readMainAgentRequest(input);
 */
export function readMainAgentRequest<const Receipt extends object>({
  producerOwner,
  observer,
  stream,
  response
}: MainAgentRequestInput<Receipt>): Receipt {
  /**
   Logging does not inspect original receipt or callback properties.
   */
  const rl = tagged({
    tag: readMainAgentRequest.name,
    l
  });
  rl.debug('authenticating original request handoff');
  producerOwner.assertMainAgentResponse({
    stream,
    response
  });
  return observer.observationFor(response);
}
//endregion
