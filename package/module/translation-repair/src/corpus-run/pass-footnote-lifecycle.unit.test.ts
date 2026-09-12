import { createHash, } from 'node:crypto';
import { mkdtemp, readFile, readdir, rm, } from 'node:fs/promises';
import { tmpdir, } from 'node:os';
import { join, } from 'node:path';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  assertPipelineDigest,
  createSyntheticClient,
  hashContent,
  type PairedSectionRecord,
  parseDocument,
  prepareDocumentPair,
  preparePassEntry,
  translateSliceInput,
} from '../../dist/final/node/index.mjs';

const roster = ['hf:zai-org/GLM-5.3-Flash', 'hf:Qwen/Qwen3.8-27B'] as const;
const l = tagged({ tag: 'pass-footnote-lifecycle-test' });
const sourceText = 'Alpha[^10]  \nBeta[^200]  \nGamma.\n\n[^10]: First source note.\n\n[^200]: Second source note.';
const archiveBody = 'Alpha archive[^2]  \nBeta archive[^1]  \nGamma archive.';
const archiveDefinitions = '[^1]: Second archive note.\n\n[^2]: First archive note.';
const finalText = 'Alpha archive[^10]  \nBeta archive[^200]  \nGamma archive.\n\n[^10]: First archive note.\n\n[^200]: Second archive note.';
const directPairs = [{ source: 0, target: 0 }, { source: 1, target: 1 }, { source: 2, target: 2 }];
const crossedPairs = [{ source: 0, target: 0 }, { source: 1, target: 2 }, { source: 2, target: 1 }];

function cacheKey(targetText: string): string {
  const originals = parseDocument({ text: sourceText }).nodes;
  const targets = parseDocument({ text: targetText }).nodes;
  return createHash('sha256').update(['2', ...originals.map(node => node.text), '\0', ...targets.map(node => node.text)].join('\0')).digest('hex');
}

