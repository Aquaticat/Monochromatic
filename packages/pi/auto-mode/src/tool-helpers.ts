/**
 * Tool call event helpers.
 *
 * Extracted from signals.ts to stay within the line limit.
 * Contains extractToolText, getFilePath, describeAction,
 * and isRelevantTool.
 *
 * @module
 */

import {
  isToolCallEventType,
  type ToolCallEvent,
} from "@earendil-works/pi-coding-agent";
import { RELEVANT_TOOLS, } from "./constants.ts";

/**
 * Extract text content from a tool call event.
 *
 * @param event - the tool call event
 *
 * @returns the text content from write/edit tools, or `undefined`
 *
 * @example
 * ```typescript
 * extractToolText(writeEvent); // "file contents"
 * ```
 */
function extractToolText(
  event: ToolCallEvent,
): string | undefined {
  if (isToolCallEventType(
    "write",
    event,
  )) {
    return event.input.content;
  }
  if (isToolCallEventType(
    "edit",
    event,
  )) {
    return event.input.edits.map(
      function extractNewText(e) { return e.newText; },
    ).join("\n");
  }
  return undefined;
}

/**
 * Extract the file path from a tool call event.
 *
 * @param event - the tool call event
 *
 * @returns the file path, or `undefined` if not a file-targeting tool
 *
 * @example
 * ```typescript
 * getFilePath(readEvent); // "/project/src/index.ts"
 * ```
 */
function getFilePath(
  event: ToolCallEvent,
): string | undefined {
  if (isToolCallEventType(
    "read",
    event,
  )) {
    return event.input.path;
  }
  if (isToolCallEventType(
    "write",
    event,
  )) {
    return event.input.path;
  }
  if (isToolCallEventType(
    "edit",
    event,
  )) {
    return event.input.path;
  }
  if (isToolCallEventType(
    "grep",
    event,
  )) {
    return event.input.path;
  }
  return undefined;
}

/**
 * Describe the tool action for the judge.
 *
 * No signal/reason annotations — the judge forms its own assessment.
 *
 * @param event - the tool call event
 *
 * @returns a human-readable description of the action
 *
 * @example
 * ```typescript
 * describeAction(bashEvent); // "bash: sudo rm -rf /"
 * ```
 */
function describeAction(
  event: ToolCallEvent,
): string {
  if (isToolCallEventType(
    "bash",
    event,
  )) {
    return `bash: ${event.input.command}`;
  }
  if (isToolCallEventType(
    "read",
    event,
  )) {
    return `read ${event.input.path}`;
  }
  if (isToolCallEventType(
    "write",
    event,
  )) {
    return `write ${event.input.path}`;
  }
  if (isToolCallEventType(
    "edit",
    event,
  )) {
    return `edit ${event.input.path}`;
  }
  if (isToolCallEventType(
    "grep",
    event,
  )) {
    return `grep ${event.input.path ?? ""}`;
  }
  if (isToolCallEventType(
    "find",
    event,
  )) {
    return `find ${event.input.path ?? ""}`;
  }
  if (isToolCallEventType(
    "ls",
    event,
  )) {
    return `ls ${event.input.path ?? ""}`;
  }
  return event.toolName;
}

/**
 * Check if a tool could be used for circumvention.
 *
 * Checked after a denial — all relevant tools are re-flagged
 * to detect circumvention attempts across turn boundaries.
 *
 * @param event - the tool call event
 *
 * @returns `true` if the tool is relevant for circumvention detection
 *
 * @example
 * ```typescript
 * isRelevantTool(bashEvent); // true
 * isRelevantTool(mcpEvent); // false
 * ```
 */
function isRelevantTool(
  event: ToolCallEvent,
): boolean {
  return RELEVANT_TOOLS.includes(event.toolName);
}

export {
  describeAction,
  extractToolText,
  getFilePath,
  isRelevantTool,
};
