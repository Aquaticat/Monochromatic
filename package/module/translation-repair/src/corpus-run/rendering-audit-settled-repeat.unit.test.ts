/**
 * Tests for the repeat pairings and the band `#115` reads off them.
 *
 * The band exists because the headline of `#115` is a comparison, and a
 * comparison resolves nothing narrower than the spread the instrument moves
 * through on unchanged input. The sharpest cases here are the REFUSALS, since
 * a pairing that should not have happened reports a band narrower than the
 * truth and makes every comparison look better resolved than it is: two rows
 * that merely share a slot, two rows whose text moved, and two rows that
 * predate the recorded identity and would otherwise pair through their shared
 * absence.
 *
 * Fixtures are cat-themed invention. No corpus content appears here.
 *
 * @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  auditRepeatsAcross,
  auditRepeatsWithin,
  digestAuditedText,
  repeatBandOf,
  sameAuditedText,
  type SettledAuditRow,
  textIdentityOf,
} from '../../dist/final/node/index.mjs';

/**
 * Builds one audited slice carrying a stated number of anchored claims.
 *
 * @param runSet - archive subdirectory
 *
 * @param entryId - corpus entry
 *
 * @param chunkIndex - slice index
 *
 * @param claims - how many claims anchored, over one voice
 *
 * @param texts - what the audit was shown, omitted to leave it unrecorded
 *
 * @returns Row shaped as the probe persists it
 *
 * @example
 * ```ts
 * const row = rowFor({ runSet: 'first', entryId: 'mittens', chunkIndex: 0, claims: 1, },);
 * ```
 */
function rowFor(
  {
    runSet,
    entryId,
    chunkIndex,
    claims,
    texts,
  }: {
    readonly runSet: string;
    readonly entryId: string;
    readonly chunkIndex: number;
    readonly claims: number;
    readonly texts?: {
      readonly sourceText: string;
      readonly candidateText: string;
    };
  },
): SettledAuditRow {
  return {
    runSet,
    entryId,
    chunkIndex,
    deliveryKind: 'replacement-shipped',
    auditsArchiveText: false,
    artifactDigest: 'sha256-tree-v1:cafef00d',
    corpusSha: 'b'.repeat(40,),
    identityKind: 'declared',
    ...((texts === undefined) ? {} : { textIdentity: digestAuditedText(texts,), }),
    report: {
      corroborated: [],
      agreed: [],
      near: [],
      findings: [],
      rows: [{
        modelId: 'hf:cat/Tabby-1',
        verdict: (claims === 0) ? 'no-defect-found' : 'defects-found',
        findings: Array.from(
          { length: claims, },
          function asFinding(): Record<string, unknown> {
            return {
              category: 'omission',
              source: { kind: 'unused', },
              candidate: { kind: 'unused', },
              reason: 'the cat left',
            };
          },
        ),
        dropped: [],
      },],
    },
  } as unknown as SettledAuditRow;
}

/**
 * One pair of texts, used wherever two rows are meant to match.
 */
const SAME_TEXTS = {
  sourceText: '毛毛跳上窗台。',
  candidateText: 'Mittens jumped onto the windowsill.',
} as const;

/**
 * A different rendering of the same original.
 */
const OTHER_TEXTS = {
  sourceText: '毛毛跳上窗台。',
  candidateText: 'Mittens hopped up on the sill.',
} as const;

await describe({
  name: digestAuditedText.name,
  children: [
    it({
      name: 'DIGESTS BOTH SIDES SEPARATELY, so a pair whose original matches and whose rendering '
        + 'does not is a comparison of two renderings rather than two readings of one text',
      fn: async () => {
        /**
         * Same original, different English.
         */
        const mine = digestAuditedText(SAME_TEXTS,);

        /**
         * The other rendering.
         */
        const theirs = digestAuditedText(OTHER_TEXTS,);

        expect(mine.kind,).toBe('digested',);
        if (mine.kind !== 'digested' || theirs.kind !== 'digested')
          throw new Error('both fixtures are digested by construction',);
        expect(mine.source,).toBe(theirs.source,);
        expect(mine.candidate,).not.toBe(theirs.candidate,);
      },
    },),

    it({
      name: 'CARRIES NO TEXT, since a run file is read, grepped and quoted into docs while the '
        + 'corpus itself goes only to the production provider',
      fn: async () => {
        /**
         * What lands on the row.
         */
        const identity = digestAuditedText(SAME_TEXTS,);
        if (identity.kind !== 'digested')
          throw new Error('digested by construction',);

        expect(identity.source.includes('毛毛',),).toBe(false,);
        expect(identity.candidate.includes('Mittens',),).toBe(false,);
        expect(identity.source.startsWith('sha256-audited-v1:',),).toBe(true,);
      },
    },),
  ],
},);

