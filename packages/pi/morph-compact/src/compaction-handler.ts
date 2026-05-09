/**
 * Handler for the `session_before_compact` event.
 *
 * Checks preconditions, attempts Morph compaction, and either
 * returns the compaction result, cancels the compaction, or
 * returns `undefined` to fall through to pi's default summarization.
 *
 * @module
 */

import type {
  CompactionResult,
  SessionBeforeCompactEvent,
} from '@earendil-works/pi-coding-agent';
import { resolveMorphApiKey, } from './api-key.ts';
import { attemptMorphCompaction, } from './compaction.ts';
import type { MorphCompactionDetails, } from './types.ts';

/** One-time warning per session when Morph API key is missing. */
let warnedMissingKey = false;

/**
 * Reset the missing-key warning flag for a new session.
 *
 * @example
 * ```typescript
 * resetMissingKeyWarning();
 * ```
 */
export function resetMissingKeyWarning(): void {
  warnedMissingKey = false;
}

/**
 * Handle the `session_before_compact` event.
 * Checks preconditions, attempts Morph compaction, and either
 * returns the compaction result, cancels the compaction, or
 * returns `undefined` to fall through to pi's default summarization.
 *
 * Compaction is cancelled (not fallen through) when the session is
 * too small to compact — all messages fit within pi's keepRecentTokens
 * budget, leaving messagesToSummarize empty. Pi's default summarizer
 * produces useless empty "(none)" summaries in this case, so we cancel
 * to avoid polluting the session with blank compaction entries.
 *
 * @param event - the session_before_compact event
 *
 * @param ctx - extension context with UI and context usage access
 *
 * @returns compaction result, cancellation, or undefined to fall through
 *
 * @example
 * ```typescript
 * pi.on("session_before_compact", handleBeforeCompact);
 * ```
 */
export async function handleBeforeCompact(
  event: SessionBeforeCompactEvent,
  ctx: {
    getContextUsage(): {
      tokens: number | null;
      contextWindow: number;
    } | undefined;
    ui: {
      notify(
        message: string,
        type?: 'info' | 'warning' | 'error',
      ): void;
    };
  },
): Promise<
  | { compaction: CompactionResult<MorphCompactionDetails>; }
  | { cancel: true; }
  | undefined
> {
  const apiKey = await resolveMorphApiKey();
  if (apiKey === undefined) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      ctx.ui.notify(
        'MORPH_API_KEY not set (env or ~/.pi/agent/mcp.json) — Morph Compact disabled, using pi default compaction',
        'warning',
      );
    }
    return undefined;
  }

  if (event.preparation.isSplitTurn)
    return undefined;

  if (event.signal.aborted)
    return undefined;

  const {
    messagesToSummarize,
    turnPrefixMessages,
    previousSummary,
  } = event.preparation;

  const hasMessages = messagesToSummarize.length > 0
    || turnPrefixMessages.length > 0;
  if (!hasMessages && previousSummary === undefined) {
    ctx.ui.notify(
      'Morph Compact: nothing to compact — session too small',
      'warning',
    );
    return { cancel: true, };
  }

  const msgCount = messagesToSummarize.length
    + turnPrefixMessages.length;
  ctx.ui.notify(
    `Morph Compact: compressing ${msgCount} messages (${event.preparation.tokensBefore.toLocaleString()} tokens)...`,
    'info',
  );

  try {
    const attempt = await attemptMorphCompaction(
      event,
      ctx.getContextUsage(),
      apiKey,
    );

    if (attempt.kind === 'fallback')
      return undefined;

    const { result, } = attempt;

    if (!event.signal.aborted) {
      const morphUsage = result.details?.morphUsage;
      const reductionPct = morphUsage?.compressionRatio !== undefined
          && morphUsage.compressionRatio !== 0
        ? Math.round(
          (1 - morphUsage.compressionRatio) * 100,
        )
        : 0;
      const inTokens = morphUsage?.inputTokens?.toLocaleString() ?? '?';
      const outTokens = morphUsage?.outputTokens?.toLocaleString() ?? '?';
      const ms = morphUsage?.processingTimeMs?.toLocaleString() ?? '?';
      ctx.ui.notify(
        `Morph Compact: ${reductionPct}% reduction (${inTokens} → ${outTokens} tokens) in ${ms}ms`,
        'info',
      );
    }

    return { compaction: result, };
  }
  catch (error) {
    if (event.signal.aborted)
      return undefined;

    const message = error instanceof Error
      ? error.message
      : 'Unknown Morph compaction error';
    ctx.ui.notify(
      `Morph Compact failed: ${message} — falling back to pi default`,
      'error',
    );
    return undefined;
  }
}
