/**
 * Tests for title builder.
 *
 * Covers titleForTool and titleForEvent across all tool types and event types.
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test';
import {
  MAX_TITLE_LENGTH,
  TITLE_PREFIX,
  titleForEvent,
  titleForTool,
} from './title-builder.ts';

await describe({
  name: '',
  children: [
    //region titleForTool

    describe({
      name: titleForTool.name,
      children: [
        //region bash

        describe({
          name: 'bash',
          children: [
            it({
              name: 'pre: extracts and shortens command',
              fn: async () => {
                expect(
                  titleForTool('bash', { command: 'npm test', }, 'pre',),
                )
                  .toBe('npm test',);
              },
            },),
            it({
              name: 'pre: strips env noise from command',
              fn: async () => {
                expect(
                  titleForTool('bash', { command: 'timeout 10 npm test', }, 'pre',),
                )
                  .toBe('npm test',);
              },
            },),
            it({
              name: 'post: same shortening for past tense',
              fn: async () => {
                expect(
                  titleForTool('bash', { command: 'npm test', }, 'post',),
                )
                  .toBe('npm test',);
              },
            },),
            it({
              name: 'pre: falls back when command missing',
              fn: async () => {
                expect(
                  titleForTool('bash', {}, 'pre',),
                )
                  .toBe('Running command',);
              },
            },),
            it({
              name: 'post: falls back when command missing',
              fn: async () => {
                expect(
                  titleForTool('bash', {}, 'post',),
                )
                  .toBe('Ran command',);
              },
            },),
          ],
        },),

        //endregion bash

        //region read

        describe({
          name: 'read',
          children: [
            it({
              name: 'pre: shows Reading with filename',
              fn: async () => {
                expect(
                  titleForTool('read', { path: '/home/user/index.ts', }, 'pre',),
                )
                  .toBe('Reading index.ts',);
              },
            },),
            it({
              name: 'post: shows Read with filename',
              fn: async () => {
                expect(
                  titleForTool('read', { path: '/app/config.json', }, 'post',),
                )
                  .toBe('Read config.json',);
              },
            },),
            it({
              name: 'pre: falls back when path missing',
              fn: async () => {
                expect(
                  titleForTool('read', {}, 'pre',),
                )
                  .toBe('Reading file',);
              },
            },),
          ],
        },),

        //endregion read

        //region edit

        describe({
          name: 'edit',
          children: [
            it({
              name: 'pre: shows Editing with filename',
              fn: async () => {
                expect(
                  titleForTool('edit', { path: '/src/main.ts', }, 'pre',),
                )
                  .toBe('Editing main.ts',);
              },
            },),
            it({
              name: 'post: shows Edited with filename',
              fn: async () => {
                expect(
                  titleForTool('edit', { path: '/src/main.ts', }, 'post',),
                )
                  .toBe('Edited main.ts',);
              },
            },),
          ],
        },),

        //endregion edit

        //region write

        describe({
          name: 'write',
          children: [
            it({
              name: 'pre: shows Writing with filename',
              fn: async () => {
                expect(
                  titleForTool('write', { path: '/out/result.ts', }, 'pre',),
                )
                  .toBe('Writing result.ts',);
              },
            },),
            it({
              name: 'post: shows Wrote with filename',
              fn: async () => {
                expect(
                  titleForTool('write', { path: '/out/result.ts', }, 'post',),
                )
                  .toBe('Wrote result.ts',);
              },
            },),
          ],
        },),

        //endregion write

        //region grep

        describe({
          name: 'grep',
          children: [
            it({
              name: 'pre: shows Searching with quoted pattern',
              fn: async () => {
                expect(
                  titleForTool('grep', { pattern: 'TODO', }, 'pre',),
                )
                  .toBe('Searching "TODO"',);
              },
            },),
            it({
              name: 'post: shows Searched with quoted pattern',
              fn: async () => {
                expect(
                  titleForTool('grep', { pattern: 'FIXME', }, 'post',),
                )
                  .toBe('Searched "FIXME"',);
              },
            },),
            it({
              name: 'pre: falls back when pattern missing',
              fn: async () => {
                expect(
                  titleForTool('grep', {}, 'pre',),
                )
                  .toBe('Searching',);
              },
            },),
          ],
        },),

        //endregion grep

        //region find

        describe({
          name: 'find',
          children: [
            it({
              name: 'pre: shows Finding with quoted pattern',
              fn: async () => {
                expect(
                  titleForTool('find', { pattern: '*.ts', }, 'pre',),
                )
                  .toBe('Finding "*.ts"',);
              },
            },),
            it({
              name: 'post: shows Found with quoted pattern',
              fn: async () => {
                expect(
                  titleForTool('find', { pattern: '*.json', }, 'post',),
                )
                  .toBe('Found "*.json"',);
              },
            },),
          ],
        },),

        //endregion find

        //region ls

        describe({
          name: 'ls',
          children: [
            it({
              name: 'pre: shows Listing with dirname',
              fn: async () => {
                expect(
                  titleForTool('ls', { path: '/home/user/src', }, 'pre',),
                )
                  .toBe('Listing src',);
              },
            },),
            it({
              name: 'post: shows Listed with dirname',
              fn: async () => {
                expect(
                  titleForTool('ls', { path: '/home/user/src', }, 'post',),
                )
                  .toBe('Listed src',);
              },
            },),
          ],
        },),

        //endregion ls

        //region custom/MCP tools

        describe({
          name: 'custom/MCP tools',
          children: [
            it({
              name: 'pre: shows Running with tool name',
              fn: async () => {
                expect(
                  titleForTool('mcp__weather', { city: 'Tokyo', }, 'pre',),
                )
                  .toBe('Running mcp__weather',);
              },
            },),
            it({
              name: 'post: shows Ran with tool name',
              fn: async () => {
                expect(
                  titleForTool('mcp__weather', { city: 'Tokyo', }, 'post',),
                )
                  .toBe('Ran mcp__weather',);
              },
            },),
          ],
        },),
        //endregion custom/MCP tools
      ],
    },),

    //endregion titleForTool

    //region titleForEvent

    describe({
      name: titleForEvent.name,
      children: [
        it({
          name: 'tool_execution_start: prefixes title with ✳',
          fn: async () => {
            const result = titleForEvent(
              'tool_execution_start',
              {
                toolName: 'bash',
                args: { command: 'npm test', },
              },
            );
            expect(result,).toBe('✳ npm test',);
          },
        },),
        it({
          name: 'tool_execution_end: prefixes with ✳ and past tense',
          fn: async () => {
            const result = titleForEvent(
              'tool_execution_end',
              {
                toolName: 'read',
                args: { path: '/home/user/index.ts', },
              },
            );
            expect(result,).toBe('✳ Read index.ts',);
          },
        },),
        it({
          name: 'session_start: shows reason',
          fn: async () => {
            expect(
              titleForEvent('session_start', { reason: 'startup', },),
            )
              .toBe('✳ Session startup',);
          },
        },),
        it({
          name: 'session_start: defaults to "started" when no reason',
          fn: async () => {
            expect(
              titleForEvent('session_start', {},),
            )
              .toBe('✳ Session started',);
          },
        },),
        it({
          name: 'session_shutdown: shows Session ended',
          fn: async () => {
            expect(
              titleForEvent('session_shutdown', {},),
            )
              .toBe('✳ Session ended',);
          },
        },),
        it({
          name: 'agent_end: shows Stopped',
          fn: async () => {
            expect(
              titleForEvent('agent_end', {},),
            )
              .toBe('✳ Stopped',);
          },
        },),
        it({
          name: 'before_agent_start: shows user prompt',
          fn: async () => {
            expect(
              titleForEvent('before_agent_start', { prompt: 'Refactor auth', },),
            )
              .toBe('✳ Refactor auth',);
          },
        },),
        it({
          name: 'before_agent_start: truncates long prompts',
          fn: async () => {
            const longPrompt = 'a'.repeat(200,);
            const result = titleForEvent(
              'before_agent_start',
              { prompt: longPrompt, },
            );
            expect(result.length <= MAX_TITLE_LENGTH,).toBe(true,);
            expect(result.startsWith(TITLE_PREFIX,),).toBe(true,);
          },
        },),
        it({
          name: 'all titles respect MAX_TITLE_LENGTH',
          fn: async () => {
            const longCommand = 'a'.repeat(200,);
            const result = titleForEvent(
              'tool_execution_start',
              {
                toolName: 'bash',
                args: { command: longCommand, },
              },
            );
            expect(result.length <= MAX_TITLE_LENGTH,).toBe(true,);
          },
        },),
        it({
          name: 'tool_execution_start with unknown tool falls back gracefully',
          fn: async () => {
            const result = titleForEvent(
              'tool_execution_start',
              { toolName: 'custom_tool', },
            );
            expect(result,).toBe('✳ Running custom_tool',);
          },
        },),
      ],
    },),
    //endregion titleForEvent
  ],
},);