await describe({
  name: textIdentityOf.name,
  children: [
    it({
      name: 'REPORTS AN OLDER ROW AS UNRECORDED rather than throwing, because a run persisted '
        + 'before this field existed still answers every other reading',
      fn: async () => {
        expect(textIdentityOf({
          row: rowFor({
            runSet: 'first',
            entryId: 'mittens',
            chunkIndex: 0,
            claims: 1,
          },),
        },).kind,).toBe('unrecorded',);
      },
    },),
  ],
},);

await describe({
  name: sameAuditedText.name,
  children: [
    it({
      name: 'REFUSES TO MATCH TWO UNRECORDED ROWS, which is the whole reason the field is a tagged '
        + 'union: comparing two absences for equality would pair rows by their shared lack of '
        + 'evidence and read every such pair as one text audited twice',
      fn: async () => {
        /**
         * Two rows from a run that predates the field.
         */
        const left = rowFor({
          runSet: 'first',
          entryId: 'mittens',
          chunkIndex: 0,
          claims: 1,
        },);

        /**
         * Its counterpart.
         */
        const right = rowFor({
          runSet: 'second',
          entryId: 'mittens',
          chunkIndex: 0,
          claims: 4,
        },);

        expect(sameAuditedText({
          left,
          right,
        },),).toBe(false,);
      },
    },),
  ],
},);

await describe({
  name: auditRepeatsWithin.name,
  children: [
    it({
      name: 'PAIRS ONE TEXT AUDITED TWICE across two run sets of one entry, which is the free '
        + 'repeat two artifacts of one entry already contain',
      fn: async () => {
        /**
         * Same slice of one entry, settled twice, carrying the same characters.
         */
        const pairs = auditRepeatsWithin({
          rows: [
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 1,
              texts: SAME_TEXTS,
            },),
            rowFor({
              runSet: 'second',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 4,
              texts: SAME_TEXTS,
            },),
          ],
        },);

        expect(pairs.length,).toBe(1,);
        expect(pairs[0]?.entryId,).toBe('mittens',);
        expect(pairs[0]?.left.claimed,).toBe(1,);
        expect(pairs[0]?.right.claimed,).toBe(4,);
      },
    },),

    it({
      name: 'REFUSES TO PAIR A SLOT WHOSE TEXT DIFFERS, because two artifacts of one entry can '
        + 'agree on the original and ship different English there, and reading that as a repeat '
        + 'would report a spread the instrument never showed',
      fn: async () => {
        expect(auditRepeatsWithin({
          rows: [
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 1,
              texts: SAME_TEXTS,
            },),
            rowFor({
              runSet: 'second',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 4,
              texts: OTHER_TEXTS,
            },),
          ],
        },).length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES TO PAIR TWO ROWS OF ONE RUN SET, since a run set holds each slice once and a '
        + 'pair inside it would have to be the same row against itself',
      fn: async () => {
        expect(auditRepeatsWithin({
          rows: [
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 1,
              texts: SAME_TEXTS,
            },),
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 4,
              texts: SAME_TEXTS,
            },),
          ],
        },).length,).toBe(0,);
      },
    },),

    it({
      name: 'REFUSES EVERY PAIR IN A RUN THAT RECORDED NO TEXT IDENTITY, so an older run reports '
        + 'no band at all rather than a band built from slot equality',
      fn: async () => {
        expect(auditRepeatsWithin({
          rows: [
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 1,
            },),
            rowFor({
              runSet: 'second',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 4,
            },),
          ],
        },).length,).toBe(0,);
      },
    },),
  ],
},);

