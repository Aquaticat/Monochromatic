import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import { readQualifiedArchiveNamingRevisions, } from '../dist/final/node/index.mjs';
import {
  AFTER_ARCHIVE,
  BEFORE_ARCHIVE,
  makeNamingArchive,
  NAME_QUOTE,
  namingUse,
} from './archive-naming.test-fixture.ts';

await describe({
  name: '',
  children: [
    ...['', '(To-Do)\n\n'].map(prefix => it({
      name: `keeps distinct duplicate-line origins${prefix === '' ? '' : ' after stub stripping'}`,
      fn: async () => {
        await using fixture = await makeNamingArchive({
          before: `${prefix}${AFTER_ARCHIVE}\n${BEFORE_ARCHIVE}`,
          after: `${prefix}${AFTER_ARCHIVE}\n${AFTER_ARCHIVE}`,
        });
        const first = namingUse({ archiveText: fixture.archiveText });
        const second = namingUse({ archiveText: fixture.archiveText,
          startOffset: fixture.archiveText.lastIndexOf(NAME_QUOTE),
        });
        const result = await readQualifiedArchiveNamingRevisions({
          pin: fixture.pin, relPath: fixture.relPath, uses: [second, first],
        });
        // The first identical line originated at the root, while the second is a real replacement.
        expect(result.revisions).toHaveLength(1);
        expect(result.revisions[0]?.anchor).toStrictEqual(second.anchor);
        expect(result.revisions[0]?.currentLine).toBe(3);
        expect(result.revisions[0]?.pinnedLine).toBe(prefix === '' ? 3 : 5);
      },
    })),
    ...[
      { name: 'CRLF', suffix: '\r\n' },
      { name: 'bare CR at EOF', suffix: '\r' },
      { name: 'no newline', suffix: '' },
    ].map(({ name, suffix }) => it({
      name: `preserves a same-ending replacement with ${name}`,
      fn: async () => {
        await using fixture = await makeNamingArchive({
          before: BEFORE_ARCHIVE.trimEnd() + suffix,
          after: AFTER_ARCHIVE.trimEnd() + suffix,
        });
        const result = await readQualifiedArchiveNamingRevisions({
          pin: fixture.pin, relPath: fixture.relPath,
          uses: [namingUse({ archiveText: fixture.archiveText })],
        });
        expect(result.revisions).toHaveLength(1);
        expect(result.revisions[0]?.pinnedHasFinalNewline).toBe(suffix.endsWith('\n'));
        expect(result.revisions[0]?.currentLineText).toBe(fixture.archiveText.endsWith('\n')
          ? fixture.archiveText.slice(0, -1) : fixture.archiveText);
      },
    })),
    it({
      name: 'normalizes zero-width prefix characters without relocating the initial occurrence by name',
      fn: async () => {
        await using fixture = await makeNamingArchive({
          before: `(To-Do)\n\n\u200BShe joined 星猫亭.\n`,
          after: `(To-Do)\n\n\u200BShe joined ${NAME_QUOTE}.\n`,
        });
        const use = namingUse({ archiveText: fixture.archiveText });
        const result = await readQualifiedArchiveNamingRevisions({
          pin: fixture.pin, relPath: fixture.relPath, uses: [use],
        });
        expect(result.revisions).toHaveLength(1);
        expect(result.revisions[0]?.anchor).toStrictEqual(use.anchor);
        expect(result.revisions[0]?.pinnedLine).toBe(3);
        expect(result.revisions[0]?.currentLine).toBe(1);
      },
    }),
  ],
});
