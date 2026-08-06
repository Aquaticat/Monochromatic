/**
 * Depth guard for forced continuation.
 *
 * Forced continuation originally relied on Claude Code ending the blocked chain
 * by itself. That was measured and is false. Two disposable runs whose agent
 * produced no tool calls ended after nine dispatches, and one producing modest
 * work ended after seventeen, which together looked like a platform ceiling. A
 * run whose agent ran one shell command per continuation reached thirty-one
 * dispatches and stopped only because the probe's own cap fired: Claude Code
 * never intervened. An always-blocking hook is therefore unbounded exactly when
 * the agent stays busy, which is the case that costs the most.
 *
 * The guard counts how many forced continuations have already happened since
 * the last human turn and allows the stop once that reaches the limit. Counting
 * comes from the transcript rather than a sidecar so there is no state to
 * corrupt, no cleanup to miss, and resuming a session cannot lose the count.
 *
 * @module
 */

import { open, } from 'node:fs/promises';

/**
 * Marker identifying this hook's own forced-continuation feedback in a transcript.
 *
 * Matches the opening clause of {@link autoContinueReason}. Sharing the literal
 * would couple the reason's wording to transcript parsing, so the marker is
 * deliberately short enough to survive edits to the rest of the reason.
 */
const CONTINUATION_MARKER = 'You are stopping while tracked work may remain' as const;

/**
 * Prefix Claude Code puts on the transcript record it feeds back to the model.
 *
 * Required alongside {@link CONTINUATION_MARKER} because each block writes the
 * reason twice: once as this feedback record and once inside a
 * `hook_blocking_error` attachment. Counting both double-counts every block,
 * which halves the effective limit.
 */
const FEEDBACK_PREFIX = 'Stop hook feedback' as const;

/**
 * Environment variable overriding {@link DEFAULT_MAX_DEPTH}.
 */
const MAX_DEPTH_ENV = 'MONOCHROMATIC_STOP_AUTO_CONTINUE_MAX' as const;

/**
 * Forced continuations allowed per human turn before a stop is permitted.
 *
 * Chosen well above the observed productive range so ordinary work is never
 * cut short, while still bounding a runaway. The measured live session used 14
 * across its whole run and the busiest probe reached 31 without self-limiting.
 */
const DEFAULT_MAX_DEPTH = 25;

/**
 * Transcript bytes read from the end of the file when counting depth.
 *
 * Depth only ever spans the records since the last human turn, so the whole
 * transcript never needs parsing. Sized to hold far more than one turn's worth
 * of records even when tool results are large; a live 3.4 MB session transcript
 * read identically whole and tailed.
 *
 * When a turn does exceed this, the scan reaches the start of the buffer without
 * meeting a human turn and returns everything it counted, which includes blocks
 * from earlier turns. That overcounts, so the limit is reached sooner and the
 * stop is allowed sooner. Failing toward stopping is the safe direction for an
 * unbounded-by-default mechanism.
 */
const TAIL_BYTES = 4_000_000;

/**
 * Resolves the configured depth limit.
 *
 * @param rawSetting - value read from {@link MAX_DEPTH_ENV}
 *
 * @returns configured limit, or {@link DEFAULT_MAX_DEPTH} when unset or unparsable
 *
 * @example
 * ```ts
 * maxContinuationDepth('40'); // 40
 * maxContinuationDepth(''); // 25
 * ```
 */
function maxContinuationDepth(rawSetting: string,): number {
  /**
   * Parsed limit; `Number` rejects blanks and words as `NaN`.
   */
  const parsed = Number(rawSetting.trim(),);

  if ((!Number.isInteger(parsed,))
    || (parsed < 1)) {
    return DEFAULT_MAX_DEPTH;
  }
  return parsed;
}

/**
 * Reports whether a record is one of this hook's own forced-continuation blocks.
 *
 * Claude Code delivers the block reason as a user record whose whole content is
 * a string opening with {@link FEEDBACK_PREFIX}. Requiring that shape excludes
 * the paired `hook_blocking_error` attachment, which carries the same reason and
 * would otherwise double every count.
 *
 * @param record - parsed transcript record
 *
 * @returns whether this record is a forced-continuation block
 *
 * @example
 * ```ts
 * isForcedContinuationRecord({ type: 'user', message: { content: 'Stop hook feedback:\nYou are stopping...' } });
 * ```
 */
function isForcedContinuationRecord(record: TranscriptRecord,): boolean {
  /**
   * Record content, only a string for the feedback records this counts.
   */
  const content = record
    .message
    ?.content;

  return (record.type === 'user')
    && (record.toolUseResult === undefined)
    && ((typeof content) === 'string')
    && (content.startsWith(FEEDBACK_PREFIX,))
    && (content.includes(CONTINUATION_MARKER,));
}

/**
 * Reports whether a record is a genuine turn typed by the user.
 *
 * Tool results also carry `type: 'user'`, and subagent branches repeat the
 * origin marker, so both are excluded explicitly.
 *
 * @param record - parsed transcript record
 *
 * @returns whether this record closes the counting window
 *
 * @example
 * ```ts
 * isHumanTurnRecord({ type: 'user', origin: { kind: 'human' } }); // true
 * ```
 */
