/**
 * Claude Code multi-event hook for the claude-spawn plugin.
 *
 * Dispatches across SessionStart, Stop, SessionEnd, PreToolUse, PostToolUse,
 * and PostToolUseFailure. SessionStart writes PID-to-session mapping, claims
 * spawn ownership, and auto-symlinks the spawn-claude CLI. Stop updates child
 * `lastMessage` (child sessions) or consumes completed children by blocking
 * with reason text (parent sessions). All other consuming events deliver
 * completed-child results via `additionalContext`.
 *
 * @module
 */

import type {
  HookInput,
  HookOutputBase,
} from '@monochromatic-dev/claude-code-plugins-hook-types';
import {
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, } from 'node:path';

import { handleSessionStart, } from './hook-session-start.ts';
import { checkCompletedChildren, } from './inject.ts';
import {
  SPAWNS_DIR,
  type SpawnState,
} from './paths.ts';

/**
 * Captured at module load. After tsdown bundles the source package into the
 * per-plugin entry, this resolves to `${pluginRoot}/dist/final/node/`, which
 * `handleSessionStart` walks up three levels to recover the plugin root.
 */
const HOOK_DIR = import.meta.dir;

/**
 * Discriminated output union preserving the legacy wire convention:
 * SessionStart can emit a non-JSON warning string while every other branch
 * emits a JSON payload. The writer renders each variant verbatim.
 */
type ClaudeSpawnOutput =
  | { kind: 'raw'; text: string; }
  | { kind: 'json'; payload: unknown; };

/**
 * Updates a child's spawn state file when the Stop event reports a final
 * assistant message. No-op if `CLAUDE_SPAWN_ID` is unset, the message is
 * absent, the file is missing, or this session does not own the spawn record.
 *
 * @param sessionId - Claude Code session identifier of the child session
 *
 * @param lastMessage - text of the child's last assistant message
 */
function updateChildOnStop(
  { sessionId, lastMessage, }: { sessionId: string; lastMessage: string | undefined; },
): void {
  const spawnId = process.env.CLAUDE_SPAWN_ID;
  if (spawnId === undefined || lastMessage === undefined)
    return;

  const filePath = join(SPAWNS_DIR, `${spawnId}.json`,);

  try {
    const existing = readFileSync(filePath, 'utf8',);
    /* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted file written by our own CLI */
    const state = JSON.parse(existing,) as SpawnState;

    if (state.sessionId === sessionId) {
      const updated: SpawnState = {
        ...state,
        lastMessage,
        status: 'stopped',
      };
      writeFileSync(filePath, JSON.stringify(updated,),);
    }
  }
  catch {
    /** File missing (already `.reported`) or unreadable -- skip. */
  }
}

/**
 * Builds the appropriate hook response for a Stop event after any child-side
 * file update has been performed.
 *
 * - On parent sessions with completed children and no in-flight stop hook,
 *   returns a `block` decision carrying the formatted child-result text.
 * - Otherwise returns an empty pass-through.
 *
 * @param event - parsed Stop hook event payload
 */
function stopResponse(
  event: Extract<HookInput, { hook_event_name: 'Stop'; }>,
): ClaudeSpawnOutput {
  if (!event.stop_hook_active) {
    const context = checkCompletedChildren({
      parentSessionId: event.session_id,
      consume: true,
    },);
    if (context !== null)
      return { kind: 'json', payload: { decision: 'block', reason: context, }, };
  }
  const empty: HookOutputBase = {};
  return { kind: 'json', payload: empty, };
}

/**
 * Builds the additionalContext-bearing response for non-Stop, non-Session*
 * delivery hooks (PreToolUse, PostToolUse, PostToolUseFailure, etc.).
 *
 * @param event - any hook event other than SessionStart, Stop, SessionEnd
 */
function additionalContextResponse(event: HookInput,): ClaudeSpawnOutput {
  const context = checkCompletedChildren({
    parentSessionId: event.session_id,
    consume: true,
  },);
  if (context === null) {
    const empty: HookOutputBase = {};
    return { kind: 'json', payload: empty, };
  }
  return {
    kind: 'json',
    payload: {
      hookSpecificOutput: {
        hookEventName: event.hook_event_name,
        additionalContext: context,
      },
    },
  };
}

/**
 * Dispatches on `hook_event_name` to one of four behaviors:
 * SessionStart (raw text response), Stop (child update plus parent
 * consume), SessionEnd (no-op), or a default consuming additionalContext
 * delivery.
 *
 * @param event - parsed hook event from Claude Code
 */
function claudeSpawnHandler(event: HookInput,): ClaudeSpawnOutput {
  if (event.hook_event_name === 'SessionStart') {
    const text = handleSessionStart({
      sessionId: event.session_id,
      transcriptPath: event.transcript_path,
      hookDir: HOOK_DIR,
    },);
    return { kind: 'raw', text, };
  }
  if (event.hook_event_name === 'Stop') {
    updateChildOnStop({
      sessionId: event.session_id,
      lastMessage: event.last_assistant_message,
    },);
    return stopResponse(event,);
  }
  if (event.hook_event_name === 'SessionEnd') {
    const empty: HookOutputBase = {};
    return { kind: 'json', payload: empty, };
  }
  return additionalContextResponse(event,);
}

/** Parses raw stdin as a `HookInput` (any union member; narrowed at dispatch). */
/* oxlint-disable-next-line typescript/no-unsafe-type-assertion -- trusted input from Claude Code hook system */
function claudeSpawnParser(raw: string,): HookInput {
  return JSON.parse(raw,) as HookInput;
}

/**
 * Renders the discriminated output to stdout. Raw variants are written
 * verbatim; JSON variants are stringified without trailing newline,
 * matching the legacy wire format.
 */
function claudeSpawnWriter(output: ClaudeSpawnOutput,): string {
  if (output.kind === 'raw')
    return output.text;
  return JSON.stringify(output.payload,);
}

export type { ClaudeSpawnOutput, };

export {
  claudeSpawnHandler,
  claudeSpawnParser,
  claudeSpawnWriter,
};
