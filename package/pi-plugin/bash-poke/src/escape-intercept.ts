/**
 Lone-Escape detection and gating for job cancellation.

 @module
 */

import type { TerminalInputHandler, } from '@earendil-works/pi-coding-agent';

import {
  BARE_ESCAPE,
  BASH_MODE_PREFIX,
  KITTY_ESCAPE,
} from './constants.ts';

//region Types

/**
 Session state read at keypress time to decide whether Escape is ours.
 */
type EscapeGate = {
  /**
   Whether Pi is between agent runs, so Escape is not already aborting a turn.
   */
  readonly isIdle: () => boolean;

  /**
   Current editor text, whose leading `!` means Pi is in bash mode.
   */
  readonly editorText: () => string;

  /**
   Count of jobs that could be cancelled.
   */
  readonly jobCount: () => number;
};

//endregion Types

//region Detection

/**
 Reports whether one delivered input chunk is a lone Escape press.
 
 Pi's stdin buffering already holds a bare escape for its own timeout before
 delivering it, and delivers alt combinations as one escape-plus-byte chunk, so
 a chunk equal to either encoding is genuinely a lone press and needs no
 disambiguation window here. Both encodings are matched because Pi requests the
 Kitty keyboard protocol, under which Escape arrives in functional form.
 
 @param data - one complete input chunk
 
 @returns whether the chunk is a lone Escape
 
 @example
 ```ts
 isLoneEscape({ data: '\u001b', },);
 ```
 */
function isLoneEscape({ data, }: { readonly data: string; }, ): boolean {
  return (data === BARE_ESCAPE) || (data === KITTY_ESCAPE);
}

/**
 Decides whether a keystroke should cancel every running job.
 
 Escape belongs to Pi while an agent runs, because it is the only way to abort
 a turn, and it belongs to Pi in bash mode, because pressing it there means
 "leave bash mode" rather than "kill my jobs". Cancelling is therefore claimed
 only for an idle session with jobs running and an editor that is not mid-`!`.
 
 @param data - one complete input chunk
 
 @param gate - session state read at keypress time
 
 @returns whether cancellation is ours to perform
 
 @example
 ```ts
 shouldCancelOnEscape({
   data: '\u001b',
   gate: { isIdle: () => true, editorText: () => '', jobCount: () => 1, },
 },);
 ```
 */
function shouldCancelOnEscape(
  {
    data,
    gate,
  }: {
    readonly data: string;
    readonly gate: EscapeGate;
  },
): boolean {
  if (!isLoneEscape({ data, }, ))
    return false;
  if (gate.jobCount() === 0)
    return false;
  if (!gate.isIdle())
    return false;
  return !gate.editorText()
    .startsWith(BASH_MODE_PREFIX, );
}

//endregion Detection

//region Listener

/**
 Builds the terminal input listener that cancels jobs on a lone Escape.
 
 The listener never consumes the chunk. Pi's own Escape handling stays intact,
 which is what keeps aborting a streaming turn, leaving bash mode, and the
 double-escape selectors working while jobs run.
 
 @param gate - session state read at keypress time
 
 @param onCancel - invoked when a lone Escape should cancel every job
 
 @returns listener suitable for `ctx.ui.onTerminalInput`
 
 @example
 ```ts
 const listener = createEscapeListener({
   gate: { isIdle: () => true, editorText: () => '', jobCount: () => 0, },
   onCancel() {},
 },);
 listener('\u001b');
 ```
 */
function createEscapeListener(
  {
    gate,
    onCancel,
  }: {
    readonly gate: EscapeGate;
    readonly onCancel: () => void;
  },
): TerminalInputHandler {
  return function onTerminalInput(data: string, ): undefined {
    if (!shouldCancelOnEscape({
      data,
      gate,
    }, ))
      return undefined;
    onCancel();
    return undefined;
  };
}

//endregion Listener

export {
  createEscapeListener,
  isLoneEscape,
  shouldCancelOnEscape,
};

export type { EscapeGate, };
