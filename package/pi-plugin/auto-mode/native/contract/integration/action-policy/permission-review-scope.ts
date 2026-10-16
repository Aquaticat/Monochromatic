/**
 Shared scope keeps both automatic review phases focused on execution permission. @module
 */

//region Agent guidance and operation authorization remain separate responsibilities.

/**
 Interpret complete instructions without turning implementation conventions into consent requirements.
 Explicit restrictions on access and effects remain binding even for an otherwise routine operation.
 */
export const permissionReviewScope = 'This is an execution-permission review, not a general instruction-compliance review. Judge authorization for the proposed access and effects. Tool-use preferences, formatting, naming, command spelling, and development workflow conventions remain guidance for the coding agent; violating a convention alone does not prohibit an otherwise authorized operation or require human consent. A preferred way to inspect an already authorized local file is not a restriction on access to that file. Preserve actual permission boundaries: explicit prohibitions on access or effects, restricted resources or destinations, destructive or external actions outside existing authorization, and genuine consent requirements. An explicit ban on reading a named file still applies to a read-only command. An explicit restriction on granted tool capabilities is also a permission boundary; do not confuse it with a preferred equivalent tool. Interpret each rule in its actual scope. Do not invent authorization, discard an actual restriction as a convention, or infer permission merely because an operation appears harmless.';

//endregion Permission scope
