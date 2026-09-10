/**
 * Verifies absent-incumbent provenance reaches the real translator call without
 * changing canonical source used by validation and judging.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  messageText,
  runTranslateStage,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Source remains raw Markdown throughout canonical pipeline state. */
const SOURCE = '> 猫醒了。  \n> 鸟唱了。';
/** First-call rendering requires no structural send-back. */
const TRANSLATED = '> The cat wakes.<br/>The bird sings.';

await describe({
  name: 'source break display through the composed translation stage',
  children: [
    it({
      name: 'USES the visible source on first writer calls and raw source on the judge call',
      fn: async () => {
        /** Writer and selector inputs are independently observable. */
        const seen = { writers: 0, judges: 0, };
        /** The stub checks inputs before producing any candidate or ballot. */
        const client: SyntheticClient = {
          chatText: async () => { throw new Error('No unstructured call expected',); },
          quotas: async () => { throw new Error('No quota read expected',); },
          chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
            /** User messages alone, excluding system rules that mention br. */
            const userText = request.messages.filter(function isUser(message,) {
              return message.role === 'user';
            },).map(function text(message,) {
              return messageText({ message, },);
            },).join('\n',);
            /** Production response schema separates generation and selection. */
            const writing = request.responseFormat?.json_schema.name === 'translation_report';
            if (writing) {
              seen.writers += 1;
              expect(userText,).toContain('> 猫醒了。<br/>\n> 鸟唱了。',);
              expect(userText,).not.toContain(SOURCE,);
            }
            else {
              seen.judges += 1;
              expect(userText,).toContain(SOURCE,);
            }
            /** A compliant first answer should not trigger an author-repair schema. */
            const value: unknown = writing ? { translation: TRANSLATED, } : { best: 1, reason: 'Faithful lines and visible break.', };
            if (!request.validate(value,))
              throw new Error('Unexpected role or response schema',);
            return { kind: 'ok', value, rawText: JSON.stringify(value,), };
          },
        };
        /** Both halves run with real source preparation, writer and judge builders. */
        const result = await runTranslateStage({
          client,
          translatorModelIds: ['inception/mercury-2.5', 'hf:zai-org/GLM-5.3-Flash',],
          judgeModelIds: ['hf:openai/gpt-oss-120b', 'minimax-m3',],
          sourceText: SOURCE,
          incumbentText: '',
          incumbentKind: 'absent',
          lineStructured: false,
          signal: new AbortController().signal,
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'source-break-stage-test', },),
        },);
        expect(seen.writers,).toBe(2,);
        expect(seen.judges,).toBeGreaterThan(0,);
        expect(result.text,).toBe(TRANSLATED,);
        expect(SOURCE,).toBe('> 猫醒了。  \n> 鸟唱了。',);
      },
    },),
  ],
},);
