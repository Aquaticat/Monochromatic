/** Exact dynamic property reads for the native phase fixture callbacks. @module */

//region JavaScript performs the original member reads with native semantics.

/**
 Normalize one tool input exactly like the original normalizer.

 @param input - raw arguments from the original bash call

 @returns trimmed-command copy or the untouched original input
 */
export function normalizePreparedArguments(input) {
  return typeof input.command === 'string'
    ? { ...input, command: input.command.trim() }
    : input;
}

/**
 Read the raw command member of one tool input.

 @param input - raw arguments from the original bash call

 @returns the original command member value
 */
export function readCommandMember(input) {
  return input.command;
}

/**
 Read the trimmed command member of one tool input.

 @param input - raw arguments from the original bash call

 @returns the original command member value through its own trim call
 */
export function readTrimmedCommandMember(input) {
  return input.command.trim();
}

/**
 Read the phase probe marker member of one update details value.

 @param details - details member of a tool execution update payload

 @returns the original phaseProbe member value
 */
export function readPhaseProbeMember(details) {
  return details?.phaseProbe;
}

//endregion
