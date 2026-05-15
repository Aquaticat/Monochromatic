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
                  titleForTool({ toolName: 'bash', args: { command: 'npm test', },
                    tense: 'pre', },),
                )
                  .toBe('npm test',);
              },
            },),
            it({
              name: 'pre: strips env noise from command',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'bash',
                    args: { command: 'timeout 10 npm test', }, tense: 'pre', },),
                )
                  .toBe('npm test',);
              },
            },),
            it({
              name: 'post: same shortening for past tense',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'bash', args: { command: 'npm test', },
                    tense: 'post', },),
                )
                  .toBe('npm test',);
              },
            },),
            it({
              name: 'pre: falls back when command missing',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'bash', args: {}, tense: 'pre', },),
                )
                  .toBe('Running command',);
              },
            },),
            it({
              name: 'post: falls back when command missing',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'bash', args: {}, tense: 'post', },),
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
                  titleForTool({ toolName: 'read', args: { path: '/home/user/index.ts', },
                    tense: 'pre', },),
                )
                  .toBe('Reading index.ts',);
              },
            },),
            it({
              name: 'post: shows Read with filename',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'read', args: { path: '/app/config.json', },
                    tense: 'post', },),
                )
                  .toBe('Read config.json',);
              },
            },),
            it({
              name: 'pre: falls back when path missing',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'read', args: {}, tense: 'pre', },),
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
                  titleForTool({ toolName: 'edit', args: { path: '/src/main.ts', },
                    tense: 'pre', },),
                )
                  .toBe('Editing main.ts',);
              },
            },),
            it({
              name: 'post: shows Edited with filename',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'edit', args: { path: '/src/main.ts', },
                    tense: 'post', },),
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
                  titleForTool({ toolName: 'write', args: { path: '/out/result.ts', },
                    tense: 'pre', },),
                )
                  .toBe('Writing result.ts',);
              },
            },),
            it({
              name: 'post: shows Wrote with filename',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'write', args: { path: '/out/result.ts', },
                    tense: 'post', },),
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
                  titleForTool({ toolName: 'grep', args: { pattern: 'TODO', },
                    tense: 'pre', },),
                )
                  .toBe('Searching "TODO"',);
              },
            },),
            it({
              name: 'post: shows Searched with quoted pattern',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'grep', args: { pattern: 'FIXME', },
                    tense: 'post', },),
                )
                  .toBe('Searched "FIXME"',);
              },
            },),
            it({
              name: 'pre: falls back when pattern missing',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'grep', args: {}, tense: 'pre', },),
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
                  titleForTool({ toolName: 'find', args: { pattern: '*.ts', },
                    tense: 'pre', },),
                )
                  .toBe('Finding "*.ts"',);
              },
            },),
            it({
              name: 'post: shows Found with quoted pattern',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'find', args: { pattern: '*.json', },
                    tense: 'post', },),
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
                  titleForTool({ toolName: 'ls', args: { path: '/home/user/src', },
                    tense: 'pre', },),
                )
                  .toBe('Listing src',);
              },
            },),
            it({
              name: 'post: shows Listed with dirname',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'ls', args: { path: '/home/user/src', },
                    tense: 'post', },),
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
                  titleForTool({ toolName: 'mcp__weather', args: { city: 'Tokyo', },
                    tense: 'pre', },),
                )
                  .toBe('Running mcp__weather',);
              },
            },),
            it({
              name: 'post: shows Ran with tool name',
              fn: async () => {
                expect(
                  titleForTool({ toolName: 'mcp__weather', args: { city: 'Tokyo', },
                    tense: 'post', },),
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
          name: 'tool_execution_start: prefixes title with π',
          fn: async () => {
            const result = titleForEvent({
              eventType: 'tool_execution_start',
              data: {
                toolName: 'bash',
                args: { command: 'npm test', },
              },
            },);
            expect(result,).toBe('π npm test',);
          },
        },),
        it({
          name: 'tool_execution_end: prefixes with π and past tense',
          fn: async () => {
            const result = titleForEvent({
              eventType: 'tool_execution_end',
              data: {
                toolName: 'read',
                args: { path: '/home/user/index.ts', },
              },
            },);
            expect(result,).toBe('π Read index.ts',);
          },
        },),
        it({
          name: 'session_start: shows reason',
          fn: async () => {
            expect(
              titleForEvent({ eventType: 'session_start',
                data: { reason: 'startup', }, },),
            )
              .toBe('π Session startup',);
          },
        },),
        it({
          name: 'session_start: defaults to "started" when no reason',
          fn: async () => {
            expect(
              titleForEvent({ eventType: 'session_start', data: {}, },),
            )
              .toBe('π Session started',);
          },
        },),
        it({
          name: 'session_shutdown: shows Session ended',
          fn: async () => {
            expect(
              titleForEvent({ eventType: 'session_shutdown', data: {}, },),
            )
              .toBe('π Session ended',);
          },
        },),
        it({
          name: 'agent_end: shows Stopped',
          fn: async () => {
            expect(
              titleForEvent({ eventType: 'agent_end', data: {}, },),
            )
              .toBe('π Stopped',);
          },
        },),
        it({
          name: 'before_agent_start: shows user prompt',
          fn: async () => {
            expect(
              titleForEvent({ eventType: 'before_agent_start',
                data: { prompt: 'Refactor auth', }, },),
            )
              .toBe('π Refactor auth',);
          },
        },),
        it({
          name: 'before_agent_start: truncates long prompts',
          fn: async () => {
            const longPrompt = 'a'.repeat(200,);
            const result = titleForEvent({
              eventType: 'before_agent_start',
              data: { prompt: longPrompt, },
            },);
            expect(result.length <= MAX_TITLE_LENGTH,).toBe(true,);
            expect(result.startsWith(TITLE_PREFIX,),).toBe(true,);
          },
        },),
        it({
          name: 'all titles respect MAX_TITLE_LENGTH',
          fn: async () => {
            const longCommand = 'a'.repeat(200,);
            const result = titleForEvent({
              eventType: 'tool_execution_start',
              data: {
                toolName: 'bash',
                args: { command: longCommand, },
              },
            },);
            expect(result.length <= MAX_TITLE_LENGTH,).toBe(true,);
          },
        },),
        it({
          name: 'tool_execution_start with unknown tool falls back gracefully',
          fn: async () => {
            const result = titleForEvent({
              eventType: 'tool_execution_start',
              data: { toolName: 'custom_tool', },
            },);
            expect(result,).toBe('π Running custom_tool',);
          },
        },),
      ],
    },),
    //endregion titleForEvent
  ],
},);
