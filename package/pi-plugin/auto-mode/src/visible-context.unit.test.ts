/** Built transcript projection retains complete visible data and excludes provider metadata. @module */
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {buildVisibleContext as buildContext} from '../dist/final/node/index.mjs';
import {LONG_TEXT_REPEAT_COUNT,BASH_ACTIVITY_COUNT,EXPECTED_MESSAGE_FLOOR,contextFromBranch,userMessage,assistantToolCall,toolResult,bashActivity,verdictEntry,parseVisibleMessages} from './visible-context-fixture.ts';

//region Actual built transcript conversion covers retained message branches.
await describe({name:buildContext.name,children:[
it({
      name: 'keeps full user message text',
      fn: async function testKeepsFullUserMessageText(): Promise<void> {
        /** Long user message that previously exceeded abbreviation limits. */
        const longUserText = `prefix ${'message '.repeat(LONG_TEXT_REPEAT_COUNT,)} suffix`;
        /** Context built from a branch containing only long user text. */
        const context = buildContext(
          contextFromBranch({ branch: [userMessage(longUserText,),], },),
        );

        expect(context,).toBe(`[{"content":"${longUserText}","role":"user"}]`);
        expect(context.includes('…',),).toBe(false,);
      },
    },),
it({
      name: 'keeps complete visible inputs and outputs from prior tool messages',
      fn: async function testKeepsCompleteVisibleToolMessages(): Promise<void> {
        /** Context containing unflagged write, observed Bash output, and pending flagged execution. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              assistantToolCall({
                name: 'write',
                args: {
                  path: 'cat.txt',
                  content: 'meow',
                },
              },),
              toolResult({
                toolName: 'write',
                output: 'Wrote cat.txt',
              },),
              assistantToolCall({
                name: 'bash',
                args: { command: 'cat dog.txt', },
              },),
              toolResult({
                toolName: 'bash',
                output: 'observed output\nwoof',
                details: { source: 'complete tool details', },
              },),
              assistantToolCall({
                name: 'bash',
                args: { command: './cat.txt', },
              },),
            ],
          },),
        );

        expect(context,).toContain('meow',);
        expect(context,).toContain('dog.txt',);
        expect(context,).not.toContain('cat dog.txt',);
        expect(context,).toContain('syntax',);
        expect(context,).toContain(String.raw`observed output\nwoof`,);
        expect(context,).toContain('./cat.txt',);
        expect(context,).toContain('complete tool details',);
      },
    },),
it({
      name: 'omits assistant thinking while retaining image data without provider signatures',
      fn: async function testPreservesVisibleAssistantAndImages(): Promise<void> {
        /** Context containing every visible assistant block and user image. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              {
                type: 'message',
                message: {
                  role: 'user',
                  content: [
                    {
                      type: 'text',
                      text: 'Inspect image.',
                    },
                    {
                      type: 'image',
                      data: 'complete-image-data',
                      mimeType: 'image/png',
                    },
                  ],
                },
              },
              {
                type: 'message',
                message: {
                  role: 'assistant',
                  content: [
                    {
                      type: 'thinking',
                      thinking: 'complete visible reasoning',
                      thinkingSignature: 'hidden-thinking-signature',
                    },
                    {
                      type: 'text',
                      text: 'Complete assistant response.',
                    },
                    {
                      type: 'toolCall',
                      id: 'tool-call-id',
                      name: 'read',
                      arguments: { path: 'cat.txt', },
                      thoughtSignature: 'hidden-tool-signature',
                    },
                  ],
                  stopReason: 'toolUse',
                },
              },
              {
                type: 'message',
                message: {
                  role: 'assistant',
                  content: [],
                  stopReason: 'error',
                  errorMessage: 'complete visible assistant error',
                },
              },
            ],
          },),
        );

        expect(context,).toContain('complete-image-data',);
        expect(context,).not.toContain('complete visible reasoning',);
        expect(context,).toContain('Complete assistant response.',);
        expect(context,).toContain('cat.txt',);
        expect(context,).toContain('complete visible assistant error',);
        expect(context.includes('hidden-thinking-signature',),).toBe(false,);
        expect(context.includes('hidden-tool-signature',),).toBe(false,);
      },
    },),
it({
      name: 'preserves direct Bash, visible custom, compaction, and branch summaries',
      fn: async function testPreservesOtherVisibleMessages(): Promise<void> {
        /** Context containing Pi-specific visible transcript message roles. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('retain complete visible span',),
              {
                type: 'message',
                message: {
                  role: 'bashExecution',
                  command: 'printf direct',
                  output: 'complete direct output',
                  exitCode: 0,
                  cancelled: false,
                  truncated: true,
                  fullOutputPath: '/tmp/full-output',
                },
              },
              {
                type: 'custom_message',
                customType: 'visible-note',
                content: 'complete custom content',
                details: { visibleDetail: 'complete detail', },
                display: true,
                timestamp: '2026-07-25T00:00:00.000Z',
              },
              {
                type: 'custom_message',
                customType: 'hidden-note',
                content: 'hidden custom content',
                display: false,
                timestamp: '2026-07-25T00:00:00.000Z',
              },
              {
                type: 'compaction',
                summary: 'complete compaction summary',
                firstKeptEntryId: 'kept',
                tokensBefore: 42,
                timestamp: '2026-07-25T00:00:00.000Z',
              },
              {
                type: 'branch_summary',
                fromId: 'branch-source',
                summary: 'complete branch summary',
                timestamp: '2026-07-25T00:00:00.000Z',
              },
            ],
          },),
        );

        expect(context,).not.toContain('printf direct',);
        expect(context,).toContain('direct',);
        expect(context,).toContain('complete direct output',);
        expect(context,).toContain('/tmp/full-output',);
        expect(context,).toContain('complete custom content',);
        expect(context,).toContain('complete detail',);
        expect(context,).toContain('complete compaction summary',);
        expect(context,).toContain('complete branch summary',);
        expect(context.includes('hidden custom content',),).toBe(false,);
      },
    },)
]});
//endregion
