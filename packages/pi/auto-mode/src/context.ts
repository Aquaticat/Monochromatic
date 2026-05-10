/**
 * Session context builder for the judge prompt.
 *
 * Walks the session branch from the last user message,
 * building a structured summary that the judge can use
 * to understand recent activity and detect circumvention.
 *
 * @module
 */

import type {
  ExtensionContext,
  SessionMessageEntry,
} from "@earendil-works/pi-coding-agent";
import type {
  ImageContent,
  TextContent,
} from "@earendil-works/pi-ai";
import {
  BASH_DETAIL_LEN,
  MAX_CONTEXT_TOOLS,
  USER_MSG_HEAD,
  USER_MSG_MAX,
  USER_MSG_TAIL,
} from "./system-prompt.ts";
import {
  isCustomEntry,
  type VerdictData,
  TRUST_ENTRY_TYPE,
  VERDICT_ENTRY_TYPE,
} from "./types.ts";

/**
 * Get active trust directives from the session.
 *
 * A `null` data value acts as a reset sentinel (clears all prior directives).
 *
 * @param ctx - extension context with session access
 *
 * @returns array of active trust directive strings
 *
 * @example
 * ```typescript
 * const directives = getTrustDirectives(ctx);
 * ```
 */
function getTrustDirectives(
  ctx: ExtensionContext,
): string[] {
  const directives: string[] = [];
  for (const entry of ctx.sessionManager.getBranch()) {
    if (isCustomEntry<string | null>(
      entry,
      TRUST_ENTRY_TYPE
    )) {
      if (entry.data === null) {
        directives.length = 0;
      }
      else {
        directives.push(entry.data);
      }
    }
  }
  return directives;
}

/**
 * Build a context summary for the LLM judge.
 *
 * Scoped from the last user message, capped at recent tools.
 * Includes verdict outcomes for denied/asked actions so the
 * judge can detect circumvention.
 *
 * @param ctx - extension context with session access
 *
 * @returns formatted context summary string
 *
 * @example
 * ```typescript
 * const context = buildContext(ctx);
 * ```
 */
function buildContext(
  ctx: ExtensionContext,
): string {
  const branch = ctx.sessionManager.getBranch();

  let userIdx = -1;
  for (let i = branch.length - 1; i >= 0; i--) {
    const item = branch[i];
    if (item === undefined) continue;
    if (
      item.type === "message" &&
      (item as SessionMessageEntry).message.role === "user"
    ) {
      userIdx = i;
      break;
    }
  }

  let userLine = "";
  const toolLines: string[] = [];
  const pendingCalls: {
    name: string;
    summary: string
  }[] = [];
  let pendingVerdict: VerdictData | null = null;

  const TWENTY = 20;
  const start = userIdx >= 0
    ? userIdx
    : Math.max(
      0,
      branch.length - TWENTY
    );

  for (let i = start; i < branch.length; i++) {
    const entry = branch[i];
    if (entry === undefined) continue;

    if (isCustomEntry<VerdictData>(
      entry,
      VERDICT_ENTRY_TYPE
    )) {
      pendingVerdict = entry.data;
      continue;
    }

    if (entry.type !== "message") continue;
    const msg = (entry as SessionMessageEntry).message;

    if (msg.role === "user") {
      const text = extractUserText(msg.content);
      userLine = `[user] ${abbreviate(text)}`;
      continue;
    }

    if (msg.role === "assistant") {
      for (const block of msg.content) {
        if (block.type === "toolCall") {
          const tc = block as {
            name: string;
            arguments: Record<string, unknown>
          };
          pendingCalls.push({
            name: tc.name,
            summary: summarizeToolCall(
              tc.name,
              tc.arguments
            ),
          });
        }
      }
      continue;
    }

    if (msg.role === "toolResult") {
      const call = pendingCalls.shift();
      const callStr = call?.summary ?? msg.toolName;

      if (pendingVerdict !== null && pendingVerdict.verdict !== "approve") {
        toolLines.push(
          `[tool] ${callStr} → ${pendingVerdict.verdict} (${pendingVerdict.reason})`,
        );
      }
      else {
        const outcome = msg.isError ? "error" : "ok";
        const detail = msg.toolName === "bash"
          ? bashDetail(msg.content)
          : "";
        toolLines.push(`[tool] ${callStr} → ${outcome}${detail}`);
      }
      pendingVerdict = null;
    }
  }

  const lines: string[] = [];
  if (userLine !== "") lines.push(userLine);
  if (toolLines.length > MAX_CONTEXT_TOOLS) {
    const omitted = toolLines.length - MAX_CONTEXT_TOOLS;
    lines.push(`[${omitted} previous tool calls omitted]`);
    lines.push(...toolLines.slice(-MAX_CONTEXT_TOOLS));
  }
  else {
    lines.push(...toolLines);
  }

  return lines.join("\n");
}

//region Internal helpers

/**
 * Extract text from user message content.
 *
 * @param content - the message content (string or array)
 *
 * @returns concatenated text content
 */
function extractUserText(
  content: string | (TextContent | ImageContent)[],
): string {
  if (typeof content === "string") return content;
  return content
    .filter(
      function isText(c): c is TextContent { return c.type === "text"; },
    )
    .map(
      function getText(c) { return c.text; },
    )
    .join(" ");
}

/**
 * Abbreviate a text string to the configured maximum length.
 *
 * @param text - the text to abbreviate
 *
 * @returns the abbreviated text
 */
function abbreviate(
  text: string,
): string {
  if (text.length <= USER_MSG_MAX) return text;
  return `${text.slice(
    0,
    USER_MSG_HEAD
  )}…${text.slice(-USER_MSG_TAIL)}`;
}

/**
 * Summarize a tool call for the judge context.
 *
 * @param name - the tool name
 *
 * @param args - the tool call arguments
 *
 * @returns a one-line summary string
 */
function summarizeToolCall(
  name: string,
  args: Record<string, unknown>,
): string {
  /* oxlint-disable typescript/no-unsafe-type-assertion -- untyped tool call arguments */
  if (name === "bash") {
    return `bash: ${(args.command as string | undefined) ?? ""}`;
  }
  if ([
    "read",
    "write",
    "edit",
    "grep",
    "find",
    "ls"
  ].includes(name)) {
    return `${name} ${(args.path as string | undefined) ?? ""}`;
  }
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  return name;
}

/**
 * Extract a brief detail from bash tool result content.
 *
 * @param content - the tool result content blocks
 *
 * @returns a detail suffix, or empty string
 */
function bashDetail(
  content: {
    type: string;
    text?: string
  }[],
): string {
  const text = content
    .filter(
      function hasText(c) { return c.type === "text"; },
    )
    .map(
      function getText(c) { return c.text ?? ""; },
    )
    .join("");
  const lastLine = text.trim().split("\n").pop()?.trim() ?? "";
  if (lastLine === "") return "";
  const trimmed = lastLine.length > BASH_DETAIL_LEN
    ? lastLine.slice(-BASH_DETAIL_LEN)
    : lastLine;
  return ` | ${trimmed}`;
}

//endregion

export {
  buildContext,
  getTrustDirectives,
};
