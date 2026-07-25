/**
 * Repository-owned tool event discriminant guards.
 *
 * Pi implements its exported `isToolCallEventType` helper as these same direct
 * comparisons. Local guards let effect analysis inspect their behavior instead
 * of stopping at package declarations that have no TypeScript body.
 *
 * @module
 */

import type {
  BashToolCallEvent,
  EditToolCallEvent,
  FindToolCallEvent,
  GrepToolCallEvent,
  LsToolCallEvent,
  ReadToolCallEvent,
  ToolCallEvent,
  WriteToolCallEvent,
} from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

/**
 * Test for built-in Bash call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has Bash input shape.
 *
 * @example
 * ```typescript
 * if (isBashToolEvent(event)) event.input.command;
 * ```
 */
export function isBashToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<BashToolCallEvent> {
  return event.toolName === 'bash';
}

/**
 * Test for built-in edit call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has edit input shape.
 *
 * @example
 * ```typescript
 * if (isEditToolEvent(event)) event.input.edits;
 * ```
 */
export function isEditToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<EditToolCallEvent> {
  return event.toolName === 'edit';
}

/**
 * Test for built-in find call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has find input shape.
 *
 * @example
 * ```typescript
 * if (isFindToolEvent(event)) event.input.path;
 * ```
 */
export function isFindToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<FindToolCallEvent> {
  return event.toolName === 'find';
}

/**
 * Test for built-in grep call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has grep input shape.
 *
 * @example
 * ```typescript
 * if (isGrepToolEvent(event)) event.input.path;
 * ```
 */
export function isGrepToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<GrepToolCallEvent> {
  return event.toolName === 'grep';
}

/**
 * Test for built-in directory listing call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has directory listing input shape.
 *
 * @example
 * ```typescript
 * if (isLsToolEvent(event)) event.input.path;
 * ```
 */
export function isLsToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<LsToolCallEvent> {
  return event.toolName === 'ls';
}

/**
 * Test for built-in read call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has read input shape.
 *
 * @example
 * ```typescript
 * if (isReadToolEvent(event)) event.input.path;
 * ```
 */
export function isReadToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<ReadToolCallEvent> {
  return event.toolName === 'read';
}

/**
 * Test for built-in write call.
 *
 * @param event - Tool event to narrow.
 *
 * @returns Whether event has write input shape.
 *
 * @example
 * ```typescript
 * if (isWriteToolEvent(event)) event.input.content;
 * ```
 */
export function isWriteToolEvent(
  event: ForeignBorrowed<ToolCallEvent>,
): event is ForeignBorrowed<WriteToolCallEvent> {
  return event.toolName === 'write';
}
