/**
 Tests the reference attestation verdicts (ledger B25): an item is kept as
 answered when the reference it names states its quote, kept under the first
 reference that does when the named one does not, and dropped with the side
 not found otherwise; every verdict has a log line.

 Cat-themed invention throughout; no corpus content appears here.

 @module
 */

import {
  describe,
  expect,
  it,
} from '@monochromatic-dev/module-test/ts';

import {
  type AttestationVerdict,
  attestationVerdictLine,
  attestationVerdicts,
  keptAttestations,
  SEAT_SYNTHETIC_TEXT_EVERYWHERE,
} from '../dist/final/node/index.mjs';

/**
 Voice answering every item.
 */
const VOICE = SEAT_SYNTHETIC_TEXT_EVERYWHERE;

/**
 Invented archive.
 */
const ARCHIVE_TEXT = 'Mittens has a younger brother who also sits by the stove.\nShe wears a bell.\n';

/**
 Two fetched pages; both have the brother, only the second has the stove.
 */
const REFERENCE_CONTEXT = '- reference 1 https://cats.example/a ("A"): Mittens had a younger brother.\n'
  + '- reference 2 https://cats.example/b ("B"): Mittens had a younger brother who also sat by the stove.';

/**
 Archive quote carrying the stove.
 */
const STOVE_ARCHIVE = 'Mittens has a younger brother who also sits by the stove.';

/**
 Reference quote only the second page states.
 */
const STOVE_REFERENCE = 'Mittens had a younger brother who also sat by the stove.';

/**
 Reference quote both pages state.
 */
const BROTHER_REFERENCE = 'Mittens had a younger brother';

/**
 Verdict on one item against the two pages.

 @param reference - reference the item names

 @param archiveQuote - archive words quoted

 @param referenceQuote - reference words quoted

 @returns Verdict

 @example
 ```ts
 verdictFor({ reference: 2, archiveQuote: STOVE_ARCHIVE, referenceQuote: STOVE_REFERENCE, },);
 ```
 */
function verdictFor(
  {
    reference,
    archiveQuote,
    referenceQuote,
  }: {
    readonly reference: number;
    readonly archiveQuote: string;
    readonly referenceQuote: string;
  },
): AttestationVerdict {
  /**
   The one verdict.
   */
  const [verdict,] = attestationVerdicts({
    modelId: VOICE,
    items: [{
      archiveQuote,
      reference,
      referenceQuote,
    },],
    archiveText: ARCHIVE_TEXT,
    referenceContext: REFERENCE_CONTEXT,
  },);
  if (verdict === undefined)
    throw new Error('one item gave no verdict',);
  return verdict;
}

