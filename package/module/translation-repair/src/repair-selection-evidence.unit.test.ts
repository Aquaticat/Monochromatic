/** Repair selectors need source evidence and the existing English before judging changes. */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  applyPatchOperations,
  type ChatJsonOutcome,
  type ChatJsonRequest,
  chunkCandidateOf,
  type EditableEnvelope,
  type EditorCandidate,
  hashContent,
  repairSliceKey,
  type RosterModelId,
  selectChunkPatch,
  selectPerEnvelope,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Original English identifies what was already carried, not which model authored a repair. */
const TARGET = 'She greeted her friend.';
/** Whole sentence is the fixture's editable region. */
const ENVELOPE: EditableEnvelope = { envelopeId: 'envelope/greeting', startOffset: 0, endOffset: TARGET.length, baseText: TARGET, baseHash: hashContent({ content: TARGET, }), issueIds: [], };
/** Independent fixture electorate retains ordinary author weighting. */
const JUDGES: readonly RosterModelId[] = ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3', 'hf:openai/gpt-oss-120b',];

/**
 * Builds an applied candidate rather than an unverified raw replacement.
 * @param input - actual producer and proposed sentence
 * @returns Gated fixture patch
 * @example
 * ```ts
 * const candidate = proposed({ modelId: JUDGES[0], text: 'Her friend greeted her.' });
 * ```
 */
function proposed({ modelId, text, }: { readonly modelId: RosterModelId; readonly text: string; }): EditorCandidate {
  return { modelId, patch: applyPatchOperations({ targetText: TARGET, envelopes: [ENVELOPE,], operations: [{ envelopeId: ENVELOPE.envelopeId, baseHash: ENVELOPE.baseHash, newText: text, },], preservation: { mode: 'skip', }, }), };
}

/**
 * Chooses the source-correct fixture only when its deciding evidence reaches the actual call.
 * @returns Client and captured user sheets
 * @example
 * ```ts
 * const fixture = judges();
 * ```
 */
function judges(): { readonly client: SyntheticClient; readonly prompts: string[]; } {
  const prompts: string[] = [];
  const client: SyntheticClient = {
    chatText: async () => { throw new Error('Unexpected text call'); },
    quotas: async () => { throw new Error('Unexpected quota call'); },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>): Promise<ChatJsonOutcome<ValueT>> => {
      const prompt = JSON.stringify(request.messages.filter(message => message.role === 'user'));
      prompts.push(prompt);
      const value = { best: prompt.includes('DOCUMENT SOURCE MARKER') && prompt.includes('NEARBY SOURCE MARKER') ? 2 : 1, reason: 'Fixture decision from supplied source evidence.', };
      if (!request.validate(value)) throw new Error('Invalid fixture ballot');
      return { kind: 'ok', value, rawText: JSON.stringify(value), };
    },
  };
  return { client, prompts, };
}

/** Already-applied repairs differ in the event's actor. */
const CANDIDATES = [
  proposed({ modelId: 'hf:zai-org/GLM-5.3-Flash', text: 'She greeted her friend warmly.', }),
  proposed({ modelId: 'hf:Qwen/Qwen3.8-27B', text: 'Her friend greeted her.', }),
];

await describe({
  name: 'repair source evidence handoff',
  children: [
    it({
      name: 'CHANGES cache identity when full source evidence changes outside the neighboring window',
      fn: async () => {
        const base = { runShape: 'fixture', sourceText: '猫笑了。', targetText: TARGET, lineStructured: false, neighbouringSourceText: '近处。', };
        const first = { ...base, documentSourceText: 'FIRST document evidence', };
        const second = { ...base, documentSourceText: 'SECOND document evidence', };
        expect(repairSliceKey(first)).not.toBe(repairSliceKey(second));
        expect(repairSliceKey({ ...base, documentSourceText: '', })).toBe(repairSliceKey(base));
        const sourceOnly = { ...base, neighbouringSourceText: 'SAME', };
        const documentOnly = { ...base, neighbouringSourceText: '', documentSourceText: 'SAME', };
        expect(repairSliceKey(sourceOnly)).not.toBe(repairSliceKey(documentOnly));
      },
    }),
    it({
      name: 'SHOWS both source evidence scopes to the real regional selector',
      fn: async () => {
        const fixture = judges();
        const input = {
          client: fixture.client, candidates: CANDIDATES, envelopes: [ENVELOPE,], judgeModelIds: JUDGES,
          sourceText: '猫笑了。', targetText: TARGET, neighbouringSourceText: 'NEARBY SOURCE MARKER', documentSourceText: 'DOCUMENT SOURCE MARKER',
          signal: new AbortController().signal, perCallTimeoutMs: 5000, l: tagged({ tag: 'repair-evidence-test', }),
        };
        const selected = await selectPerEnvelope(input);
        expect(selected.operations[0]?.newText).toBe('Her friend greeted her.');
        expect(fixture.prompts.every(prompt => prompt.includes('NEARBY SOURCE MARKER') && prompt.includes('DOCUMENT SOURCE MARKER'))).toBe(true);
      },
    }),
    it({
      name: 'SHOWS source evidence and before-repair English to whole-chunk selection without inventing a candidate',
      fn: async () => {
        const fixture = judges();
        const offered = CANDIDATES.map(candidate => chunkCandidateOf(candidate));
        const fallback = offered[0];
        if (fallback === undefined) throw new Error('Missing fixture candidate');
        const input = {
          client: fixture.client, candidates: offered, judgeModelIds: JUDGES, sourceText: '猫笑了。',
          neighbouringSourceText: 'NEARBY SOURCE MARKER', documentSourceText: 'DOCUMENT SOURCE MARKER',
          indecisionFallback: fallback, rejectionFallback: { patchedText: TARGET, applied: [], rejected: [], },
          signal: new AbortController().signal, perCallTimeoutMs: 5000, l: tagged({ tag: 'repair-evidence-test', }),
        };
        const selected = await selectChunkPatch(input);
        expect(selected.patch.patchedText).toBe('Her friend greeted her.');
        expect(fixture.prompts.every(prompt => prompt.includes('EXISTING ENGLISH BEFORE REPAIR') && prompt.includes(TARGET))).toBe(true);
        expect(selected.rounds[0]?.slate).toHaveLength(2);
      },
    }),
  ],
});
