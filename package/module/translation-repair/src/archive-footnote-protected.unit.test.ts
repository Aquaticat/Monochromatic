import { tagged, } from '@monochromatic-dev/module-logger/ts';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { relabelArchiveFootnotes, } from '../dist/final/node/index.mjs';

const l = tagged({ tag: 'footnote-protected-original-test' });
const seal = '<!-- 以下内容原文为英文 -->';
const paired = [{ sourceLabel: '2', targetLabel: '1' }];
const sourceText = 'Source[^2].\n\n[^2]: Source note.';

await describe({
  name: 'protected archive footnote operations',
  children: [
    it({
      name: 'withholds the whole rename when a reference or definition belongs to an English original',
      fn: async () => {
        const archiveText = `Outside[^1].\n\n${seal}\nOriginal[^1].\n\n[^1]: Original note.`;
        const result = relabelArchiveFootnotes({ entryId: 'invented', slices: [], definitionPairs: paired, sourceText, archiveText, l });
        expect(result.archiveText).toBe(archiveText);
        expect(result.changed).toBe(false);
        expect(result.findings.some(finding => finding.includes('original'))).toBe(true);
      },
    }),
    it({
      name: 'withholds definition reordering even when all label correspondences are identities',
      fn: async () => {
        const archiveText = `Body[^1] and [^2].\n\n${seal}\n\n[^2]: Second original note.\n\n[^1]: First original note.`;
        const result = relabelArchiveFootnotes({ entryId: 'invented', slices: [],
          definitionPairs: [{ sourceLabel: '1', targetLabel: '1' }, { sourceLabel: '2', targetLabel: '2' }],
          sourceText: 'Body[^1] and [^2].\n\n[^1]: First source note.\n\n[^2]: Second source note.', archiveText, l });
        expect(result.archiveText).toBe(archiveText);
        expect(result.changed).toBe(false);
      },
    }),
    it({
      name: 'withholds a whole-page original instead of renaming its apparatus',
      fn: async () => {
        const archiveText = '<!-- Original language: English -->\n\nOriginal[^1].\n\n[^1]: Original note.';
        const result = relabelArchiveFootnotes({ entryId: 'invented', slices: [], definitionPairs: paired, sourceText, archiveText, l });
        expect(result.archiveText).toBe(archiveText);
        expect(result.changed).toBe(false);
      },
    }),
    it({
      name: 'allows a rename outside the protected span even when its offsets shift',
      fn: async () => {
        const archiveText = `Outside[^1].\n\n[^1]: Outer note.\n\n${seal}\nOriginal words.`;
        const result = relabelArchiveFootnotes({ entryId: 'invented', slices: [],
          definitionPairs: [{ sourceLabel: '22', targetLabel: '1' }],
          sourceText: 'Source[^22].\n\n[^22]: Source note.', archiveText, l });
        expect(result.archiveText).toBe(`Outside[^22].\n\n[^22]: Outer note.\n\n${seal}\nOriginal words.`);
        expect(result.changed).toBe(true);
      },
    }),
    it({
      name: 'leaves a protected no-op alone without requiring a rewrite',
      fn: async () => {
        const archiveText = `${seal}\nOriginal[^1].\n\n[^1]: Original note.`;
        const result = relabelArchiveFootnotes({ entryId: 'invented', slices: [],
          definitionPairs: [{ sourceLabel: '1', targetLabel: '1' }],
          sourceText: 'Source[^1].\n\n[^1]: Source note.', archiveText, l });
        expect(result.archiveText).toBe(archiveText);
        expect(result.changed).toBe(false);
      },
    }),
    it({
      name: 'retains unchanged archive bytes and a diagnostic when marker syntax cannot be established',
      fn: async () => {
        const archiveText = '<Component value={broken>\n\nOriginal[^1].\n\n[^1]: Note.';
        const result = relabelArchiveFootnotes({ entryId: 'invented', slices: [], definitionPairs: paired, sourceText, archiveText, l });
        expect(result.archiveText).toBe(archiveText);
        expect(result.changed).toBe(false);
        expect(result.findings.some(finding => finding.includes('syntax'))).toBe(true);
      },
    }),
  ],
});
