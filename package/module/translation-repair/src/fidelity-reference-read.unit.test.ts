import { writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  CorpusReadError,
  FidelityReferenceError,
  readReviewedFidelityReferences,
} from '../dist/final/node/index.mjs';
import { makeNamingArchive, namingFixtureGit, } from './archive-naming.test-fixture.ts';
import { REVIEW_REFERENCE, reviewedFixture, } from './fidelity-reference.test-fixture.ts';

/** Adds invented source to an already disposable corpus repository. */
async function addSource(cloneDir: string, source: string) {
  await writeFile(join(cloneDir, 'people/starlit-cat/page.md'), source);
  await namingFixtureGit({ cloneDir, args: ['add', '--', 'people/starlit-cat/page.md'] });
  await namingFixtureGit({ cloneDir, args: ['commit', '--message', 'add invented source'] });
  return await namingFixtureGit({ cloneDir, args: ['rev-parse', 'HEAD'] });
}

await describe({
  name: '',
  children: [
    it({
      name: 'reads reviewed source and archive through the real pinned corpus boundary',
      fn: async () => {
        const fixture = reviewedFixture();
        await using corpus = await makeNamingArchive({ after: fixture.archiveFile });
        const commitSha = await addSource(corpus.pin.cloneDir, fixture.sourceFile);
        const result = await readReviewedFidelityReferences({ pin: { ...corpus.pin, commitSha },
          specs: [{ ...fixture.spec, corpusSha: commitSha }] });
        expect(result).toHaveLength(1);
        expect(result[0]?.referenceText).toBe(REVIEW_REFERENCE);
      },
    }),
    it({
      name: 'rejects a different corpus revision before file access',
      fn: async () => {
        const fixture = reviewedFixture();
        let caught: unknown;
        try {
          await readReviewedFidelityReferences({ pin: { cloneDir: '/unused-fixture', commitSha: 'b'.repeat(40) }, specs: [fixture.spec] });
        } catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(FidelityReferenceError);
        expect((caught as Error).message).toContain('pin verification');
      },
    }),
    ...['../elsewhere', 'nested/entry', String.raw`nested\entry`, '', '.', '..', 'null\0entry'].map(entryId => it({
      name: `rejects nonliteral entry identifier ${JSON.stringify(entryId)} before file access`,
      fn: async () => {
        const fixture = reviewedFixture();
        let caught: unknown;
        try {
          await readReviewedFidelityReferences({ pin: { cloneDir: '/unused-fixture', commitSha: fixture.spec.corpusSha },
            specs: [{ ...fixture.spec, entryId }] });
        } catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(FidelityReferenceError);
        expect((caught as Error).message).toContain('request verification');
      },
    })),
    it({
      name: 'preserves missing-source errors instead of returning an empty calibration',
      fn: async () => {
        const fixture = reviewedFixture();
        await using corpus = await makeNamingArchive({ after: fixture.archiveFile });
        let caught: unknown;
        try {
          await readReviewedFidelityReferences({ pin: corpus.pin, specs: [{ ...fixture.spec, corpusSha: corpus.pin.commitSha }] });
        } catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(CorpusReadError);
      },
    }),
    it({
      name: 'preserves missing-archive errors after the source read completes',
      fn: async () => {
        const fixture = reviewedFixture();
        await using corpus = await makeNamingArchive({ after: fixture.archiveFile });
        await addSource(corpus.pin.cloneDir, fixture.sourceFile);
        await namingFixtureGit({ cloneDir: corpus.pin.cloneDir, args: ['rm', '--', corpus.relPath] });
        await namingFixtureGit({ cloneDir: corpus.pin.cloneDir, args: ['commit', '--message', 'remove fixture archive'] });
        const commitSha = await namingFixtureGit({ cloneDir: corpus.pin.cloneDir, args: ['rev-parse', 'HEAD'] });
        let caught: unknown;
        try {
          await readReviewedFidelityReferences({ pin: { ...corpus.pin, commitSha }, specs: [{ ...fixture.spec, corpusSha: commitSha }] });
        } catch (error) { caught = error; }
        expect(caught).toBeInstanceOf(CorpusReadError);
      },
    }),
    it({
      name: 'propagates an already-aborted caller before metadata or file work',
      fn: async () => {
        const controller = new AbortController();
        const reason = new Error('fixture canceled');
        controller.abort(reason);
        let caught: unknown;
        try {
          await readReviewedFidelityReferences({ pin: { cloneDir: '/unused-fixture', commitSha: 'unused' }, signal: controller.signal });
        } catch (error) { caught = error; }
        expect(caught).toBe(reason);
      },
    }),
    it({
      name: 'checks cancellation again after both owned file reads have settled',
      fn: async () => {
        const fixture = reviewedFixture();
        await using corpus = await makeNamingArchive({ after: fixture.archiveFile });
        const commitSha = await addSource(corpus.pin.cloneDir, fixture.sourceFile);
        const controller = new AbortController();
        const reason = new Error('fixture canceled after reads');
        const original = controller.signal.throwIfAborted.bind(controller.signal);
        let checks = 0;
        Object.defineProperty(controller.signal, 'throwIfAborted', { value: () => {
          checks += 1;
          if (checks === 3) controller.abort(reason);
          original();
        } });
        let caught: unknown;
        try {
          await readReviewedFidelityReferences({ pin: { ...corpus.pin, commitSha },
            specs: [{ ...fixture.spec, corpusSha: commitSha }], signal: controller.signal });
        } catch (error) { caught = error; }
        expect(caught).toBe(reason);
        expect(checks).toBe(3);
      },
    }),
  ],
});
