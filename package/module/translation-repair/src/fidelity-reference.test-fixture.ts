import {
  alterSharedNumber,
  type DamageAttempt,
  deleteOneSentence,
  type FidelityReferenceSpec,
  foldInvisibleVariants,
  hashContent,
  insertBorrowedSentence,
} from '../dist/final/node/index.mjs';

//region Invented reviewed-reference fixtures
// These strings are authored test data, never copied corpus passages.

/**
 * Width of the invented SHA-1 pin used by non-I/O fixture checks.
 */
const FIXTURE_COMMIT_WIDTH = 40;

/**
 * Invented source carrying the deliberately shared year.
 */
export const REVIEW_SOURCE: string = '2023年，灰白相间的小猫搬到旧书店楼上的安静公寓。她每天早上浇灌窗边的花，'
  + '晚上在图书馆读书。她喜欢与邻居分享故事，也喜欢给来访的朋友准备茶点。书店里的角落明亮而温暖，'
  + '朋友们常在那里讨论书籍和花园。她认真保管明信片，记得每位朋友喜欢的图案。';

/**
 * Source-faithful invented reference naturally exceeding the calibration floor.
 */
export const REVIEW_REFERENCE: string = 'The grey-and-white cat arrived in 2023 and moved into a quiet flat above the old bookshop. '
  + 'Every morning she watered the flowers beside the window, and every evening she read at the library. '
  + 'She enjoyed sharing stories with her neighbours and preparing tea and snacks for visiting friends. '
  + 'The well-lit corner of the bookshop was warm, and her friends often discussed books and gardens there. '
  + 'She carefully kept their postcards and remembered the patterns each friend liked.';

/**
 * Independent invented donor supplying one unsupported but fluent statement.
 */
export const REVIEW_DONOR: string = 'On a winter holiday she travelled to a distant village and spent the afternoon learning how its bakers made bread.';

/**
 * Narrows a fixture builder result without pretending an undamageable case is usable.
 *
 * @param damage - builder output for invented content
 *
 * @returns Definite fixture mutation
 *
 * @example
 * ```ts
 * const built = fixtureDamage(deleteOneSentence({ cleanText }));
 * ```
 */
function fixtureDamage(damage: DamageAttempt,): Extract<DamageAttempt, { readonly kind: 'damaged'; }> {
  if (damage.kind !== 'damaged')
    throw new Error('Invented reference fixture must admit its specified mutation',);
  return damage;
}

/**
 * Builds disjoint original-coordinate edits, including a length-changing first edit.
 *
 * @returns Invented files and independently declared reference identity
 *
 * @example
 * ```ts
 * const fixture = reviewedFixture();
 * ```
 */
export function reviewedFixture(): {
  readonly sourceFile: string;
  readonly archiveFile: string;
  readonly spec: FidelityReferenceSpec;
} {
  /**
   * Archive retains deliberate factual defects and one invisible character for the transform path.
   */
  const original = REVIEW_REFERENCE.replace(
    'grey-and-white',
    'blue',
  )
    .replace(
      '2023',
      '2022',
    )
    .replace(
      'well-lit',
      'well\u2011lit',
    );
  /**
   * Local edit coordinates refer to this original folded slice.
   */
  const folded = foldInvisibleVariants({ text: original, },)
    .text;
  /**
   * Source begins after a prefix so offset-zero assumptions cannot pass.
   */
  const sourcePrefix = 'source heading\n';
  /**
   * Archive has an independent prefix and donor after the reviewed passage.
   */
  const archivePrefix = 'archive heading\n';
  /**
   * Full invented source file.
   */
  const sourceFile = `${sourcePrefix}${REVIEW_SOURCE}\nsource footer`;
  /**
   * Full invented archive file.
   */
  const archiveFile = `${archivePrefix}${original}\n\n${REVIEW_DONOR}`;
  /**
   * First correction changes length, so later offsets must not be interpreted incrementally.
   */
  const colorAt = folded.indexOf('blue',);
  /**
   * Second correction restores the shared source year.
   */
  const yearAt = folded.indexOf('2022',);
  /**
   * Fixed insertion donor position, independent of name matching.
   */
  const donorAt = archiveFile.indexOf(REVIEW_DONOR,);
  /**
   * Existing mechanisms define fixture variants; reviewed hashes lock their outputs.
   */
  const damages = [
    fixtureDamage(deleteOneSentence({ cleanText: REVIEW_REFERENCE, },),),
    fixtureDamage(insertBorrowedSentence({
      cleanText: REVIEW_REFERENCE,
      donorTexts: [REVIEW_DONOR],
    },),),
    fixtureDamage(alterSharedNumber({
      cleanText: REVIEW_REFERENCE,
      sourceText: REVIEW_SOURCE,
    },),),
  ];
  return {
    sourceFile,
    archiveFile,
    spec: {
      id: 'invented-reference',
      entryId: 'starlit-cat',
      corpusSha: 'a'.repeat(FIXTURE_COMMIT_WIDTH,),
      source: {
        startOffset: sourcePrefix.length,
        endOffset: sourcePrefix.length + REVIEW_SOURCE.length,
        hash: hashContent({ content: REVIEW_SOURCE, },),
      },
      archive: {
        startOffset: archivePrefix.length,
        endOffset: archivePrefix.length + original.length,
        hash: hashContent({ content: original, },),
      },
      referenceHash: hashContent({ content: REVIEW_REFERENCE, },),
      referenceChars: REVIEW_REFERENCE.length,
      edits: [
        {
          startOffset: colorAt,
          endOffset: colorAt + 'blue'.length,
          expectedHash: hashContent({ content: 'blue', },),
          replacement: 'grey-and-white',
          author: 'fixture-author',
          rationale: 'Restore source color.',
        },
        {
          startOffset: yearAt,
          endOffset: yearAt + '2022'.length,
          expectedHash: hashContent({ content: '2022', },),
          replacement: '2023',
          author: 'fixture-author',
          rationale: 'Restore source year.',
        },
      ],
      donor: {
        startOffset: donorAt,
        endOffset: donorAt + REVIEW_DONOR.length,
        hash: hashContent({ content: REVIEW_DONOR, },),
      },
      damages: damages.map(function expected(damage,) {
        return {
          kind: damage.damageKind,
          hash: hashContent({ content: damage.damagedText, },),
          changedChars: damage.changedChars,
        };
      },),
      reviewedOn: '2026-09-11',
    },
  };
}

//endregion Invented reviewed-reference fixtures
