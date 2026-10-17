/** Built transcript projection retains complete visible data and excludes provider metadata. @module */
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {buildVisibleContext as buildContext} from '../dist/final/node/index.mjs';
import {LONG_TEXT_REPEAT_COUNT,BASH_ACTIVITY_COUNT,EXPECTED_MESSAGE_FLOOR,contextFromBranch,userMessage,assistantToolCall,toolResult,bashActivity,verdictEntry,parseVisibleMessages} from './visible-context-fixture.ts';

//region Actual built transcript conversion covers retained message branches.
await describe({name:buildContext.name,children:[
it({
      name: 'omits persisted system messages that Pi does not render',
      fn: async function testOmitsSystemMessages(): Promise<void> {
        /** Context containing Pi 0.87 persisted system-prompt message. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              {
                type: 'message',
                message: {
                  role: 'system',
                  content: 'hidden system prompt',
                  sections: { hiddenSection: 'hidden system section', },
                  timestamp: 0,
                },
              },
              userMessage('visible request after system prompt',),
            ],
          },),
        );

        expect(context,).toContain('visible request after system prompt',);
        expect(context.includes('hidden system prompt',),).toBe(false,);
        expect(context.includes('hidden system section',),).toBe(false,);
      },
    },),
it({
      name: 'omits system message carried by compaction entry but keeps summary',
      fn: async function testOmitsCompactionSystemMessage(): Promise<void> {
        /** Context containing compaction that re-emits system prompt state. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              {
                type: 'compaction',
                summary: 'complete compaction summary',
                firstKeptEntryId: 'kept',
                tokensBefore: 42,
                systemMessage: {
                  role: 'system',
                  content: 'hidden compaction system prompt',
                  timestamp: 0,
                },
                timestamp: '2026-09-22T00:00:00.000Z',
              },
              userMessage('visible request after compaction',),
            ],
          },),
        );

        expect(context,).toContain('complete compaction summary',);
        expect(context,).toContain('visible request after compaction',);
        expect(context.includes('hidden compaction system prompt',),).toBe(false,);
      },
    },),
it({
      name: 'omits unknown message role from newer Pi instead of throwing',
      fn: async function testOmitsUnknownRole(): Promise<void> {
        /** Context containing role absent from installed Pi declarations. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('visible request beside unknown role',),
              {
                type: 'message',
                message: {
                  role: 'futureRole',
                  payload: 'unknown role payload',
                },
              },
            ],
          },),
        );

        expect(context,).toContain('visible request beside unknown role',);
        expect(context.includes('unknown role payload',),).toBe(false,);
        expect(context.includes('futureRole',),).toBe(false,);
      },
    },),
it({
      name: 'tolerates missing message content from older session files',
      fn: async function testToleratesMissingContent(): Promise<void> {
        /** Context containing user message whose content was never written. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              {
                type: 'message',
                message: {
                  role: 'user',
                  content: null,
                },
              },
              userMessage('visible request after empty message',),
            ],
          },),
        );

        expect(context,).toContain('visible request after empty message',);
      },
    },),
it({
      name: 'keeps guard verdict beside complete corresponding tool result',
      fn: async function testKeepsGuardVerdictWithToolResult(): Promise<void> {
        /** Context containing complete tool data and preceding guard verdict. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('inspect guarded operation',),
              assistantToolCall({
                name: 'bash',
                args: { command: 'deploy production', },
              },),
              verdictEntry({
                action: 'bash: deploy production',
                verdict: 'user-deny',
                reason: 'Deployment not approved.',
              },),
              toolResult({
                toolName: 'bash',
                output: 'blocked result',
                isError: true,
              },),
            ],
          },),
        );

        expect(context,).toContain('deploy production',);
        expect(context,).toContain('blocked result',);
        expect(context,).toContain('user-deny',);
        expect(context,).toContain('Deployment not approved.',);
      },
    },)
]});
//endregion
