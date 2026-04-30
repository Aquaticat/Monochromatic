/**
 * Morph Compact pi extension entry point.
 *
 * Replaces pi's default LLM summarization with Morph's line-deletion compression.
 * Calls the Morph Compact API via the official SDK, wrapping output with
 * explanatory headers so the LLM understands the verbatim-transcript format.
 *
 * Falls through to pi's default summarization on any error (missing key, API
 * failure, split-turn compaction, etc.).
 *
 * When the session is too small to compact (all messages fit within
 * pi's keepRecentTokens budget), cancels the compaction instead of
 * falling through to pi's default summarizer, which produces empty
 * "(none)" summaries in this case.
 */

import type {
  CompactionResult,
  ExtensionAPI,
  ExtensionCommandContext,
  SessionBeforeCompactEvent,
} from '@mariozechner/pi-coding-agent';
import { launchTerminal, } from '@monochromatic-dev/cli-terminal-exec';
import {
  resetApiKeyCache,
  resolveMorphApiKey,
} from './api-key.ts';
import { attemptMorphCompaction, } from './compaction.ts';
import { compressBranch, } from './compress-branch.ts';
import type { MorphCompactionDetails, } from './types.ts';

//region Session state

/** One-time warning per session when Morph API key is missing. */
let warnedMissingKey = false;

//endregion

//region Event handlers

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
async function handleBeforeCompact(
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
  // Resolve API key from env var or ~/.pi/agent/mcp.json fallback
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

  // Split-turn compactions stay on pi's built-in compactor.
  // Morph is deletion-based, not a summarizer, so it can't produce
  // a coherent turn prefix summary.
  if (event.preparation.isSplitTurn)
    return undefined;

  // Already cancelled — don't start an API call
  if (event.signal.aborted)
    return undefined;

  const {
    messagesToSummarize,
    turnPrefixMessages,
    previousSummary,
  } = event.preparation;

  // When there are no messages to summarize and no previous summary
  // to re-compress, the session is too small to compact. Cancel
  // instead of falling through — pi's default summarizer produces
  // empty "(none)" summaries when given no messages, polluting the
  // session with useless compaction entries.
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

    // Notify success
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

/**
 * Handle the `/morph-compact` command.
 * Compresses the session context read-only via the Morph Compact API
 * and launches a new terminal running pi with the compressed context
 * as a positional message argument. The main session is never modified.
 *
 * @param args - optional custom instructions for compression focus
 *
 * @param ctx - extension command context with session access and UI
 */
async function handleMorphCompactCommand(
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  const apiKey = await resolveMorphApiKey();
  if (apiKey === undefined) {
    ctx.ui.notify(
      'MORPH_API_KEY not set (env or ~/.pi/agent/mcp.json) — cannot compress',
      'warning',
    );
    return;
  }

  const branchEntries = ctx.sessionManager.getBranch();
  const contextUsage = ctx.getContextUsage();
  const instructions = args.trim();
  const customInstructions = instructions !== ''
    ? instructions
    : undefined;

  ctx.ui.notify(
    'Morph Compact: compressing session...',
    'info',
  );

  try {
    const compressedText = await compressBranch({
      branchEntries,
      contextUsage,
      apiKey,
      customInstructions,
    },);

    await launchTerminal({
      dir: ctx.cwd,
      command: [
        'pi',
        compressedText,
      ],
    },);

    ctx.ui.notify(
      'Morph Compact: launched new session in a separate terminal',
      'info',
    );
  }
  catch (error) {
    const message = error instanceof Error
      ? error.message
      : String(error,);
    ctx.ui.notify(
      `Morph Compact failed: ${message}`,
      'error',
    );
  }
}

/**
 * Handle the `session_start` event.
 * Resets per-session state.
 */
function handleSessionStart(): void {
  warnedMissingKey = false;
  resetApiKeyCache();
}

//endregion

//region Extension entry point

/**
 * Morph Compact pi extension entry point.
 * Replaces pi's default LLM summarization with Morph's line-deletion compression.
 *
 * @example
 * ```typescript
 * // Auto-discovered from ~/.pi/agent/extensions/morph-compact/index.ts
 * // or loaded via pi install / pi -e
 * // Requires MORPH_API_KEY env var or entry in ~/.pi/agent/mcp.json
 * ```
 *
 * @param pi - the pi extension API
 */
export default function morphCompact(
  pi: ExtensionAPI,
): void {
  pi.on(
    'session_before_compact',
    handleBeforeCompact,
  );

  pi.registerCommand(
    'morph-compact',
    {
      description: 'Compress session context and launch a new pi terminal with it',
      handler: handleMorphCompactCommand,
    },
  );

  pi.on(
    'session_start',
    handleSessionStart,
  );
}

//endregion
