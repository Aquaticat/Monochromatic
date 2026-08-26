/**
 * Tests for caller-scoped virtual-input guard.
 *
 * Covers direct and wrapped ydotool execution,
 * nested shell programs,
 * non-executing text mentions,
 * durable supervision,
 * and non-Bash tool calls.
 */

import type { ToolCallEvent, } from '@earendil-works/pi-coding-agent';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  CALLER_SCOPED_YDOTOOL_REASON,
  guardVirtualInput,
  hasCallerScopedYdotool,
} from '@monochromatic-dev/pi-plugin-auto-mode';

/** Caller-scoped command fixtures that must be blocked. */
const BLOCKED_COMMANDS = [
  'ydotool key 1:1 1:0',
  '/usr/bin/ydotool key 1:1 1:0',
  'true && ydotool key 1:1 1:0',
  'env YDOTOOL_SOCKET=/tmp/socket ydotool key 1:1 1:0',
  'command /usr/bin/ydotool key 1:1 1:0',
  'systemd-run --user --collect /usr/bin/ydotool key 1:1 1:0',
  'bash -c "ydotool key 1:1 1:0"',
  "sh -lc 'ydotool key 1:1 1:0'",
] as const;

/** Commands that inspect text or delegate execution to durable supervisor. */
const ALLOWED_COMMANDS = [
  "rg --fixed-strings 'ydotool' AGENTS.md",
  "printf '%s\\n' ydotool",
] as const;

/**
 * Build minimal Pi Bash tool event for guard tests.
 *
 * @param command - Bash source under test.
 *
 * @returns Tool-call event accepted by virtual-input guard.
 *
 * @example
 * ```typescript
 * bashEvent('ydotool key 1:1 1:0');
 * ```
 */
function bashEvent(command: string,): ToolCallEvent {
  return {
    type: 'tool_call',
    toolName: 'bash',
    toolCallId: 'virtual-input-guard-test',
    input: { command, },
  };
}

await describe({
  name: '',
  children: [
    describe({
      name: hasCallerScopedYdotool.name,
      children: [
        ...BLOCKED_COMMANDS.map(function blockedCommand(command,) {
          return it({
            name: `detects caller-scoped invocation in ${command}`,
            fn: async () => {
              expect(hasCallerScopedYdotool(command,),).toBe(true,);
            },
          },);
        },),
        ...ALLOWED_COMMANDS.map(function allowedCommand(command,) {
          return it({
            name: `allows non-caller-scoped command ${command}`,
            fn: async () => {
              expect(hasCallerScopedYdotool(command,),).toBe(false,);
            },
          },);
        },),
      ],
    },),
    describe({
      name: guardVirtualInput.name,
      children: [
        it({
          name: 'returns fixed hard-block reason for Bash invocation',
          fn: async () => {
            expect(guardVirtualInput(bashEvent('ydotool key 1:1 1:0',),),).toEqual({
              block: true,
              reason: CALLER_SCOPED_YDOTOOL_REASON,
            },);
          },
        },),
        it({
          name: 'allows Bash text inspection',
          fn: async () => {
            expect(guardVirtualInput(bashEvent("rg 'ydotool' .",),),).toEqual({ block: false, },);
          },
        },),
        it({
          name: 'allows non-Bash tool call',
          fn: async () => {
            expect(guardVirtualInput({
              type: 'tool_call',
              toolName: 'read',
              toolCallId: 'read-ydotool-doc',
              input: { path: '/tmp/ydotool.md', },
            },),).toEqual({ block: false, },);
          },
        },),
      ],
    },),
  ],
},);
