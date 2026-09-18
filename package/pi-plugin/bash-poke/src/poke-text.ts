/**
 Poke message content and outcome details.

 @module
 */

import {
  BACKTICK_CHARACTER,
  CANCELLED_STATUS,
  EMPTY_OUTPUT_NOTE,
  EXIT_STATUS_PREFIX,
  MIN_FENCE_LENGTH,
  POKE_HEADER_PREFIX,
  SPAWN_FAILURE_PREFIX,
  UNKNOWN_EXIT_STATUS,
} from './constants.ts';

//region Types

/**
 Structured outcome carried beside poke content for the renderer.
 
 Pi excludes details from model context, so anything the model must act on has
 to appear in the content string instead.
 */
type PokeDetails = {
  /**
   Command line as the user typed it.
   */
  readonly command: string;

  /**
   Reported exit code, absent when the job was signalled or never started.
   */
  readonly exitCode?: number;

  /**
   Whether the user cancelled the job.
   */
  readonly cancelled: boolean;

  /**
   Whether output was elided to fit the poke budget.
   */
  readonly truncated: boolean;

  /**
   Characters removed from the middle of the output.
   */
  readonly elidedChars: number;

  /**
   Path holding complete output, absent when spooling was unavailable.
   */
  readonly spoolPath?: string;

  /**
   Characters captured before truncation, so scale survives elision.
   */
  readonly outputChars: number;
};

//endregion Types

//region Status

/**
 Describes how a job ended in words a model can act on.
 
 @param exitCode - reported exit code, absent when signalled
 
 @param cancelled - whether the user cancelled the job
 
 @returns status phrase for the poke heading
 
 @example
 ```ts
 jobStatusText({ exitCode: 1, cancelled: false, },);
 ```
 */
function jobStatusText(
  {
    exitCode,
    cancelled,
  }: {
    readonly exitCode?: number;
    readonly cancelled: boolean;
  },
): string {
  if (cancelled)
    return CANCELLED_STATUS;
  if (exitCode === undefined)
    return UNKNOWN_EXIT_STATUS;
  return `${EXIT_STATUS_PREFIX}${String(exitCode)}`;
}

//endregion Status

//region Fencing

/**
 Measures the longest backtick run inside text.
 
 @param text - output about to be fenced
 
 @returns length of the longest consecutive backtick run
 
 @example
 ```ts
 longestBacktickRun({ text: 'a `` b', },);
 ```
 */
function longestBacktickRun({ text, }: { readonly text: string; }, ): number {
  /**
   Longest run seen so far.
   */
  let longest = 0;

  /**
   Length of the run ending at the current character.
   */
  let current = 0;
  for (const character of text) {
    if (character === BACKTICK_CHARACTER) {
      current += 1;
      if (current > longest)
        longest = current;
      continue;
    }
    current = 0;
  }
  return longest;
}

/**
 Builds a fence longer than any backtick run in the output.
 
 Output comes from an arbitrary command, so it can contain a fence of its own.
 A closing fence must be at least as long as the opening one, and an opening
 fence shorter than a run inside the body would let the body terminate the
 block early and smuggle the rest into the transcript as prose.
 
 @param text - output about to be fenced
 
 @returns backtick run safe to fence this output with
 
 @example
 ```ts
 fenceFor({ text: '```', },);
 ```
 */
function fenceFor({ text, }: { readonly text: string; }, ): string {
  /**
   Run length that strictly exceeds anything inside the body.
   */
  const length = Math.max(
    longestBacktickRun({ text, }, ) + 1,
    MIN_FENCE_LENGTH,
  );
  return BACKTICK_CHARACTER.repeat(length, );
}

//endregion Fencing

//region Notes

/**
 Builds the note naming where complete output lives after an elision.
 
 @param details - structured outcome being reported
 
 @returns note line, empty when nothing was elided or no spool path exists
 
 @example
 ```ts
 spoolNote({ details: { command: 'true', cancelled: false, truncated: true, elidedChars: 9, spoolPath: '/tmp/x.log', outputChars: 20, }, },);
 ```
 */
function spoolNote(
  { details, }: {
    readonly details: Pick<PokeDetails, 'truncated' | 'spoolPath'>;
  },
): string {
  if (!details.truncated)
    return '';
  if (details.spoolPath === undefined)
    return '';
  return `[complete output: ${details.spoolPath}]`;
}

/**
 Combines recorded output with a spawn failure note.
 
 A command that never started has no exit code and usually no output, so the
 failure text is the only thing the model can act on and must not be dropped.
 
 @param output - recorded output text, possibly empty
 
 @param spawnError - failure text, absent when the command started
 
 @returns output to embed in the poke
 
 @example
 ```ts
 jobOutputText({ output: '', spawnError: 'spawn ENOENT', },);
 ```
 */
function jobOutputText(
  {
    output,
    spawnError,
  }: {
    readonly output: string;
    readonly spawnError?: string;
  },
): string {
  if (spawnError === undefined)
    return output;

  /**
   Failure line carrying the reason the command never ran.
   */
  const note = `${SPAWN_FAILURE_PREFIX}${spawnError}`;
  return output.length === 0
    ? note
    : `${output}\n${note}`;
}

//endregion Notes

//region Content

/**
 Builds poke content: what the model reads when a background job finishes.
 
 @param details - structured outcome being reported
 
 @param output - truncated, sanitized output to embed, trimmed of surrounding whitespace
 
 @param instruction - trailing instruction, omitted when empty
 
 @returns message content sent to Pi
 
 @example
 ```ts
 buildPokeContent({
   details: { command: 'true', cancelled: false, truncated: false, elidedChars: 0, outputChars: 0, },
   output: '',
   instruction: 'continue',
 },);
 ```
 */
function buildPokeContent(
  {
    details,
    output,
    instruction,
  }: {
    readonly details: PokeDetails;
    readonly output: string;
    readonly instruction: string;
  },
): string {
  /**
   Heading naming the command and how it ended.
   */
  const heading = `${POKE_HEADER_PREFIX}${details.command} (${jobStatusText({
    ...(details.exitCode === undefined ? {} : { exitCode: details.exitCode, }),
    cancelled: details.cancelled,
  }, )})`;

  /**
   Output without surrounding whitespace, so a command's final newline cannot
   leave a blank line inside the fence and a whitespace-only run still reads as
   having produced nothing.
   */
  const trimmed = output.trim();

  /**
   Fence long enough that output cannot terminate its own block.
   */
  const fence = fenceFor({ text: trimmed, }, );

  /**
   Body lines: fenced output, or an explicit note that there was none.
   */
  const body: string[] = trimmed.length === 0
    ? [EMPTY_OUTPUT_NOTE, ]
    : [
      fence,
      trimmed,
      fence,
    ];

  /**
   Note pointing at complete output, present only when there is one.
   */
  const note = spoolNote({ details, }, );

  /**
   Heading plus optional note plus body, before any instruction.
   */
  const lines: string[] = note.length === 0
    ? [
      heading,
      ...body,
    ]
    : [
      heading,
      note,
      ...body,
    ];

  if (instruction.length > 0)
    lines.push(
      '',
      instruction,
    );
  return lines.join('\n', );
}

//endregion Content

export {
  buildPokeContent,
  fenceFor,
  jobOutputText,
  jobStatusText,
  longestBacktickRun,
  spoolNote,
};

export type { PokeDetails, };
