/**
 Original tool inputs remain local; model inputs contain parsed Bash structure. @module
 */
import { parseShellReviewStructure, } from '@monochromatic-dev/agent-harness-shared-shell-command-analyzer/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

//region One projection covers both proposed operations and historical tool calls.
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
  const l = tagged({ tag: projectReviewInput.name, });
  l.debug('projecting tool arguments for review');
  if (name !== 'bash') return input;
  /**
   Keep original execution options beside the parsed command structure.
   */
  const {
    command,
    ...options
  } = input;
  if ((typeof command) !== 'string')
    throw new ReviewOperationInputError('Bash tool input has no command string to parse for review');
  return {
    ...options,
    shell: parseShellReviewStructure(command),
  };
}
//endregion