await describe({
  name: 'actual pass footnote preparation lifecycle',
  children: [
    ...[false, true].map(protectedOriginal => it({
      name: protectedOriginal ? 'retains the original preparation and cache identity when relabeling is withheld'
        : 'reprepares changed target text with fresh cache keys and current node metadata, then reuses both warm recipes',
      fn: async ctx => {
        const entryCacheDir = await mkdtemp(join(tmpdir(), 'footnote-pass-lifecycle-'));
        await using owned = { [Symbol.asyncDispose]: async () => { await rm(entryCacheDir, { recursive: true, force: true }); } };
        const fetchSpy = ctx.sinon.stub(globalThis, 'fetch').callsFake(async () => { throw new Error('unexpected real fetch in footnote lifecycle fixture'); });
        const calls: { readonly phase: string; readonly body: string; }[] = [];
        const archiveText = `${archiveBody}\n\n${protectedOriginal ? '<!-- 以下内容原文为英文 -->\n\n' : ''}${archiveDefinitions}`;
        const expectedText = protectedOriginal ? archiveText : finalText;
        const client = createSyntheticClient({ apiKey: 'fixture-key', transport: async exchange => {
          const body = exchange.bodyJson ?? '';
          const payload = JSON.parse(body) as { readonly messages: readonly { readonly content: string; }[]; };
          const text = payload.messages.map(message => message.content).join('\n');
          const initial = text.includes('[^2]: First archive note.');
          const changed = text.includes('[^10]: First archive note.');
          expect(initial || changed).toBe(true);
          expect(initial && changed).toBe(false);
          calls.push({ phase: initial ? 'initial' : 'changed', body });
          const content = JSON.stringify({ pairs: initial ? crossedPairs : directPairs });
          return { status: 200, bodyText: `data: ${JSON.stringify({ choices: [{ index: 0, delta: { content } }] })}\n\ndata: [DONE]\n\n` };
        } });
        const generation = `sha256-tree-v1:${'f'.repeat(64)}`;
        assertPipelineDigest(generation);
        const input = { client, entryId: 'invented-footnote-entry', entryCacheDir, pipelineDigest: generation,
          modelIds: roster, sourceText, targetText: archiveText, signal: new AbortController().signal, exchangeTimeoutMs: 5_000, l };
        const cold = await preparePassEntry(input);
        expect(cold.prepared.targetText).toBe(expectedText);
        expect(calls.map(call => call.phase)).toEqual(protectedOriginal ? ['initial', 'initial'] : ['initial', 'initial', 'changed', 'changed']);
        expect(cold.prepared.unclaimedTargetBlocks).toEqual([]);
        expect(cold.footnoteDefinitionPairs).toEqual(protectedOriginal
          ? [{ sourceLabel: '10', targetLabel: '2' }, { sourceLabel: '200', targetLabel: '1' }]
          : [{ sourceLabel: '10', targetLabel: '10' }, { sourceLabel: '200', targetLabel: '200' }]);
        const currentDocument = parseDocument({ text: expectedText });
        const oldDocument = parseDocument({ text: archiveText });
        expect(currentDocument.footnoteGraph.findings).toEqual([]);
        const targetNodes = cold.prepared.slices.flatMap(slice => slice.target.nodes);
        for (const node of targetNodes) {
          expect(node.text).toBe(expectedText.slice(node.startOffset, node.endOffset));
          expect(node.contentHash).toBe(hashContent({ content: node.text }));
          expect(node).toEqual(currentDocument.nodes.find(expected => expected.id === node.id));
          if (!protectedOriginal)
            expect(node.contentHash).not.toBe(oldDocument.nodes.find(previous => previous.id === node.id)?.contentHash);
        }
        if (protectedOriginal) {
          expect(cold.prepared.archiveOriginalSpans).toHaveLength(1);
          expect(cold.findings.some(finding => finding.includes('whole operation withheld'))).toBe(true);
        } else {
          expect(targetNodes.map(node => node.id)).toEqual(currentDocument.nodes.map(node => node.id));
          expect(currentDocument.documentHash).not.toBe(oldDocument.documentHash);
          const oracle = prepareDocumentPair({ sourceText, targetText: expectedText, frontMatterAuthority: 'archive',
            blockPairings: new Map([[0, directPairs]]), sealArchiveOriginal: true });
          expect(cold.prepared.slices).toEqual(oracle.slices);
          expect([...cold.prepared.lineStructuredSliceIndices]).toEqual([...oracle.lineStructuredSliceIndices]);
          for (const slice of cold.prepared.slices) {
            const projected = translateSliceInput({ slice, prepared: cold.prepared });
            expect(projected.archiveText).toBe(slice.target.text);
            expect(projected.stageInput.lineStructured).toBe(cold.prepared.lineStructuredSliceIndices.has(slice.target.sliceIndex));
          }
        }
        const cacheFiles = (await readdir(entryCacheDir)).filter(file => file.startsWith('pairing.') && file.endsWith('.json'));
        const cached = new Map(await Promise.all(cacheFiles.map(async file => {
          const envelope = JSON.parse(await readFile(join(entryCacheDir, file), 'utf8')) as { readonly cacheKey: string; readonly record: PairedSectionRecord; };
          expect(file).toBe(`pairing.${envelope.cacheKey}.json`);
          return [envelope.cacheKey, envelope.record] as const;
        })));
        expect((await readFile(join(entryCacheDir, 'pairing-generation.txt'), 'utf8')).trim()).toBe(generation);
        const initialKey = cacheKey(archiveText);
        const changedKey = cacheKey(finalText);
        expect(initialKey).not.toBe(changedKey);
        expect([...cached.keys()].sort()).toEqual(protectedOriginal ? [initialKey] : [initialKey, changedKey].sort());
        expect(cached.get(initialKey)?.pairs).toEqual(crossedPairs);
        if (!protectedOriginal)
          expect(cached.get(changedKey)?.pairs).toEqual(directPairs);
        const beforeWarm = calls.length;
        const warm = await preparePassEntry(input);
        expect(calls).toHaveLength(beforeWarm);
        expect(warm.prepared).toEqual(cold.prepared);
        expect(warm.footnoteDefinitionPairs).toEqual(cold.footnoteDefinitionPairs);
        expect(fetchSpy).not.toHaveBeenCalled();
      },
      timeout: 30_000,
    })),
  ],
});
