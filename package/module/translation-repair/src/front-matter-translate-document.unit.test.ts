/**
 * Integration test for front matter through translate ensemble and assembly.
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
  messageText,
  prepareDocumentPair,
  type RosterModelId,
  type SyntheticClient,
  translateDocument,
} from '../dist/final/node/index.mjs';

/**
 * Source metadata under translation.
 */
const SOURCE_TEXT = '---\nname: 猫猫\ninfo:\n  alias: 猫\n---\n';

/**
 * Archive metadata carrying entry id as visible name.
 */
const TARGET_TEXT = '---\nname: EntryId\ninfo:\n  alias: Maomao\n---\n';

/**
 * Source-faithful candidate retaining target shape.
 */
const CORRECTED_TEXT = '---\nname: Maomao\ninfo:\n  alias: Maomao\n---\n';

/**
 * Models producing and judging fixture slate.
 */
const ROSTER: readonly RosterModelId[] = [
  'hf:moonshotai/Kimi-K3',
  'hf:zai-org/GLM-5.3-Flash',
  'minimax-m3',
  'hf:Qwen/Qwen3.8-27B',
  'hf:nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-NVFP4',
  'hf:openai/gpt-oss-120b',
];

/**
 * Finds candidate containing expected corrected metadata.
 *
 * @param content - complete judge sheet
 *
 * @returns One-based candidate position
 */
function correctedCandidate({ content, }: { readonly content: string; }): number {
  const [, ...blocks] = content.split('CANDIDATE ',);
  for (const block of blocks) {
    /**
     * Candidate heading carrying one-based position.
     */
    const [heading = '',] = block.split('\n',);
    /**
     * Parsed candidate position.
     */
    const position = Math.trunc(Number(heading,),);
    if (Number.isInteger(position,) && block.includes('name: Maomao',))
      return position;
  }
  return 0;
}

/**
 * Client returning corrected metadata and selecting it.
 *
 * @param prompts - model prompts captured for rule reach assertion
 *
 * @returns Scripted client
 */
function frontMatterClient({ prompts, }: { readonly prompts: string[]; }): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText not used',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      const content = request.messages
        .map(function text(message,): string {
          return messageText({ message, },);
        },)
        .join('\n',);
      prompts.push(content,);
      const schema = request.responseFormat?.json_schema.name ?? '';
      const value: unknown = (schema === 'translation_report')
        ? { translation: CORRECTED_TEXT, }
        : {
          best: correctedCandidate({ content, }),
          reason: 'source metadata names the person',
        };
      if (!request.validate(value,))
        throw new Error(`scripted ${schema} reply failed validator`,);
      return {
        kind: 'ok',
        value,
        rawText: JSON.stringify(value,),
      };
    },
    quotas: async () => {
      throw new Error('quotas not used',);
    },
  };
}

await describe({
  name: 'front matter translate document',
  children: [
    it({
      name: 'REPLACES ENTRY ID WITH SOURCE-FAITHFUL VISIBLE NAME under YAML-specific ensemble rules',
      fn: async () => {
        const prompts: string[] = [];
        const prepared = prepareDocumentPair({
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
        },);
        const result = await translateDocument({
          client: frontMatterClient({ prompts, },),
          prepared,
          models: {
            translatorModelIds: ROSTER.slice(0, 3,),
            judgeModelIds: ROSTER,
          },
          signal: new AbortController().signal,
          perCallTimeoutMs: 100,
          l: tagged({ tag: 'front-matter-translate-test', },),
        },);

        expect(prepared.slices,).toHaveLength(1,);
        expect(prepared.slices.at(0,)?.syntax,).toBe('front-matter',);
        expect(result.translatedText,).toBe(CORRECTED_TEXT,);
        expect(result.changedSliceIndices,).toEqual([0,],);
        expect(prompts.some(function carriesYamlRule(prompt,): boolean {
          return prompt.includes('never an entry directory id',);
        },),).toBe(true,);
      },
    },),
  ],
},);
