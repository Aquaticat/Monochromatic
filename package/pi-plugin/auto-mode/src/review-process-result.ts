/** Known process metadata shares the original shell review projection. @module */
import {tagged} from '@monochromatic-dev/module-logger/ts';
import {projectReviewInput} from './review-operation.ts';

//region Only installed process records identify command metadata as shell syntax.
/**
 Narrow metadata without treating arrays or primitive output as process records.
 @param value - original visible metadata
 @returns whether named metadata fields can be inspected
 */
function isMetadataRecord(value:unknown):value is Readonly<Record<string,unknown>>{
  return typeof value==='object'&&value!==null&&!Array.isArray(value);
}

/**
 Parse the known command field while preserving every other process property.
 @param value - original process or notification record
 @returns isolated shell projection or unchanged metadata lacking a command
 */
function projectProcessRecord(value:unknown):unknown{
  /** Metadata contents remain outside diagnostic text. */
  const l=tagged({tag:projectProcessRecord.name});
  if(!isMetadataRecord(value)||typeof value.command!=='string')return value;
  l.debug('projecting visible process command metadata');
  return projectReviewInput({name:'bash',input:value});
}

/**
 Project the finite process-result and process-notification metadata shapes.
 Arbitrary output strings and unrelated tools retain their complete data.
 @param details - original renderer metadata
 @param process - whether the original tool or custom-message type identifies process metadata
 @returns review metadata without raw command fields in known process records
 */
export function projectProcessResultDetails({details,process}:{readonly details:unknown;readonly process:boolean}):unknown{
  /** Selection uses the original message discriminator rather than command-looking text. */
  const l=tagged({tag:projectProcessResultDetails.name});
  if(!process||!isMetadataRecord(details))return details;
  l.debug('projecting known visible process metadata');
  /** Start and write carry one record; list carries records; stop carries result.info. */
  const single=details.process;
  /** Lists preserve record order and all non-command values. */
  const listed=details.processes;
  /** Stop results retain their original success and failure information. */
  const stopped=details.result;
  /** Notifications carry command metadata directly rather than under a process field. */
  const projected=typeof details.command==='string'?projectReviewInput({name:'bash',input:details}):details;
  return {
    ...projected,
    ...(single===undefined?{}:{process:projectProcessRecord(single)}),
    ...(Array.isArray(listed)?{processes:listed.map(projectProcessRecord)}:{}),
    ...(isMetadataRecord(stopped)&&stopped.info!==undefined
      ?{result:{...stopped,info:projectProcessRecord(stopped.info)}}:{}),
  };
}
//endregion
