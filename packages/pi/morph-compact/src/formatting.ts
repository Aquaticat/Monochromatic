/**
 * Query extraction and input/output formatting for Morph Compact.
 */

import type {
  SessionEntry,
  SessionMessageEntry,
} from '@earendil-works/pi-coding-agent';

//region Text content extraction

/**
 * Type guard for text content items in a message content array.
 *
 * @param item - unknown value to test
 *
 * @returns whether item is a text content block with type "text" and string text
 *
 * @example
 * ```typescript
 * if (isTextContentItem(element)) {
 *   console.log(element.text); // string
 * }
 * ```
 */
function isTextContentItem(
  item: unknown,
): item is {
  type: string;
  text: string;
} {
  if (typeof item !== 'object' || item === null)
    return false;
  // Property-existence checks narrow `object` to `object & Record<string, unknown>`
  // without an explicit type assertion
  if (!('type' in item) || !('text' in item))
    return false;
  const typeVal = item.type;
  const textVal = item.text;
  return (
    typeVal === 'text'
    && typeof textVal === 'string'
  );
}

/**
 * Extract text content from a message content field (string or content array).
 *
 * @param content - raw message content, either a string or structured array
 *
 * @returns concatenated text or undefined if no text found
 *
 * @example
 * ```typescript
 * textFromContent("hello") // "hello"
 * textFromContent([{ type: "text", text: "hi" }]) // "hi"
 * ```
 */
export function textFromContent(
  content: unknown,
): string | undefined {
  if (typeof content === 'string') {
    const trimmed = content.trim();
    if (trimmed === '')
      return undefined;
    return trimmed;
  }
  if (!Array.isArray(content,))
    return undefined;
  const result = content
    .filter(function checkItem(item,) {
      return isTextContentItem(item,);
    },)
    .map(function extractTrimmedText(item,) {
      return item.text.trim();
    },)
    .filter(function isNonEmpty(trimmed,) {
      return trimmed !== '';
    },)
    .join('\n',);
  if (result === '')
    return undefined;
  return result;
}

//endregion

//region Query extraction

/**
 * Derive a query string for Morph Compact from the conversation.
 * Checks custom instructions first, then walks branch entries backwards
 * for the last user message or bash execution text.
 *
 * @param branchEntries - all entries on the current session branch
 *
 * @param customInstructions - optional user-provided instructions (takes priority)
 *
 * @returns query string for Morph Compact, or empty string if none found
 *
 * @example
 * ```typescript
 * const query = extractLatestQuery(entries, "focus on auth");
 * // Returns "focus on auth" (custom instructions take priority)
 * ```
 */
export function extractLatestQuery(
  branchEntries: SessionEntry[],
  customInstructions?: string,
): string {
  const custom = customInstructions?.trim();
  if (custom !== undefined && custom !== '')
    return custom;

  for (let index = branchEntries.length - 1; index >= 0; index -= 1) {
    const entry = branchEntries[index];
    if (entry === undefined)
      continue;
    if (entry.type !== 'message')
      continue;
    const msgEntry = entry as SessionMessageEntry;
    const message = msgEntry.message as {
      role?: string;
      content?: unknown;
      command?: string;
      output?: string;
    };
    if (message.role === 'user') {
      const text = textFromContent(message.content,);
      if (text !== undefined && text !== '')
        return text;
    }
    if (
      message.role === 'bashExecution'
      && message.command !== undefined
      && message.command !== ''
    ) {
      return message.command.trim();
    }
  }
  return '';
}

//endregion

//region Output wrapping

/**
 * Wrap Morph Compact output with explanatory header and XML tags.
 * The header helps the LLM understand that the content is a
 * verbatim line-deleted transcript, not a structured summary.
 *
 * @param output - raw Morph Compact output
 *
 * @returns wrapped output with explanatory header and XML tags
 *
 * @example
 * ```typescript
 * const wrapped = wrapMorphOutput("[User]: hello");
 * // Contains "<morph-compacted-history>...</morph-compacted-history>"
 * ```
 */
export function wrapMorphOutput(output: string,): string {
  return [
    'Morph Compact verbatim transcript of earlier context.',
    'Surviving lines are exact excerpts from the original serialized conversation.',
    'Irrelevant lines were removed.',
    '',
    '<morph-compacted-history>',
    output.trim(),
    '</morph-compacted-history>',
  ]
    .join('\n',);
}

//endregion

//region Input building

/**
 * Build the input string for Morph Compact.
 * Wraps the previous summary in `<keepContext>` tags so Morph
 * preserves it during line deletion, then appends the serialized
 * conversation.
 *
 * @param serializedConversation - full conversation text from serializeConversation
 *
 * @param previousSummary - optional previous compaction summary to preserve
 *
 * @returns combined input string for Morph Compact
 *
 * @example
 * ```typescript
 * const input = buildMorphInput(conversationText, previousSummary);
 * ```
 */
export function buildMorphInput(
  serializedConversation: string,
  previousSummary?: string,
): string {
  const parts: string[] = [];
  const previous = previousSummary?.trim();
  if (previous !== undefined && previous !== '') {
    parts.push('<keepContext>',);
    parts.push('[Previous compacted context]',);
    parts.push(previous,);
    parts.push('</keepContext>',);
  }
  if (serializedConversation.trim() !== '')
    parts.push(serializedConversation.trim(),);
  return parts.join('\n\n',);
}

//endregion
