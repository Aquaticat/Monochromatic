/**
 * Tests acceptance confirmation uses distinct same-candidate responsibility.
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';
import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  confirmAbsoluteNaturalness,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

await describe({
  name: confirmAbsoluteNaturalness.name,
  children: [
    it({
      name: 'SENDS DISTINCT PROMPTS to same model for discovery and challenge',
      fn: async () => {
        /** Exact serialized prompts observed at model-facing boundary. */
        const prompts: string[] = [];
        const client: SyntheticClient = {
          chatText: async () => {
            throw new Error('chatText unused by confirmation fixture',);
          },
          chatJson: async <ValueT,>(
            request: ChatJsonRequest<ValueT>,
          ): Promise<ChatJsonOutcome<ValueT>> => {
            prompts.push(JSON.stringify(request.messages,),);
            const value: unknown = {
              acceptable: true,
              findings: [],
              reason: 'fixture accepts exact candidate',
            };
            if (!request.validate(value,))
              throw new Error('confirmation fixture response failed validation',);
            return {
              kind: 'ok',
              value,
              rawText: JSON.stringify(value,),
            };
          },
          quotas: async () => {
            throw new Error('quotas unused by confirmation fixture',);
          },
        };
        const confirmed = await confirmAbsoluteNaturalness({
          client,
          modelIds: ['hf:moonshotai/Kimi-K3',],
          subject: {
            sourceText: '猫在睡觉。',
            candidateText: 'The cat is sleeping.',
            paragraphs: ['The cat is sleeping.',],
          },
          signal: AbortSignal.timeout(5_000,),
          exchangeTimeoutMs: 5_000,
          l: tagged({ tag: 'absolute-confirmation-test', },),
        },);
        expect(confirmed.review.verdict,).toBe('acceptable',);
        expect(confirmed.confirmations,).toHaveLength(1,);
        expect(prompts,).toHaveLength(2,);
        expect(new Set(prompts,).size,).toBe(2,);
      },
    },),
  ],
},);
