/**
 Tests for the coverage probe's read of one entry: both sides when both are
 there, and a skip, logged, when either is not.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import { readPair, } from '../../dist/final/node/index.mjs';
import { capturingLoggerPair, } from '../capturing-logger.test-fixture.ts';
import { makeProbeCorpus, } from './probes-b-built-command.test-fixture.ts';

await describe({
  name: readPair.name,
  children: [
    it({
      name: 'READS both sides of an entry that holds both, logging nothing',
      fn: async () => {
        await using corpus = await makeProbeCorpus({
          files: {
            'people/Mittens/page.md': 'zh Mittens\n',
            'people/Mittens/page.en.md': 'en Mittens\n',
          },
        },);
        const { logger, lines, } = capturingLoggerPair();

        expect(await readPair({
          pin: corpus.pin,
          entryId: 'Mittens',
          log: logger,
        },),).toEqual({
          kind: 'read',
          source: 'zh Mittens\n',
          target: 'en Mittens\n',
        },);
        expect(lines,).toEqual([],);
      },
    },),
    it({
      name: 'SKIPS an entry that lacks its translation, logging the refusal that said so',
      fn: async () => {
        await using corpus = await makeProbeCorpus({ files: { 'people/Mittens/page.md': 'zh Mittens\n', }, },);
        const { logger, lines, } = capturingLoggerPair();

        expect(await readPair({
          pin: corpus.pin,
          entryId: 'Mittens',
          log: logger,
        },),).toEqual({ kind: 'missing', },);
        expect(lines,).toEqual([
          `Mittens: skipped, CorpusReadError: corpus read failed for ${corpus.commitSha}:people/Mittens/page.en.md `
          + '(missing-object); check that the clone exists and the pinned commit is present.',
        ],);
      },
    },),
    it({
      name: 'SKIPS an entry that lacks its original, logging the refusal that said so',
      fn: async () => {
        await using corpus = await makeProbeCorpus({ files: { 'people/Mittens/page.en.md': 'en Mittens\n', }, },);
        const { logger, lines, } = capturingLoggerPair();

        expect(await readPair({
          pin: corpus.pin,
          entryId: 'Mittens',
          log: logger,
        },),).toEqual({ kind: 'missing', },);
        expect(lines,).toEqual([
          `Mittens: skipped, CorpusReadError: corpus read failed for ${corpus.commitSha}:people/Mittens/page.md `
          + '(missing-object); check that the clone exists and the pinned commit is present.',
        ],);
      },
    },),
  ],
},);