await describe({
  name: auditRepeatsAcross.name,
  children: [
    it({
      name: 'PAIRS TWO RUNS SUBJECT BY SUBJECT, keyed on the run set as well as the entry and the '
        + 'slice so two artifacts of one entry are never crossed with each other',
      fn: async () => {
        /**
         * One subject, bought by two runs.
         */
        const {
          paired,
          textMoved,
        } = auditRepeatsAcross({
          first: [rowFor({
            runSet: 'first',
            entryId: 'mittens',
            chunkIndex: 0,
            claims: 1,
            texts: SAME_TEXTS,
          },),],
          second: [rowFor({
            runSet: 'first',
            entryId: 'mittens',
            chunkIndex: 0,
            claims: 5,
            texts: SAME_TEXTS,
          },),],
        },);

        expect(paired.length,).toBe(1,);
        expect(textMoved.length,).toBe(0,);
        expect(paired[0]?.left.claimed,).toBe(1,);
        expect(paired[0]?.right.claimed,).toBe(5,);
      },
    },),

    it({
      name: 'NAMES A SLOT WHOSE TEXT MOVED instead of pairing it, because the archive changing '
        + 'between two runs invalidates that subject as a band measurement and is worth knowing',
      fn: async () => {
        /**
         * Same slot, different rendering, which means the archive moved.
         */
        const {
          paired,
          textMoved,
        } = auditRepeatsAcross({
          first: [rowFor({
            runSet: 'first',
            entryId: 'mittens',
            chunkIndex: 3,
            claims: 1,
            texts: SAME_TEXTS,
          },),],
          second: [rowFor({
            runSet: 'first',
            entryId: 'mittens',
            chunkIndex: 3,
            claims: 5,
            texts: OTHER_TEXTS,
          },),],
        },);

        expect(paired.length,).toBe(0,);
        expect(textMoved,).toEqual(['first/mittens#3',],);
      },
    },),

    it({
      name: 'DROPS A SUBJECT ONLY ONE RUN BOUGHT, since a capped run holds a prefix of the other '
        + 'and inventing a side for the rest would report a gap nobody measured',
      fn: async () => {
        expect(auditRepeatsAcross({
          first: [
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 0,
              claims: 1,
              texts: SAME_TEXTS,
            },),
            rowFor({
              runSet: 'first',
              entryId: 'mittens',
              chunkIndex: 1,
              claims: 2,
              texts: SAME_TEXTS,
            },),
          ],
          second: [rowFor({
            runSet: 'first',
            entryId: 'mittens',
            chunkIndex: 0,
            claims: 3,
            texts: SAME_TEXTS,
          },),],
        },).paired.length,).toBe(1,);
      },
    },),
  ],
},);

await describe({
  name: repeatBandOf.name,
  children: [
    it({
      name: 'REPORTS ZERO PAIRS AS ZERO PAIRS, which the printer turns into a refusal to quote a '
        + 'band rather than into a row of zeroes that reads as perfect agreement',
      fn: async () => {
        expect(repeatBandOf({ pairs: [], },).pairs,).toBe(0,);
        expect(repeatBandOf({ pairs: [], },).widest,).toBe(0,);
      },
    },),

    it({
      name: 'MEASURES THE GAP IN BOTH DIRECTIONS, because neither side of a repeat is the '
        + 'reference: both are single readings of one text and calling either correct is the '
        + 'assumption the measurement exists to avoid',
      fn: async () => {
        /**
         * Two repeats, one where the later run claimed more and one where it claimed less.
         */
        const band = repeatBandOf({
          pairs: auditRepeatsWithin({
            rows: [
              rowFor({
                runSet: 'first',
                entryId: 'mittens',
                chunkIndex: 0,
                claims: 1,
                texts: SAME_TEXTS,
              },),
              rowFor({
                runSet: 'second',
                entryId: 'mittens',
                chunkIndex: 0,
                claims: 5,
                texts: SAME_TEXTS,
              },),
              rowFor({
                runSet: 'first',
                entryId: 'mittens',
                chunkIndex: 1,
                claims: 3,
                texts: OTHER_TEXTS,
              },),
              rowFor({
                runSet: 'second',
                entryId: 'mittens',
                chunkIndex: 1,
                claims: 1,
                texts: OTHER_TEXTS,
              },),
            ],
          },),
        },);

        expect(band.pairs,).toBe(2,);
        expect(band.widest,).toBe(4,);
        expect(band.totalGap,).toBe(6,);
        expect(band.agreedExactly,).toBe(0,);
      },
    },),

    it({
      name: 'COUNTS THE PAIRS WHERE ONE AUDIT WAS SILENT AND THE OTHER WAS NOT, which is the '
        + 'sharpest form of the spread: a gate reading "claimed at least one" would flip on those '
        + 'subjects for no reason in the text',
      fn: async () => {
        /**
         * One repeat where a voice went quiet, one where both spoke.
         */
        const band = repeatBandOf({
          pairs: auditRepeatsWithin({
            rows: [
              rowFor({
                runSet: 'first',
                entryId: 'mittens',
                chunkIndex: 0,
                claims: 0,
                texts: SAME_TEXTS,
              },),
              rowFor({
                runSet: 'second',
                entryId: 'mittens',
                chunkIndex: 0,
                claims: 2,
                texts: SAME_TEXTS,
              },),
              rowFor({
                runSet: 'first',
                entryId: 'mittens',
                chunkIndex: 1,
                claims: 2,
                texts: OTHER_TEXTS,
              },),
              rowFor({
                runSet: 'second',
                entryId: 'mittens',
                chunkIndex: 1,
                claims: 2,
                texts: OTHER_TEXTS,
              },),
            ],
          },),
        },);

        expect(band.silentOnOneSide,).toBe(1,);
        expect(band.agreedExactly,).toBe(1,);
      },
    },),
  ],
},);
