import {createNativeQueryObservation} from '../maintained-policy.mjs';

/** Original native frames and returned values remain local; maintained code owns failure retention. */
export function createLoadoutQueryObserver({
  capture,
  captureInput
}){
 const observation=createNativeQueryObservation({
   captureInput,
   captureOutput:capture
 });
 return Object.freeze({
  input(input){observation.captureInput(arguments);},
  observe({value}){
   observation.captureOutput(arguments);
   return value;
  },
  assertHealthy:observation.assertHealthy,
  reportFailed:observation.reportFailed
 });
}
