/**
 * Tests for the end-to-end repair driver over a scripted stub client.
 * The stub discriminates stages by response-format schema name, so one
 * scripted client walks the whole loop without a network.
 * Fixtures are cat-themed invention mirroring corpus structure only.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import type {
  ChatJsonOutcome,
  ChatJsonRequest,
  SyntheticClient,
} from './chat-contract.ts';
import { repairTranslation, } from './repair-translation.ts';
import type { RepairModels, } from './repair-chunk.ts';

/**
 * Original document of the fixture pair.
 */
const SOURCE_TEXT = `## 简介

猫猫喜欢在窗台上晒太阳。猫猫也喜欢追蝴蝶。
`;

/**
 * Translation with one planted mistranslation.
 */
const TARGET_TEXT = `## Introduction

The cat loves sunbathing on the windowsill. The cat hates butterflies.
`;

/**
 * Role roster; identities only matter as distinct voices.
 */
const MODELS: RepairModels = {
  criticModelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K2.7-Code',],
  panelModelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K2.7-Code',],
  editorModelId: 'hf:zai-org/GLM-5.2',
  checkerModelIds: ['hf:zai-org/GLM-5.2', 'hf:Qwen/Qwen3.6-27B', 'hf:moonshotai/Kimi-K2.7-Code',],
};

/**
 * One-based sheet numbers 1 through count.
 */
function oneBasedNumbers(
  { count, }: { readonly count: number; },
): readonly number[] {
  return [...Array.from({ length: count, },).keys(),]
    .map(function toOneBased(index,) {
      return index + 1;
    },);
}

/**
 * Occurrences of one marker in the user prompt,
 * for scripting per-item replies without parsing the sheet.
 */
function countMarker(
  {
    request,
    marker,
  }: {
    readonly request: ChatJsonRequest<unknown>;
    readonly marker: string;
  },
): number {
  /**
   * User prompt content of the request.
   */
  const content = request.messages.at(-1,)?.content ?? '';

  return content.split(marker,).length - 1;
}

/**
 * Stub client scripted per stage; the schema name on the response format
 * names the stage.
 *
 * @param criticIssues - wire issues every critic reports
 *
 * @param checkerVerdict - verdict every checker casts on every issue
 */
function scriptedClient(
  {
    criticIssues,
    checkerVerdict = 'fixed',
  }: {
    readonly criticIssues: readonly Record<string, unknown>[];
    readonly checkerVerdict?: string;
  },
): SyntheticClient {
  return {
    chatText: async () => {
      throw new Error('chatText unused by the repair pipeline',);
    },
    chatJson: async <ValueT,>(
      request: ChatJsonRequest<ValueT>,
    ): Promise<ChatJsonOutcome<ValueT>> => {
      /**
       * Stage name from the structured-output constraint.
       */
      const stage = request.responseFormat?.json_schema.name ?? '';

      /**
       * Scripted wire reply for the stage.
       */
      const scripted: unknown = stage === 'critic_report'
        ? { issues: criticIssues, }
        : stage === 'panel_ballot'
        ? {
          verdicts: oneBasedNumbers({
            count: countMarker({ request, marker: '\nCLAIM ', },),
          },)
            .map(function toVerdict(claim,) {
              return {
                claim,
                vote: 'supported',
              };
            },),
        }
        : stage === 'editor_report'
        ? {
          edits: Array.from(
            { length: countMarker({ request, marker: 'REGION ', },) > 0 ? 1 : 0, },
            function toEdit() {
              return {
                region: 1,
                newText: 'The cat also loves chasing butterflies.',
              };
            },
          ),
        }
        : stage === 'resolution_report'
        ? {
          checks: oneBasedNumbers({
            count: countMarker({ request, marker: '\nISSUE ', },),
          },)
            .map(function toCheck(issue,) {
              return {
                issue,
                verdict: checkerVerdict,
              };
            },),
        }
        : undefined;
      if (scripted === undefined)
        throw new Error(`stub has no script for stage ${stage}`,);
      if (!request.validate(scripted,))
        throw new Error(`stub script failed the ${stage} guard`,);
      return {
        kind: 'ok',
        value: scripted,
        rawText: JSON.stringify(scripted,),
      };
    },
    quotas: async () => {
      throw new Error('quotas unused by the repair pipeline',);
    },
  };
}

/**
 * Wire issue for the planted mistranslation, quoting exact fixture bytes.
 */
const MISTRANSLATION_ISSUE = {
  category: 'accuracy/mistranslation',
  severity: 'major',
  summary: 'Chasing butterflies is rendered as hating them.',
  sourceQuote: '猫猫也喜欢追蝴蝶。',
  targetQuote: 'The cat hates butterflies.',
};

await describe({
  name: repairTranslation.name,
  children: [
    it({
      name: 'repairs a planted mistranslation end to end',
      fn: async () => {
        /** Full run over the scripted client. */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [MISTRANSLATION_ISSUE,], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('repaired',);
        expect(result.repairedText,).toContain('The cat also loves chasing butterflies.',);
        expect(result.repairedText.includes('The cat hates butterflies.',),).toBe(false,);
        // Untouched text survives byte for byte.
        expect(result.repairedText,).toContain('The cat loves sunbathing on the windowsill.',);
        expect(result.issues.some(function isResolvedAccepted(record,) {
          return (record.issue.status === 'accepted') && record.resolved;
        },),).toBe(true,);
      },
    },),

    it({
      name: 'keeps the input when checkers refuse to confirm the fix',
      fn: async () => {
        /** Full run whose checkers vote not-fixed. */
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [MISTRANSLATION_ISSUE,],
            checkerVerdict: 'not-fixed',
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('unchanged',);
        expect(result.repairedText,).toBe(TARGET_TEXT,);
        expect(result.issues.some(function isResolved(record,) {
          return record.resolved;
        },),).toBe(false,);
      },
    },),

    it({
      name: 'keeps the input when critics find nothing',
      fn: async () => {
        /** Full run with silent critics. */
        const result = await repairTranslation({
          client: scriptedClient({ criticIssues: [], },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('unchanged',);
        expect(result.repairedText,).toBe(TARGET_TEXT,);
        expect(result.issues,).toHaveLength(0,);
      },
    },),

    it({
      name: 'blocks repair on ensemble-agreed critical non-translation',
      fn: async () => {
        /** Full run whose critics all report a non-translation. */
        const result = await repairTranslation({
          client: scriptedClient({
            criticIssues: [
              {
                category: 'accuracy/non-translation',
                severity: 'critical',
                summary: 'The target is not a translation of the source.',
                targetQuote: 'The cat loves sunbathing on the windowsill.',
              },
            ],
          },),
          sourceText: SOURCE_TEXT,
          targetText: TARGET_TEXT,
          models: MODELS,
          signal: new AbortController().signal,
        },);
        expect(result.status,).toBe('blocked-non-translation',);
        expect(result.repairedText,).toBe(TARGET_TEXT,);
      },
    },),
  ],
},);