function isHumanTurnRecord(record: TranscriptRecord,): boolean {
  /**
   * Origin marker, present only on records Claude Code attributes to a speaker.
   */
  const originKind = record
    .origin
    ?.kind;

  return (record.type === 'user')
    && (originKind === 'human')
    && (record.isSidechain !== true)
    && (record.toolUseResult === undefined);
}

/**
 * Transcript record shape this module inspects.
 *
 * Only the fields that classify a record; everything else is ignored.
 */
type TranscriptRecord = {
  readonly type?: string;
  readonly isSidechain?: boolean;
  readonly toolUseResult?: unknown;
  readonly origin?: { readonly kind?: string; };
  readonly message?: { readonly content?: unknown; };
};

/**
 * Parses one transcript line, or reports it as unreadable.
 *
 * @param line - raw JSONL line
 *
 * @returns parsed record, or {@link UNPARSABLE} for a truncated or partial line
 *
 * @example
 * ```ts
 * parseRecord('{"type":"user"}');
 * ```
 */
function parseRecord(line: string,): TranscriptRecord | typeof UNPARSABLE {
  try {
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted JSONL written by Claude Code
    return JSON.parse(line,) as TranscriptRecord;
  }
  catch (error) {
    void error;
    return UNPARSABLE;
  }
}

/**
 * Sentinel for a transcript line that is not valid JSON.
 *
 * A truncated final line is normal while a session is live, so this is an
 * expected value rather than an error condition.
 */
const UNPARSABLE: unique symbol = Symbol('claude-code-plugin/stop-reminder/unparsable-transcript-line',);

/**
 * Counts forced continuations already issued since the last human turn.
 *
 * Scans transcript records newest first and stops at the first genuine human
 * turn, so the count describes the current turn only.
 *
 * Both classifications parse the record rather than matching substrings. A
 * substring test is wrong in both directions here, and both directions were
 * observed on a real transcript: a tool result that printed `"kind":"human"`
 * while inspecting transcripts ended the scan early and undercounted depth by
 * nearly half, which lets the chain run past its limit; and any record quoting
 * the block reason, including this repository's own documentation being read
 * back, would otherwise count as a block that never happened.
 *
 * @param transcriptLines - transcript JSONL lines, oldest first
 *
 * @returns forced continuations since the last human turn
 *
 * @example
 * ```ts
 * continuationDepth(['{"type":"user","origin":{"kind":"human"}}']); // 0
 * ```
 */
function continuationDepth(transcriptLines: readonly string[],): number {
  /**
   * Running count of this hook's own feedback records seen so far.
   */
  let depth = 0;

  for (let index = transcriptLines.length - 1; index >= 0; index--) {
    /**
     * Raw transcript line under inspection.
     */
    const line = transcriptLines[index] ?? '';

    // Cheap pre-filter: only lines mentioning either marker can change the outcome,
    // so the scan parses a handful of records rather than the whole tail.
    if ((line === '')
      || ((!line.includes(CONTINUATION_MARKER,))
        && (!line.includes('"kind":"human"',)))) {
      continue;
    }

    /**
     * Parsed record for a line that might be a block or a human turn.
     */
    const record = parseRecord(line,);

    if (record === UNPARSABLE) {
      continue;
    }
    if (isForcedContinuationRecord(record,)) {
      depth += 1;
      continue;
    }
    // A human turn closes the window; anything before it belongs to an earlier turn.
    if (isHumanTurnRecord(record,)) {
      return depth;
    }
  }
  return depth;
}

/**
 * Reads the tail of a transcript and reports the current continuation depth.
 *
 * Failure to read is treated as depth zero rather than propagated: a hook that
 * throws produces no stdout, which Claude Code reads as permission to stop, and
 * silently disabling the response-quality detectors would be worse than
 * over-counting by one turn.
 *
 * @param transcriptPath - filesystem path from the `Stop` event
 *
 * @returns forced continuations since the last human turn, or `0` when unreadable
 *
 * @example
 * ```ts
 * await continuationDepthAt('/home/user/.claude/projects/x/y.jsonl');
 * ```
 */
async function continuationDepthAt(transcriptPath: string,): Promise<number> {
  try {
    /**
     * Open transcript handle, closed by scope exit even when reading throws.
     */
    await using handle = await open(
      transcriptPath,
      'r',
    );
    /**
     * Byte length of the transcript, used to read only its tail.
     */
    const { size, } = await handle.stat();
    /**
     * Offset of the first byte read; clamped so small transcripts read whole.
     */
    const start = Math.max(
      0,
      size - TAIL_BYTES,
    );
    /**
     * Destination for the tail bytes.
     */
    const buffer = Buffer.alloc(size
      - start,);

    await handle.read(
      buffer,
      0,
      buffer.length,
      start,
    );
    return continuationDepth(buffer.toString('utf8',)
      .split('\n',),);
  }
  catch (error) {
    // stderr is safe here: stdout carries the hook protocol and must stay clean.
    process.stderr
      .write(`stop-reminder: continuation depth unavailable, treating as 0: ${String(error,)}\n`,);
    return 0;
  }
}

export {
  CONTINUATION_MARKER,
  FEEDBACK_PREFIX,
  continuationDepth,
  continuationDepthAt,
  DEFAULT_MAX_DEPTH,
  MAX_DEPTH_ENV,
  maxContinuationDepth,
};
