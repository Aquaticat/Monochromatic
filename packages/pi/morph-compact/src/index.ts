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
 *
 * For the `/morph-compact` command, compressed context is passed to the
 * new pi session via a tiered IPC fallback to avoid exceeding the OS
 * argument length limit:
 *
 * 1. Argv (text ≤ 100KB): simplest, zero cleanup
 * 2. Temp file: one write, one read, one delete
 * 3. Unix domain socket: avoids data on disk, fallback for full /tmp
 * 4. TCP localhost: zero filesystem dependency, final fallback
 */

import type {
  ExtensionAPI,
  ExtensionCommandContext,
  ExtensionContext,
  SessionStartEvent,
} from '@earendil-works/pi-coding-agent';
import { launchTerminal, } from '@monochromatic-dev/cli-terminal-exec';
import {
  resetApiKeyCache,
  resolveMorphApiKey,
} from './api-key.ts';
import {
  handleBeforeCompact,
  resetMissingKeyWarning,
} from './compaction-handler.ts';
import { compressBranch, } from './compress-branch.ts';
import {
  handleSessionStartInject,
  launchWithLargeContext,
  MAX_COMPRESSED_ARG_BYTES,
} from './ipc-launch.ts';

//region Session state

/**
 * Module-level reference to the pi extension API.
 *
 * Stored here so the `session_start` handler can call
 * `pi.getFlag()` and `pi.sendUserMessage()` without
 * receiving the API as a parameter.
 */
let extensionApi: ExtensionAPI | null = null;

//endregion

//region Event handlers

/**
 * Handle the `/morph-compact` command.
 * Compresses the session context read-only via the Morph Compact API
 * and launches a new terminal running pi with the compressed context.
 *
 * When the compressed text exceeds {@link MAX_COMPRESSED_ARG_BYTES},
 * falls back through IPC tiers in order: temp file, Unix domain
 * socket, TCP localhost.
 *
 * @param args - optional custom instructions for compression focus
 *
 * @param ctx - extension command context with session access and UI
 */
async function handleMorphCompactCommand(
  args: string,
  ctx: ExtensionCommandContext,
): Promise<void> {
  /** Resolved Morph key gates the command early when missing. */
  const apiKey = await resolveMorphApiKey();
  if (apiKey === undefined) {
    ctx.ui.notify(
      'MORPH_API_KEY not set (env or ~/.pi/agent/mcp.json): cannot compress',
      'warning',
    );
    return;
  }

  /** Read-only branch view fed to the standalone compressor. */
  const branchEntries = ctx.sessionManager.getBranch();
  /** Snapshot of current context pressure used to choose a ratio. */
  const contextUsage = ctx.getContextUsage();
  /** Trimmed command-line instructions; empty string maps to undefined below. */
  const instructions = args.trim();
  /** Optional custom focus forwarded to compressBranch. */
  const customInstructions = instructions !== ''
    ? instructions
    : undefined;

  ctx.ui.notify(
    'Morph Compact: compressing session...',
    'info',
  );

  try {
    /** Compressed branch text routed through the right IPC tier below. */
    const compressedText = await compressBranch({
      branchEntries,
      contextUsage,
      apiKey,
      customInstructions,
    },);

    // Tier 1: argv (simplest path, zero cleanup)
    // oxlint-disable-next-line eslint-plugin-unicorn/prefer-ternary -- branching on async calls is clearer with if/else
    if (compressedText.length <= MAX_COMPRESSED_ARG_BYTES) {
      await launchTerminal({
        dir: ctx.cwd,
        command: [
          'pi',
          compressedText,
        ],
      },);
    }
    else {
      await launchWithLargeContext(
        ctx.cwd,
        compressedText,
      );
    }

    ctx.ui.notify(
      'Morph Compact: launched new session in a separate terminal',
      'info',
    );
  }
  catch (error) {
    /** Best-effort diagnostic surfaced to the user via UI notify. */
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
 *
 * Reads compressed context from whichever IPC channel is active
 * (checked in priority order: file → Unix socket → TCP) and
 * injects it as a user message. Then resets per-session state.
 *
 * @param event - the session_start event
 *
 * @param ctx - extension context
 */
async function handleSessionStart(
  event: SessionStartEvent,
  ctx: ExtensionContext,
): Promise<void> {
  if (extensionApi !== null) {
    await handleSessionStartInject(
      extensionApi,
      event,
      ctx,
    );
  }

  resetMissingKeyWarning();
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
  extensionApi = pi;

  pi.registerFlag(
    'morph-compact-file',
    {
      description: 'Temp file path for receiving compressed context (internal)',
      type: 'string',
    },
  );
  pi.registerFlag(
    'morph-compact-socket',
    {
      description: 'Unix socket path for receiving compressed context (internal)',
      type: 'string',
    },
  );
  pi.registerFlag(
    'morph-compact-tcp',
    {
      description: 'TCP address (host:port) for receiving compressed context (internal)',
      type: 'string',
    },
  );

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
