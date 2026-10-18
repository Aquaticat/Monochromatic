/**
 Original tool inputs remain local; model inputs contain parsed Bash structure. @module
 */
import {
  parseShellReviewStructure,
  ShellReviewSyntaxError,
} from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Module diagnostics retain the projection boundary without original command content.
 */
const moduleLogger=tagged({tag:'auto-mode-review-operation'});

//region Current proposals require syntax; earlier activity can describe unavailable syntax.
/**
 Invalid Bash input cannot silently disappear from review.
 */
export class ReviewOperationInputError extends Error {
  /**
   Identify malformed operation input at the projection boundary.
   */
  override readonly name = 'ReviewOperationInputError';
}

/**
 Replace Bash source with parsed structure while retaining other tool arguments.
 
 @param name - original tool name
 
 @param input - original tool argument record
 
 @returns model-facing input without raw Bash command source
 
 @throws ReviewOperationInputError when Bash command field is unavailable
 
 @example
 ```ts
 projectReviewInput({ name: 'bash', input: { command: 'ls project | head -30' } });
 ```
 */
export function projectReviewInput({
  name,
  input,
}: {
  readonly name: string;
  readonly input: Readonly<Record<string, unknown>>;
}): Readonly<Record<string, unknown>> {
  /**
   Function-scoped projection diagnostics omit original argument content.
   */
  const l = tagged({
    tag: projectReviewInput.name,
    l:moduleLogger
  });
  l.debug('projecting tool arguments for review');
  if ((name !== 'bash') && (!((name === 'process') && (input.action === 'start')))) return input;
  /**
   Keep original execution options beside the parsed command structure.
   */
  const {
    command,
    ...options
  } = input;
  if ((typeof command) !== 'string')
    throw new ReviewOperationInputError('Shell operation input has no command string to parse for review');
  return {
    ...options,
    shell: parseShellReviewStructure(command),
  };
}
/**
 Preserve earlier shell activity as data when its complete syntax is unavailable.

 Unavailable historical syntax establishes no command effects or permission.
 Current prepared operations continue through the strict projection instead.

 @param name - original historical discriminator selects command metadata
 
 @param input - original arguments remain local and unchanged
 
 @returns historical model data without raw command source
 
 @throws Error when a failure is unrelated to unavailable shell structure
 
 @example
 projectHistoricalReviewInput({name:'bash',input:{command:'printf ('}});
 */
export function projectHistoricalReviewInput({
 name,
 input,
}:{
 readonly name:string;
 readonly input:Readonly<Record<string,unknown>>;
}):Readonly<Record<string,unknown>>{
 /**
  Historical diagnostics keep unavailable syntax separate from permission.
  */
 const l=tagged({
   tag:projectHistoricalReviewInput.name,
   l:moduleLogger
 });
 l.debug('projecting earlier tool activity without evaluating command effects');
 try{
  return projectReviewInput({
   name,
   input
  });
 }
 catch(error){
  if((!(error instanceof ShellReviewSyntaxError))&&(!(error instanceof ReviewOperationInputError)))throw error;
  l.debug(String(error));
  /**
   Non-command options remain complete beside the unavailable structure.
   */
  const {
    command,
    ...options
  }=input;
  return {
   ...options,
   shell:Object.freeze({
    language:'bash',
    syntax:'unavailable',
    reason:(typeof command)==='string'?'incomplete-or-unsupported-shell':'command-not-available',
    expansionValues:'not-evaluated',
    effects:'not-established',
   }),
  };
 }
}
//endregion
