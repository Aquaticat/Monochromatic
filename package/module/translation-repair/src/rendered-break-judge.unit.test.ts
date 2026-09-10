/**
 * Verifies the actual rotated anonymous slate receives matching structure facts.
 * The scripted reader exercises wiring; live probes establish model behavior.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  judgeTranslateSlate,
  messageText,
  type ProducedSlate,
  readSliceSkeleton,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Faithful rendered structure, regardless of rotated ballot position. */
const KEPT = '> The cat wakes.<br/>The bird sings.';
/** Same words, missing the visible boundary. */
const FLAT = '> The cat wakes.\n> The bird sings.';

await describe({
  name: 'rendered break facts on the real translated slate',
  children: [
    it({
      name: 'MATCHES each displayed candidate index after rotation and keeps producer identity private',
      fn: async () => {
        /** Capture the exact sheets delivered to the judge client. */
        const sheets: string[] = [];
        /** This client responds only to the new evidence, not candidate order. */
        const client: SyntheticClient = {
          chatText: async () => { throw new Error('No unstructured call expected',); },
          quotas: async () => { throw new Error('No quota read expected',); },
          chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>,): Promise<ChatJsonOutcome<ValueT>> => {
            /** User-facing candidate labels and criteria, without transport serialization. */
            const sheet = request.messages.map(function text(message,) {
              return messageText({ message, },);
            },).join('\n',);
            sheets.push(sheet,);
            /** Only a measured break-preserving candidate earns this scripted ballot. */
            const best = [1, 2,].find(function preserved(index,): boolean {
              return sheet.includes(`"Candidate ${String(index,)}" explicit breaks by top-level block: [1]`,);
            },) ?? 0;
            /** Let the production schema perform the narrowing. */
            const value: unknown = { best, reason: 'The visible source line boundary remains.', };
            if (!request.validate(value,))
              throw new Error('Scripted ballot failed schema',);
            return { kind: 'ok', value, rawText: JSON.stringify(value,), };
          },
        };
        /** Both candidates are already available, isolating judging from generation. */
        const produced: ProducedSlate = {
          candidates: [
            { producer: { kind: 'model', modelId: 'inception/mercury-2.5', }, value: { text: FLAT, origin: 'fresh', }, rendered: FLAT, },
            { producer: { kind: 'model', modelId: 'gemma-4-26b-a4b-it', }, value: { text: KEPT, origin: 'fresh', }, rendered: KEPT, },
          ],
          heardTranslators: 2,
          findings: [],
        };
        /** The real stage rotates, renders, judges and records this slate. */
        const result = await judgeTranslateSlate({
          client,
          produced,
          judgeModelIds: ['hf:openai/gpt-oss-120b', 'hf:Qwen/Qwen3.8-27B',],
          sourceText: '> 猫醒了。  \n> 鸟唱了。',
          incumbentText: '',
          incumbentKind: 'absent',
          lineStructured: false,
          signal: new AbortController().signal,
          perCallTimeoutMs: 5_000,
          l: tagged({ tag: 'rendered-break-judge-test', },),
        },);
        expect(result.text,).toBe(KEPT,);
        expect(sheets.length,).toBeGreaterThan(0,);
        for (const entry of result.slate) {
          /** Re-read exactly the wording whose index the artifact records. */
          const parsed = readSliceSkeleton({ text: entry.text, },);
          expect(parsed.kind,).toBe('read',);
          if (parsed.kind === 'read') {
            for (const sheet of sheets) {
              expect(sheet,).toContain(`"Candidate ${String(entry.index,)}" explicit breaks by top-level block: ${JSON.stringify(parsed.skeleton.explicitBreaks,)}`,);
              expect(sheet,).not.toContain('inception/mercury-2.5',);
              expect(sheet,).not.toContain('gemma-4-26b-a4b-it',);
            }
          }
        }
      },
    },),
  ],
},);
