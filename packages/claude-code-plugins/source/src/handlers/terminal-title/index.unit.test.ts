/**
 * Tests for Claude Code terminal title handler helpers.
 */

import type { HookInput, } from '@monochromatic-dev/claude-code-plugins-hook-types/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';
import {
  MAX_TERMINAL_TITLE_UTF8_BYTES,
  terminalTitleUtf8ByteLength,
} from '@monochromatic-dev/module-terminal-title/ts';
import { terminalTitleForEvent, } from './index.ts';

/**
 * Shared event fields required by every Claude Code hook payload.
 */
const BASE_HOOK_INPUT = {
  session_id: 'session-1',
  transcript_path: '/tmp/transcript.jsonl',
  cwd: '/tmp',
  permission_mode: 'default',
} as const;

/**
 * Builds a typed user-prompt hook input for title tests.
 *
 * @param prompt - because prompt payload is the display text under test
 *
 * @returns complete Claude Code hook input
 *
 * @example
 * ```ts
 * userPromptSubmitEvent('Fix auth');
 * ```
 */
function userPromptSubmitEvent(prompt: string,): HookInput {
  return {
    ...BASE_HOOK_INPUT,
    hook_event_name: 'UserPromptSubmit',
    prompt,
  };
}

await describe({
  name: terminalTitleForEvent.name,
  children: [
    it({
      name: 'keeps existing short title behavior',
      fn: async () => {
        expect(terminalTitleForEvent(userPromptSubmitEvent('Refactor auth',),),)
          .toBe('✳ Refactor auth',);
      },
    },),
    it({
      name: 'byte-caps emitted prompt titles',
      fn: async () => {
        const title = terminalTitleForEvent(
          userPromptSubmitEvent('😀'.repeat(MAX_TERMINAL_TITLE_UTF8_BYTES,),),
        );
        expect(title.startsWith('✳ ',),).toBe(true,);
        expect(terminalTitleUtf8ByteLength(title,),)
          .toBeLessThan(MAX_TERMINAL_TITLE_UTF8_BYTES + 1,);
      },
    },),
  ],
},);
