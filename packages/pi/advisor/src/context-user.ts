/**
 * User-message helpers for Advisor context metadata.
 *
 * @module
 */

import type {
  TextContent,
  UserMessage,
} from '@earendil-works/pi-ai';
import type { SessionEntry, } from '@earendil-works/pi-coding-agent';
import type { ReadonlyDeep, } from 'type-fest';
import { LATEST_USER_EXCERPT_CHARS, } from './constants.ts';

//region Public API

/**
 * Extract latest user prompt excerpt from a branch.
 *
 * @param branch - session branch entries
 *
 * @returns latest user prompt excerpt, if present
 *
 * @example
 * ```typescript
 * latestUserPromptExcerpt(branch);
 * ```
 */
export function latestUserPromptExcerpt(
  branch: readonly SessionEntry[],
): string | undefined {
  /** Latest user message entry, if present. */
  const latestUserEntry = branch
    .toReversed()
    .find(function findUserEntry(entry,) {
      return isUserMessageEntry(entry,);
    },);
  if (latestUserEntry === undefined)
    return undefined;

  /** Plain text extracted from user message content. */
  const text = userMessageText(latestUserEntry.message
    .content,);
  return text.length
    <= LATEST_USER_EXCERPT_CHARS
    ? text
    : `${
      text.slice(
        0,
        LATEST_USER_EXCERPT_CHARS,
      )
    }…`;
}

//endregion Public API

//region Internal helpers

/**
 * Convert user message content into plain text.
 *
 * @param content - user message content
 *
 * @returns plain text from text blocks
 */
function userMessageText(
  content: ReadonlyDeep<UserMessage['content']>,
): string {
  if ((typeof content) === 'string')
    return content;
  return content
    .filter(function keepTextBlock(block,): block is TextContent {
      return block.type
        === 'text';
    },)
    .map(function mapTextBlock(block,) {
      return block.text;
    },)
    .join('\n',);
}

/**
 * Detect user message session entries.
 *
 * @param entry - session entry to inspect
 *
 * @returns whether entry contains a user message
 */
function isUserMessageEntry(
  entry: SessionEntry,
): entry is SessionEntry & {
  readonly type: 'message';
  readonly message: UserMessage;
} {
  return (entry.type
    === 'message') && (entry.message
      .role
      === 'user');
}

//endregion Internal helpers