await describe({
  name: 'reference attestation verdicts (ledger B25)',
  children: [
    it({
      name: 'KEEPS AS ANSWERED an item whose named reference states its quote, even when another does too',
      fn: async () => {
        expect(verdictFor({
          reference: 2,
          archiveQuote: STOVE_ARCHIVE,
          referenceQuote: STOVE_REFERENCE,
        },),).toEqual({
          kind: 'verified',
          attestation: {
            modelId: VOICE,
            item: {
              archiveQuote: STOVE_ARCHIVE,
              reference: 2,
              referenceQuote: STOVE_REFERENCE,
            },
          },
        },);
        expect(verdictFor({
          reference: 2,
          archiveQuote: 'Mittens has a younger brother',
          referenceQuote: BROTHER_REFERENCE,
        },).kind,).toBe('verified',);
      },
    },),
    it({
      name: 'RELABELS an item whose named reference does not state its quote to the first that does, '
        + 'whether the named one exists or not',
      fn: async () => {
        expect(verdictFor({
          reference: 1,
          archiveQuote: STOVE_ARCHIVE,
          referenceQuote: STOVE_REFERENCE,
        },),).toEqual({
          kind: 'relabelled',
          attestation: {
            modelId: VOICE,
            item: {
              archiveQuote: STOVE_ARCHIVE,
              reference: 2,
              referenceQuote: STOVE_REFERENCE,
            },
          },
          answered: 1,
        },);
        /**
         Item naming a reference the block does not have.
         */
        const absent = verdictFor({
          reference: 5,
          archiveQuote: 'Mittens has a younger brother',
          referenceQuote: BROTHER_REFERENCE,
        },);
        expect(absent.kind,).toBe('relabelled',);
        expect((absent.kind === 'relabelled') ? absent.attestation.item.reference : 0,).toBe(1,);
      },
    },),
    it({
      name: 'DROPS an item with a quote not found, and says which side was not found',
      fn: async () => {
        expect(verdictFor({
          reference: 2,
          archiveQuote: 'Mittens has a little brother who sits by the stove too.',
          referenceQuote: STOVE_REFERENCE,
        },),).toEqual({
          kind: 'dropped',
          modelId: VOICE,
          item: {
            archiveQuote: 'Mittens has a little brother who sits by the stove too.',
            reference: 2,
            referenceQuote: STOVE_REFERENCE,
          },
          archiveFound: false,
          referenceFound: true,
        },);
        /**
         Item whose reference quote runs from the first line into the second.
         */
        const bridged = verdictFor({
          reference: 1,
          archiveQuote: 'She wears a bell.',
          referenceQuote: 'a younger brother. - reference 2',
        },);
        expect(bridged.kind,).toBe('dropped',);
        expect((bridged.kind === 'dropped') && bridged.archiveFound && (!bridged.referenceFound),).toBe(true,);
        /**
         Items against a block with no references at all.
         */
        const unlinked = attestationVerdicts({
          modelId: VOICE,
          items: [{
            archiveQuote: STOVE_ARCHIVE,
            reference: 1,
            referenceQuote: STOVE_REFERENCE,
          },],
          archiveText: ARCHIVE_TEXT,
          referenceContext: '',
        },);
        expect(unlinked.map(function kindOf(verdict,): string {
          return verdict.kind;
        },),).toEqual(['dropped',],);
      },
    },),
    it({
      name: 'KEEPS the verified and relabelled items in answer order and leaves out the dropped',
      fn: async () => {
        /**
         Three items: relabelled, dropped, verified.
         */
        const verdicts = attestationVerdicts({
          modelId: VOICE,
          items: [
            {
              archiveQuote: STOVE_ARCHIVE,
              reference: 1,
              referenceQuote: STOVE_REFERENCE,
            },
            {
              archiveQuote: 'She wears a bell.',
              reference: 1,
              referenceQuote: 'Mittens wore a bell.',
            },
            {
              archiveQuote: 'Mittens has a younger brother',
              reference: 1,
              referenceQuote: BROTHER_REFERENCE,
            },
          ],
          archiveText: ARCHIVE_TEXT,
          referenceContext: REFERENCE_CONTEXT,
        },);
        expect(keptAttestations({ verdicts, },).map(function numberOf(entry,): string {
          return `${entry.item.archiveQuote}@${String(entry.item.reference,)}`;
        },),).toEqual([`${STOVE_ARCHIVE}@2`, 'Mittens has a younger brother@1',],);
      },
    },),
    it({
      name: 'LOGS every verdict: the kept item as the sheets credit it, the number answered when relabelled, '
        + 'and the side not found when dropped',
      fn: async () => {
        expect(attestationVerdictLine({
          verdict: verdictFor({
            reference: 2,
            archiveQuote: STOVE_ARCHIVE,
            referenceQuote: STOVE_REFERENCE,
          },),
        },),).toBe(`ATTESTED item ${VOICE}: "${STOVE_ARCHIVE}" is stated by reference 2 ("${STOVE_REFERENCE}")`,);
        expect(attestationVerdictLine({
          verdict: verdictFor({
            reference: 1,
            archiveQuote: STOVE_ARCHIVE,
            referenceQuote: STOVE_REFERENCE,
          },),
        },),).toBe(
          `ATTESTED item ${VOICE} (answered reference 1): "${STOVE_ARCHIVE}" is stated by reference 2 ("${STOVE_REFERENCE}")`,
        );
        expect(attestationVerdictLine({
          verdict: verdictFor({
            reference: 1,
            archiveQuote: 'She wears a bell.',
            referenceQuote: 'Mittens wore a bell.',
          },),
        },),).toBe(
          `ATTESTED dropped ${VOICE}: archive quote found, reference quote not found under any reference: `
            + '"She wears a bell." against reference 1 ("Mittens wore a bell.")',
        );
        expect(attestationVerdictLine({
          verdict: verdictFor({
            reference: 2,
            archiveQuote: 'Mittens has a little brother.',
            referenceQuote: STOVE_REFERENCE,
          },),
        },),).toContain('archive quote not found, reference quote found:',);
      },
    },),
  ],
},);
