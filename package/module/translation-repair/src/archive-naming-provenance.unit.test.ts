import { mkdir, writeFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  listCorpusPeople,
  readCorpusBytes,
  readCorpusFile,
  readQualifiedArchiveNamingRevisions,
} from '../dist/final/node/index.mjs';
import {
  AFTER_ARCHIVE,
  BEFORE_ARCHIVE,
  commitNamingArchive,
  makeNamingArchive,
  namingFixtureGit,
  namingUse,
} from './archive-naming.test-fixture.ts';

await describe({
  name: '',
  concurrency: 1,
  children: [
    it({
      name: 'reads physical pinned text, bytes and listings despite a replacement ref changing only visible EOF',
      fn: async () => {
        await using fixture = await makeNamingArchive({
          before: BEFORE_ARCHIVE.trimEnd(),
          after: AFTER_ARCHIVE.trimEnd(),
        });
        const {cloneDir} = fixture.pin;
        const extraPath = 'people/extra-cat/page.en.md';
        await mkdir(join(cloneDir, 'people/extra-cat'), { recursive: true });
        await writeFile(join(cloneDir, extraPath), 'Another invented cat.\n');
        await namingFixtureGit({ cloneDir, args: ['add', '--', extraPath] });
        const replacement = await commitNamingArchive({ cloneDir, relPath: fixture.relPath, text: AFTER_ARCHIVE });
        await namingFixtureGit({ cloneDir, args: ['replace', fixture.pin.commitSha, replacement] });
        expect(await readCorpusFile({ pin: fixture.pin, relPath: fixture.relPath })).toBe(AFTER_ARCHIVE.trimEnd());
        const bytes = await readCorpusBytes({ pin: fixture.pin, relPath: fixture.relPath });
        expect(new TextDecoder().decode(bytes)).toBe(AFTER_ARCHIVE.trimEnd());
        expect(await listCorpusPeople({ pin: fixture.pin })).toEqual(['starlit-cat']);
        const result = await readQualifiedArchiveNamingRevisions({
          pin: fixture.pin,
          relPath: fixture.relPath,
          uses: [namingUse({ archiveText: fixture.archiveText })],
        });
        expect(result.revisions).toHaveLength(1);
      },
    }),
    ...[
      { name: 'adds EOF newline', before: BEFORE_ARCHIVE.trimEnd(), after: AFTER_ARCHIVE },
      { name: 'removes EOF newline', before: BEFORE_ARCHIVE, after: AFTER_ARCHIVE.trimEnd() },
    ].map(({ name, before, after }) => it({
      name: `withholds a naming hunk that also ${name}`,
      fn: async () => {
        await using fixture = await makeNamingArchive({ before, after });
        const result = await readQualifiedArchiveNamingRevisions({
          pin: fixture.pin,
          relPath: fixture.relPath,
          uses: [namingUse({ archiveText: fixture.archiveText })],
        });
        expect(result.revisions).toHaveLength(0);
      },
    })),
    it({
      name: 'ignores a graft that falsely makes an unrelated naming revision an ancestor',
      fn: async () => {
        const suffix = '\nAnother invented fact.\n';
        await using fixture = await makeNamingArchive({ before: AFTER_ARCHIVE, after: AFTER_ARCHIVE + suffix });
        const {cloneDir} = fixture.pin;
        const beforeCommit = await commitNamingArchive({ cloneDir, relPath: fixture.relPath, text: BEFORE_ARCHIVE + suffix });
        const beforeTree = await namingFixtureGit({ cloneDir, args: ['rev-parse', `${beforeCommit}^{tree}`] });
        const afterTree = await namingFixtureGit({ cloneDir, args: ['rev-parse', `${fixture.pin.commitSha}^{tree}`] });
        const unrelatedParent = await namingFixtureGit({ cloneDir, args: ['commit-tree', beforeTree, '--message', 'unrelated predecessor'] });
        const unrelatedNaming = await namingFixtureGit({ cloneDir, args: ['commit-tree', afterTree, '-p', unrelatedParent, '--message', 'unrelated naming'] });
        await writeFile(join(cloneDir, '.git/info/grafts'), `${fixture.pin.commitSha} ${unrelatedNaming}\n`);
        // Positive control: ordinary native blame really follows the fabricated graph.
        const ordinary = await namingFixtureGit({ cloneDir,
          args: ['blame', '--line-porcelain', fixture.pin.commitSha, '--', fixture.relPath],
        });
        expect(ordinary).toContain(unrelatedNaming);
        const result = await readQualifiedArchiveNamingRevisions({
          pin: fixture.pin,
          relPath: fixture.relPath,
          uses: [namingUse({ archiveText: fixture.archiveText })],
        });
        expect(result.revisions).toHaveLength(0);
      },
    }),
  ],
});
