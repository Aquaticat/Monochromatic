/** Visible-context selection and native tool presentation constants. @module */

//region Context selection retains recent visible messages.
/** Minimum newest visible messages included when session history exists. */
export const CONTEXT_MESSAGE_FLOOR = 5;
//endregion

//region Built-in tool presentation retains the original tool vocabulary.
/** Tool names understood by the native tool-description helpers. */
export const RELEVANT_TOOLS: readonly string[] = ['bash', 'read', 'write', 'edit', 'grep', 'find', 'ls'] as const;
//endregion
