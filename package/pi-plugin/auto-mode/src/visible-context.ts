/**
 Complete user-visible session-message projection for judge context.

 Entry-to-message conversion is delegated to Pi's exported
 `sessionEntryToContextMessages`,
 the same step Pi's interactive transcript renderer runs,
 and Pi's extension loader resolves that import to the running host.
 Only per-role visible-field selection lives here.

 @module
 */

import type {
  sessionEntryToContextMessages,
  SessionEntry,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import { CONTEXT_MESSAGE_FLOOR, } from './constants.ts';
import {
  visibleMessage,
  INVISIBLE_MESSAGE,
  type VisibleMessage
} from './visible-message.ts';
import { serializeUntrustedDataForJudge, } from './tool-helpers.ts';
import {
  isVerdictEntry,
  type VerdictData,
} from './types.ts';

/**
 Attach guard verdict that Pi stores beside corresponding tool result.
 
 @param message - Visible tool-result data.
 
 @param verdict - Guard decision preceding tool result.
 
 @returns visible data plus safety decision context.
 */
function withGuardVerdict({
  message,
  verdict,
}: {
  readonly message: VisibleMessage;
  readonly verdict: ForeignBorrowed<VerdictData>;
},): VisibleMessage {
  return {
    ...message,
    guardVerdict: {
      action: verdict.action,
      verdict: verdict.verdict,
      reason: verdict.reason,
    },
  };
}

/**
 Sentinel when no guard verdict awaits tool result.
 */
const NO_PENDING_VERDICT: unique symbol = Symbol('guard verdict is not awaiting tool result',);

/**
 Convert branch entries through same Pi projection used by transcript renderer.
 
 @param entries - Active Pi session branch.
 
 @returns complete visible messages in chronological order.
 */
function visibleMessages({
  entries,
  project,
}: {
  readonly entries: ForeignBorrowed<readonly SessionEntry[]>;
  readonly project: typeof sessionEntryToContextMessages;
},): readonly VisibleMessage[] {
  /**
   Complete visible messages in chronological order.
   */
  const messages: VisibleMessage[] = [];
  /**
   Guard verdict awaiting corresponding tool-result message.
   */
  const pendingVerdict: { current: VerdictData | typeof NO_PENDING_VERDICT; } = {
    current: NO_PENDING_VERDICT,
  };
  for (const entry of entries) {
    if (isVerdictEntry(entry,)) {
      pendingVerdict.current = entry.data;
      continue;
    }
    // Pi's renderer projection: message, custom-message, summary, and compaction entries
    // become messages; state-only entries become none.
    for (const message of project(entry,)) {
      /**
       User-visible fields from current projected message.
       */
      const projectedVisibleMessage = visibleMessage(message,);
      if (projectedVisibleMessage === INVISIBLE_MESSAGE)
        continue;
      if ((message.role === 'toolResult')
        && (pendingVerdict.current !== NO_PENDING_VERDICT)) {
        messages[messages.length] = withGuardVerdict({
          message: projectedVisibleMessage,
          verdict: pendingVerdict.current,
        },);
        pendingVerdict.current = NO_PENDING_VERDICT;
        continue;
      }
      messages[messages.length] = projectedVisibleMessage;
    }
  }
  return messages;
}

/**
 Locate latest user message in visible transcript.
 
 @param messages - Complete chronological visible messages.
 
 @returns latest user-message index or negative one.
 */
function latestUserMessageIndex(
  messages: readonly VisibleMessage[],
): number {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    /**
     Candidate visible message.
     */
    const message = messages[index];
    if ((message !== undefined) && (message.role === 'user'))
      return index;
  }
  return -1;
}

/**
 Select larger of newest message floor and span from latest user message.
 
 @param messages - Complete chronological visible messages.
 
 @returns selected complete message window.
 */
function visibleMessageWindow(
  messages: readonly VisibleMessage[],
): readonly VisibleMessage[] {
  /**
   Latest visible user-message index.
   */
  const latestUserIndex = latestUserMessageIndex(messages,);
  /**
   Earliest index retaining newest message floor.
   */
  const floorStart = Math.max(
    0,
    messages.length - CONTEXT_MESSAGE_FLOOR,
  );
  /**
   Earlier start retains larger of both windows.
   */
  const start = latestUserIndex === (-1)
    ? floorStart
    : Math.min(
      latestUserIndex,
      floorStart,
    );
  /**
   Isolated selected message references in source order.
   */
  const selected: VisibleMessage[] = [];
  for (let index = start; index < messages.length; index += 1) {
    /**
     Selected visible message.
     */
    const message = messages[index];
    if (message !== undefined)
      selected[selected.length] = message;
  }
  return selected;
}

/**
 Build canonical JSON for complete visible judge-context message window.
 
 @param entries - Active Pi session branch.
 
 @returns canonical request-only JSON transcript.
 
 @example
 ```ts
 buildVisibleContext({ entries, project: sessionEntryToContextMessages });
 ```
 */
export function buildVisibleContext({
  entries,
  project,
}: {
  readonly entries: ForeignBorrowed<readonly SessionEntry[]>;
  readonly project: typeof sessionEntryToContextMessages;
},): string {
  /**
   Complete selected visible message window.
   */
  const selectedMessages = visibleMessageWindow(
    visibleMessages({
      entries,
      project,
    },),
  );
  return selectedMessages.length === 0
    ? ''
    : serializeUntrustedDataForJudge(selectedMessages,);
}
