/** Built transcript projection retains complete visible data and excludes provider metadata. @module */
import {describe,expect,it} from '@monochromatic-dev/module-test/ts';
import {buildVisibleContext as buildContext} from '../dist/final/node/index.mjs';
import {LONG_TEXT_REPEAT_COUNT,BASH_ACTIVITY_COUNT,EXPECTED_MESSAGE_FLOOR,contextFromBranch,userMessage,assistantToolCall,toolResult,bashActivity,verdictEntry,parseVisibleMessages} from './visible-context-fixture.ts';

//region Actual built transcript conversion covers retained message branches.
await describe({name:buildContext.name,children:[
it({
      name: 'keeps entire latest-user span when it exceeds five messages',
      fn: async function testKeepsEntireLatestUserSpanWhenItExceedsFiveMessages(): Promise<void> {
        /** Generated activities after the latest user message. */
        const generatedActivities = Array.from(
          { length: BASH_ACTIVITY_COUNT, },
          function createActivity(_, activityIndex,) {
            return bashActivity(activityIndex + 1,);
          },
        )
          .flat();
        /** Context built from old activity, latest user request, and six tools. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('old request',),
              ...bashActivity(0,),
              userMessage('new request',),
              ...generatedActivities,
            ],
          },),
        );
        /** Complete messages sent to judge. */
        const messages = parseVisibleMessages(context,);

        expect(messages,).toHaveLength((BASH_ACTIVITY_COUNT * 2) + 1,);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('new request',),).toBe(true,);
        expect(context.includes('result 1',),).toBe(true,);
        expect(context.includes('result 6',),).toBe(true,);
      },
    },),
it({
      name: 'backfills to five newest messages when latest-user span is shorter',
      fn: async function testBackfillsToFiveNewestMessagesWhenLatestUserSpanIsShorter(): Promise<void> {
        /** Generated activities before the latest user message. */
        const olderActivities = Array.from(
          { length: EXPECTED_MESSAGE_FLOOR, },
          function createActivity(_, activityIndex,) {
            return bashActivity(activityIndex + 1,);
          },
        )
          .flat();
        /** Context built from enough older activity to fill the minimum context budget. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('old request',),
              ...olderActivities,
              userMessage('new request',),
            ],
          },),
        );
        /** Complete messages sent to judge. */
        const messages = parseVisibleMessages(context,);

        expect(messages,).toHaveLength(EXPECTED_MESSAGE_FLOOR,);
        expect(context.includes('old request',),).toBe(false,);
        expect(context.includes('result 3',),).toBe(false,);
        expect(context.includes('result 4',),).toBe(true,);
        expect(context.includes('result 5',),).toBe(true,);
        expect(messages.at(-1,)?.role,).toBe('user',);
      },
    },),
it({
      name: 'uses newest five messages when no user message exists',
      fn: async function testUsesNewestFiveMessagesWhenNoUserMessageExists(): Promise<void> {
        /** Generated activities without any user-message anchor. */
        const generatedActivities = Array.from(
          { length: BASH_ACTIVITY_COUNT, },
          function createActivity(_, activityIndex,) {
            return bashActivity(activityIndex + 1,);
          },
        )
          .flat();
        /** Context built from tool activity only. */
        const context = buildContext(
          contextFromBranch({ branch: generatedActivities, },),
        );
        /** Complete messages sent to judge. */
        const messages = parseVisibleMessages(context,);

        expect(messages,).toHaveLength(EXPECTED_MESSAGE_FLOOR,);
        expect(context.includes('result 3',),).toBe(false,);
        expect(context.includes('result 4',),).toBe(true,);
        expect(context.includes('result 6',),).toBe(true,);
      },
    },),
it({
      name: 'keeps full bash detail line',
      fn: async function testKeepsFullBashDetailLine(): Promise<void> {
        /** Long final bash line that previously exceeded detail limits. */
        const finalLine = `final ${'detail '.repeat(LONG_TEXT_REPEAT_COUNT,)} suffix`;
        /** Context built from a bash result whose final line should remain complete. */
        const context = buildContext(
          contextFromBranch({
            branch: [
              userMessage('run command',),
              assistantToolCall({
                name: 'bash',
                args: { command: 'printf detail', },
              },),
              toolResult({
                toolName: 'bash',
                output: `first line\n${finalLine}`,
              },),
            ],
          },),
        );

        expect(context,).toContain(`first line\\n${finalLine}`,);
        expect(context.includes('suffix',),).toBe(true,);
      },
    },)
]});
//endregion
