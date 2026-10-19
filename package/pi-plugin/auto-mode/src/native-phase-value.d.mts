/**
 Exact dynamic property reads for the native phase fixture callbacks.

 Declarations keep unknown input and unknown output; the JavaScript performs the
 original member accesses with their native semantics, so nullish, primitive and
 callable inputs behave exactly as the original code did. @module
 */

/**
 Normalize one tool input exactly like the original normalizer.

 @param input - raw arguments from the original bash call

 @returns trimmed-command copy or the untouched original input
 */
export declare function normalizePreparedArguments(input: unknown): unknown;

/**
 Read the raw command member of one tool input.

 @param input - raw arguments from the original bash call

 @returns the original command member value
 */
export declare function readCommandMember(input: unknown): unknown;

/**
 Read the trimmed command member of one tool input.

 @param input - raw arguments from the original bash call

 @returns the original command member value through its own trim call
 */
export declare function readTrimmedCommandMember(input: unknown): unknown;

/**
 Read the phase probe marker member of one update details value.

 @param details - details member of a tool execution update payload

 @returns the original phaseProbe member value
 */
export declare function readPhaseProbeMember(details: unknown): unknown;
