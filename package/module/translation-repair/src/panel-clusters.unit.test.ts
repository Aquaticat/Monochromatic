/** Cluster-local packets retain every claim, merge ballot and independent quorum basis. */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type ChatJsonOutcome,
  type ChatJsonRequest,
  type ClaimCluster,
  runPanelStage,
  type SyntheticClient,
} from '../dist/final/node/index.mjs';

/** Fixture electorate remains unchanged across packets. */
const MODELS = ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B', 'hf:moonshotai/Kimi-K3', 'hf:openai/gpt-oss-120b', 'minimax-m3', 'gemma-4-26b-a4b-it',] as const;
/** Distinct clusters include a merge proposal whose members must stay together. */
const CLUSTERS: readonly ClaimCluster[] = [
  { clusterId: 'first', position: 0, members: [
    { claimId: 'claim-first', claim: { category: 'accuracy/mistranslation', severity: 'minor', summary: 'FIRST cat claim', spans: [], }, },
  ], },
  { clusterId: 'second', position: 1, members: [
    { claimId: 'claim-second', claim: { category: 'accuracy/mistranslation', severity: 'minor', summary: 'SECOND cat claim', spans: [], }, },
    { claimId: 'claim-third', claim: { category: 'accuracy/mistranslation', severity: 'minor', summary: 'THIRD cat claim', spans: [], }, },
  ], },
];
/** Captured packet plus actual responding identity. */
type Capture = { readonly prompt: string; readonly modelId: string; readonly claims: readonly string[]; };
/**
 * Supplies deterministic votes over whichever claims the real packet actually contains.
 * @param input - optional per-packet availability restriction
 * @returns Capturing client and evidence
 * @example
 * ```ts
 * const fixture = panelFixture({});
 * ```
 */
function panelFixture(input: { readonly disjoint?: boolean; } = {}): { client: SyntheticClient; captures: Capture[]; } {
  const captures: Capture[] = [];
  const client: SyntheticClient = {
    chatText: async () => { throw new Error('Unexpected text request',); },
    quotas: async () => { throw new Error('Unexpected quota request',); },
    chatJson: async <ValueT,>(request: ChatJsonRequest<ValueT>): Promise<ChatJsonOutcome<ValueT>> => {
      const prompt = request.messages.filter(message => message.role === 'user').map(message => message.content).join('\n');
      const present = CLUSTERS.flatMap(cluster => cluster.members).filter(member => prompt.includes(member.claim.summary));
      captures.push({ prompt, modelId: request.modelId, claims: present.map(member => member.claimId), });
      if (input.disjoint) {
        const index = MODELS.findIndex(model => model === request.modelId);
        const first = present.some(member => member.claimId === 'claim-first');
        if ((first && index >= MODELS.length / 2) || (!first && index < MODELS.length / 2))
          return { kind: 'schema-mismatch', rawText: '{}', detail: 'Fixture seat unavailable for this packet', };
      }
      const groups = CLUSTERS.filter(cluster => cluster.members.some(member => present.includes(member)));
      const value = {
        verdicts: present.map((member, index) => ({ claim: index + 1, vote: member.claimId === 'claim-first' ? 'unsupported' : 'supported', })),
        groups: groups.map((cluster, index) => ({ group: index + 1, sameDefect: cluster.members.length > 1, })),
      };
      if (!request.validate(value))
        throw new Error('Invalid fixture panel response',);
      return { kind: 'ok', value, };
    },
  };
  return { client, captures, };
}

/** Fixture call retains source boundaries and the wider configured electorate. */
function panelInput(client: SyntheticClient) {
  return {
    client,
    panelModelIds: MODELS,
    sourceText: '猫睡了。',
    targetText: 'The cat slept.',
    clusters: CLUSTERS,
    neighbouringSourceText: '朋友回来了。',
    neighbouringIncumbentText: 'Her friend returned.',
    documentSourceText: '# Full source\n\n猫睡了。\n\n朋友回来了。',
    signal: new AbortController().signal,
    perCallTimeoutMs: 5_000,
    l: tagged({ tag: 'panel-cluster-test', }),
  };
}

await describe({
  name: runPanelStage.name,
  children: [
    it({
      name: 'ASKS one preplanned cluster per packet and retains its merge question',
      fn: async () => {
        const fixture = panelFixture();
        const result = await runPanelStage(panelInput(fixture.client));
        expect(fixture.captures.some(capture => capture.claims.length === 1)).toBe(true);
        expect(fixture.captures.some(capture => capture.claims.length === 2)).toBe(true);
        expect(fixture.captures.every(capture => capture.claims.length <= 2)).toBe(true);
        expect(fixture.captures.every(capture => !capture.prompt.includes('GROUP 2'))).toBe(true);
        expect(fixture.captures.every(capture => capture.prompt.includes('# Full source'))).toBe(true);
        expect(result.issues).toHaveLength(2);
        expect(result.issues[0]?.status).toBe('rejected');
        expect(result.issues[1]?.status).toBe('accepted');
        expect(result.issues[1]?.claims.map(member => member.claimId)).toEqual(['claim-second', 'claim-third',]);
      },
    }),
    it({
      name: 'TALLIES disjoint responding subsets separately without using their union as a quorum',
      fn: async () => {
        const fixture = panelFixture({ disjoint: true, });
        const result = await runPanelStage(panelInput(fixture.client));
        const readings = result.issues.flatMap(issue => Object.values(issue.readings));
        expect(readings.every(reading => reading.configuredPanelists === MODELS.length)).toBe(true);
        expect(readings.every(reading => reading.ballots.length === MODELS.length / 2)).toBe(true);
        expect(result.heardPanelists).toBe(MODELS.length);
        expect(result.issues[0]?.status).toBe('rejected');
        expect(result.issues[1]?.status).toBe('accepted');
      },
    }),
    it({
      name: 'BUYS no packet when there are no claims',
      fn: async () => {
        const fixture = panelFixture();
        const result = await runPanelStage({ ...panelInput(fixture.client), clusters: [], });
        expect(fixture.captures).toHaveLength(0);
        expect(result).toEqual({ issues: [], heardPanelists: 0, findings: [], });
      },
    }),
    it({
      name: 'PRESERVES the single-cluster protocol and leaves absent document evidence absent',
      fn: async () => {
        const fixture = panelFixture();
        const input = panelInput(fixture.client);
        const { documentSourceText, ...withoutDocument } = input;
        expect(documentSourceText).toContain('# Full source');
        const result = await runPanelStage({ ...withoutDocument, clusters: CLUSTERS.slice(0, 1), });
        expect(result.issues).toHaveLength(1);
        expect(fixture.captures.every(capture => capture.claims.length === 1)).toBe(true);
        expect(fixture.captures.every(capture => !capture.prompt.includes('FULL ORIGINAL DOCUMENT'))).toBe(true);
      },
    }),
  ],
});
