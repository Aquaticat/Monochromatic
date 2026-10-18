import {randomUUID} from 'node:crypto';
import {inspect} from 'node:util';
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {sha} from './wire-source.mjs';

const l=tagged({tag:'auto-mode-assessment-evidence'});

//region Exact model inputs and replies remain local diagnostics, separate from evidence authority.
/** Correlate transport records with the original operations retained by decision evidence. */
export function operationDiagnosticId(envelope){
 return sha(JSON.stringify([envelope.parentJSON,envelope.preparedJSON]));
}

/** Record complete selected inputs without transport credentials or the archived provider request. */
export function captureAssessmentDiagnostics({request,state,questions}){
 const dl=tagged({tag:captureAssessmentDiagnostics.name,l});
 const assessmentId=randomUUID();
 const operationId=operationDiagnosticId(request.envelope);
 dl.debug(JSON.stringify({assessmentId,operationId,event:'assessment-request',model:request.model,catalogSHA256:request.catalogSHA256,state,questions}));
 return function recordAssessmentResponse({parsed,error,raw}){
  tagged({tag:recordAssessmentResponse.name,l:dl}).debug(JSON.stringify({
   assessmentId,operationId,event:error===undefined?'assessment-response':'assessment-response-invalid',
   parsed,...(error===undefined?{}:{error:inspect(error,{depth:8}),raw})
  }));
 };
}
//endregion Exact assessment diagnostics
