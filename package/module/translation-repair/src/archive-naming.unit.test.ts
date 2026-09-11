import { describe, expect, it, } from '@monochromatic-dev/module-test/ts';
import {
  type ArchiveUseKind,
  readQualifiedArchiveNamingRevisions,
} from '../dist/final/node/index.mjs';
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
    describe({
      name: 'qualified naming revision acquisition',
      children: [
        it({
          name: 'joins exact immutable reference use to its automatically found whole-name revision',
          fn: async () => {
            await using fixture = await makeNamingArchive({});
            const use = namingUse({ archiveText: fixture.archiveText });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath, uses: [use],
            });
            expect(result.revisions).toHaveLength(1);
            expect(result.revisions[0]).toStrictEqual({
              archiveCommit: fixture.pin.commitSha,
              archivePath: fixture.relPath,
              originCommit: fixture.pin.commitSha,
              parentCommit: fixture.parentCommit,
              archiveHash: use.archiveHash,
              anchor: use.anchor,
              useKind: 'group-reference-name',
              reading: { configuredModelIds: use.configuredModelIds, ballots: use.ballots },
              currentLine: 1,
              pinnedLine: 1,
              originLine: 1,
              currentLineStartOffset: 0,
              currentLineText: AFTER_ARCHIVE.slice(0, -1),
              pinnedHasFinalNewline: true,
              lineTerminated: true,
              previousLineText: BEFORE_ARCHIVE.slice(0, -1),
              previousFragment: '星猫亭',
              currentFragment: NAME_QUOTE,
            });
          },
        }),
        ...(['person-reference-name', 'place-reference-name'] as const).map(kind => it({
          name: `qualifies ${kind} without declaring an official identity`,
          fn: async () => {
            const prefix = kind === 'person-reference-name' ? 'She met ' : 'She rested at ';
            await using fixture = await makeNamingArchive({
              before: `${prefix}星猫亭.\n`, after: `${prefix}${NAME_QUOTE}.\n`,
            });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [namingUse({ archiveText: fixture.archiveText, kind })],
            });
            expect(result.revisions[0]?.useKind).toBe(kind);
          },
        })),
        ...(['creative-work-title', 'mentioned-form', 'ordinary-prose', 'unresolved'] satisfies ArchiveUseKind[])
          .map(kind => it({
            name: `withholds ${kind} despite an exact historical replacement`,
            fn: async () => {
              await using fixture = await makeNamingArchive({});
              const result = await readQualifiedArchiveNamingRevisions({
                pin: fixture.pin, relPath: fixture.relPath,
                uses: [namingUse({ archiveText: fixture.archiveText, kind })],
              });
              expect(result.revisions).toHaveLength(0);
            },
          })),
        it({
          name: 'does no Git work when no initial uses are supplied',
          fn: async () => {
            const result = await readQualifiedArchiveNamingRevisions({
              pin: { cloneDir: '/nonexistent-unused-naming-fixture', commitSha: 'unused' },
              relPath: 'unused.en.md', uses: [],
            });
            expect(result).toStrictEqual({ revisions: [], findings: [] });
          },
        }),
      ],
    }),
    describe({
      name: 'independent use corroboration',
      children: [
        it({
          name: 'does not replace six-of-eleven evidence quorum with two-reader pair agreement',
          fn: async () => {
            await using fixture = await makeNamingArchive({});
            const use = namingUse({ archiveText: fixture.archiveText });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [{ ...use, ballots: use.ballots.slice(0, 2) }],
            });
            expect(result.revisions).toHaveLength(0);
            expect(result.findings.length).toBeGreaterThan(0);
          },
        }),
        it({
          name: 'does not count duplicated model identities as independent support',
          fn: async () => {
            await using fixture = await makeNamingArchive({});
            const use = namingUse({ archiveText: fixture.archiveText });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [{ ...use, ballots: use.ballots.map(() => ({ modelId: 'reader-0', kind: 'group-reference-name' })) }],
            });
            expect(result.revisions).toHaveLength(0);
          },
        }),
        it({
          name: 'retains a quorum-backed reference despite an ordinary-prose dissenter',
          fn: async () => {
            await using fixture = await makeNamingArchive({});
            const use = namingUse({ archiveText: fixture.archiveText });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [{ ...use, ballots: [...use.ballots, { modelId: 'reader-6', kind: 'ordinary-prose' }] }],
            });
            expect(result.revisions).toHaveLength(1);
          },
        }),
        it({
          name: 'withholds conflicting kinds that each reach the configured quorum',
          fn: async () => {
            await using fixture = await makeNamingArchive({});
            const use = namingUse({ archiveText: fixture.archiveText });
            const configuredModelIds = Array.from({ length: 12 }, (_value, index) => `reader-${index}`);
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [{ ...use, configuredModelIds,
                ballots: configuredModelIds.map((modelId, index) => ({ modelId,
                  kind: index < 6 ? 'group-reference-name' : 'person-reference-name' })),
              }],
            });
            expect(result.revisions).toHaveLength(0);
          },
        }),
      ],
    }),
    describe({
      name: 'complete occurrence qualification',
      children: [
        ...[
          { name: 'role-only change', before: `She owned ${NAME_QUOTE}.\n`, after: AFTER_ARCHIVE },
          { name: 'partial name change', before: 'She joined *Starlit Paw*.\n', after: AFTER_ARCHIVE },
          { name: 'name and surrounding role change', before: 'She owned 星猫亭.\n', after: AFTER_ARCHIVE },
          { name: 'adjacent multi-line replacement', before: `${BEFORE_ARCHIVE}She drank tea.\n`,
            after: `${AFTER_ARCHIVE}She drank milk.\n` },
        ].map(({ name, before, after }) => it({
          name: `withholds ${name} rather than labeling the whole change as naming`,
          fn: async () => {
            await using fixture = await makeNamingArchive({ before, after });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [namingUse({ archiveText: fixture.archiveText })],
            });
            expect(result.revisions).toHaveLength(0);
          },
        })),
        it({
          name: 'does not split a shared surrogate prefix into a false partial-name change',
          fn: async () => {
            await using fixture = await makeNamingArchive({ before: 'She joined 🐈.\n', after: 'She joined 🐕.\n' });
            const result = await readQualifiedArchiveNamingRevisions({
              pin: fixture.pin, relPath: fixture.relPath,
              uses: [namingUse({ archiveText: fixture.archiveText, quotedText: '🐕' })],
            });
            expect(result.revisions[0]?.previousFragment).toBe('🐈');
            expect(result.revisions[0]?.currentFragment).toBe('🐕');
          },
        }),
      ],
    }),
  ],
});
