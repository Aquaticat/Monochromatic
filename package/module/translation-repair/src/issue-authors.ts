/**
 * Reads which models wrote the text a checker stage is about to judge, out of
 * the judged rounds that produced it.
 *
 * @module
 */

import { nonNullishOrThrow, } from '@monochromatic-dev/module-or-throw/ts';
import type { PatchOperation, } from './apply-patch.ts';
import { producerModelIds, } from './candidate-select-model.ts';
import type { EditableEnvelope, } from './patch-model.ts';
import type { EditorStageResult, } from './repair-editor-stage.ts';
import {
  CHUNK_SCOPE_ENVELOPE,
  type RepairJudgedRound,
} from './repair-round-record.ts';
import {
  type IssueAuthorship,
  UNATTRIBUTED_TEXT,
} from './resolution-authorship.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';

//region Pair shapes

/**
 * One envelope id beside the issue ids that envelope served.
 *
 * @example
 * ```ts
 * const pair: EnvelopeIssues = ['envelope-1', ['adjudicated/whisker',],];
 * ```
 */
type EnvelopeIssues = readonly [
  string,
  readonly string[],
];

/**
 * One envelope id beside the models that wrote its winning candidate.
 *
 * @example
 * ```ts
 * const pair: EnvelopeAuthors = ['envelope-1', ['hf:zai-org/GLM-5.2',],];
 * ```
 */
type EnvelopeAuthors = readonly [
  string,
  readonly SyntheticModelId[],
];

/**
 * One issue id beside every model that helped write its text.
 *
 * @example
 * ```ts
 * const pair: IssueAuthors = ['adjudicated/whisker', ['hf:zai-org/GLM-5.2',],];
 * ```
 */
type IssueAuthors = readonly [
  string,
  readonly SyntheticModelId[],
];

/**
 * One issue id beside a single model that helped write its text.
 *
 * SINGULAR ON PURPOSE, so two envelopes serving one issue produce two pairs
 * rather than one overwriting the other.
 *
 * @example
 * ```ts
 * const pair: IssueAuthorPair = ['adjudicated/whisker', 'hf:zai-org/GLM-5.2',];
 * ```
 */
type IssueAuthorPair = readonly [
  string,
  SyntheticModelId,
];

//endregion

//region Envelopes whose text actually reached the candidate

/**
 * Issue ids each applied operation's envelope named, keyed by that envelope.
 *
 * ONLY APPLIED OPERATIONS COUNT. An envelope whose operation the gate refused
 * put no text into the candidate, so nobody wrote anything about the issues it
 * named and every checker keeps a whole vote on them.
 *
 * @param envelopes - editable envelopes offered to the editors
 *
 * @param applied - operations that survived the apply gate
 *
 * @returns Issue ids per surviving envelope
 *
 * @example
 * ```ts
 * const served = appliedIssuesByEnvelope({ envelopes, applied, },);
 * ```
 */
export function appliedIssuesByEnvelope(
  {
    envelopes,
    applied,
  }: {
    readonly envelopes: readonly EditableEnvelope[];
    readonly applied: readonly PatchOperation[];
  },
): Readonly<Record<string, readonly string[]>> {
  return Object.fromEntries(
    applied.flatMap(function toEntry(operation,): readonly EnvelopeIssues[] {
      /**
       * Envelope this operation edited, when the slate still names it.
       */
      const envelope = envelopes.find(function matches(candidate,) {
        return candidate.envelopeId === operation.envelopeId;
      },);
      if (envelope === undefined)
        return [];
      return [
        [
          envelope.envelopeId,
          envelope.issueIds,
        ],
      ];
    },),
  );
}

//endregion

//region Authorship read off judged rounds

/**
 * Models with a hand in whichever candidate one round chose.
 *
 * EMPTY FOR A DECLINED ROUND, because a panel that ranked nothing put no
 * model's text into the candidate through that round.
 *
 * @param round - one judged round of any stage
 *
 * @returns Model ids behind that round's winner
 *
 * @example
 * ```ts
 * const authors = roundWinnerAuthors(round,);
 * ```
 */
function roundWinnerAuthors(round: RepairJudgedRound,): readonly SyntheticModelId[] {
  if (round.kind !== 'selected')
    return [];

  /**
   * Slate entry the judges picked, joined by the number they were SHOWN rather
   * than by array position. `selectedIndex` is one-based, and the slate may be
   * rotated before it reaches the judges, so position and number are two
   * different things: indexing the array reads the neighbour, or nothing at all
   * when the winner was last.
   */
  const winner = round.slate
    .find(function won(entry,) {
      return entry.index === round.selectedIndex;
    },);
  return producerModelIds(
    nonNullishOrThrow(winner,)
      .producer,
  );
}

/**
 * Who won each envelope, mapped onto the issues those envelopes served.
 *
 * ENVELOPE ROUNDS ONLY, and only worth reading when the COMPOSITE shipped.
 * A composite is assembled from these winners, so each one really did write
 * the part of the shipped text its envelope covers. When any other candidate
 * shipped, these winners lost and wrote nothing that reached the reader, which
 * is why the caller decides whether to consult this at all rather than this
 * function unioning itself into every answer.
 *
 * @param rounds - judged rounds that produced the text under check
 *
 * @param issuesByEnvelope - issue ids each surviving envelope served
 *
 * @returns Authors per issue id
 *
 * @example
 * ```ts
 * const perIssue = envelopeAuthorsFromRounds({ rounds, issuesByEnvelope, },);
 * ```
 */
function envelopeAuthorsFromRounds(
  {
    rounds,
    issuesByEnvelope,
  }: {
    readonly rounds: readonly RepairJudgedRound[];
    readonly issuesByEnvelope: Readonly<Record<string, readonly string[]>>;
  },
): Readonly<Record<string, readonly SyntheticModelId[]>> {
  /**
   * Winners of rounds that decided one envelope, keyed by that envelope.
   */
  const byEnvelope: Readonly<Record<string, readonly SyntheticModelId[]>> = Object.fromEntries(
    rounds
      .filter(function decidedOneEnvelope(round,) {
        return round.envelopeId !== CHUNK_SCOPE_ENVELOPE;
      },)
      .map(function toEntry(round,): EnvelopeAuthors {
        return [
          round.envelopeId,
          roundWinnerAuthors(round,),
        ];
      },),
  );

  /**
   * One pair per issue and author, before duplicates are merged away. Pairs
   * rather than a keyed map because two applied envelopes can serve the SAME
   * issue, and keying any earlier would drop the first envelope's authors.
   */
  const pairs: readonly IssueAuthorPair[] = Object.entries(issuesByEnvelope,)
    .flatMap(function toPairs([envelopeId, issueIds,],): readonly IssueAuthorPair[] {
      /**
       * Models that wrote this envelope's winning candidate.
       */
      const authors = byEnvelope[envelopeId] ?? [];
      return issueIds.flatMap(function forIssue(issueId,): readonly IssueAuthorPair[] {
        return authors.map(function withAuthor(author,): IssueAuthorPair {
          return [
            issueId,
            author,
          ];
        },);
      },);
    },);

  /**
   * Those pairs gathered per issue, each author named once.
   */
  const perIssue: Readonly<Record<string, readonly SyntheticModelId[]>> = Object.fromEntries(
    [
      ...new Set(pairs.map(function toIssueId(pair,) {
        return pair[0];
      },),),
    ]
      .map(function toEntry(issueId,): IssueAuthors {
        return [
          issueId,
          [
            ...new Set(pairs
              .filter(function forThisIssue(pair,) {
                return pair[0] === issueId;
              },)
              .map(function toAuthor(pair,) {
                return pair[1];
              },),),
          ],
        ];
      },),
  );

  return perIssue;
}

//endregion

//region Authorship per checker stage

/**
 * Authors of the patched candidate the accuracy checkers judge.
 *
 * READS THE PRODUCER THE STAGE RECORDED, not the rounds. One shipped patch has
 * one producer, and the stage knows it at every exit, including the exit where
 * judges declined to rank anything and a real editor's repair shipped anyway.
 * That exit is the reason this cannot be reconstructed: its round holds ballots
 * and no winner, so a reader of rounds alone leaves the author of the shipped
 * text undiscounted and free to certify its own work at full weight.
 *
 * @param editor - editor stage result, carrying its producer, rounds and gate
 *
 * @param envelopes - editable envelopes offered to the editors
 *
 * @returns Who wrote the patched text
 *
 * @example
 * ```ts
 * const authorship = collectIssueAuthors({ editor, envelopes, },);
 * ```
 */
export function collectIssueAuthors(
  {
    editor,
    envelopes,
  }: {
    readonly editor: EditorStageResult;
    readonly envelopes: readonly EditableEnvelope[];
  },
): IssueAuthorship {
  /**
   * Who wrote what ships, `unattributed` when the untouched translation does.
   */
  const { shippedProducer, } = editor;
  if (shippedProducer.kind === 'unattributed')
    return UNATTRIBUTED_TEXT;

  // A composite is the one shipped patch whose parts have DIFFERENT authors,
  // and the envelope rounds that assembled it record which. Splitting it that
  // finely matters: crediting every contributor for every issue would discount
  // a checker over text its neighbour wrote.
  if (shippedProducer.kind === 'composite')
    return {
      perIssue: envelopeAuthorsFromRounds({
        rounds: editor.rounds,
        issuesByEnvelope: appliedIssuesByEnvelope({
          envelopes,
          applied: editor.patch
            .applied,
        },),
      },),
      everyIssue: [],
    };

  // Any other producer wrote the whole shipped chunk by itself, so it answers
  // for every issue the credit can reach.
  return {
    perIssue: {},
    everyIssue: producerModelIds(shippedProducer,),
  };
}

/**
 * Authors of the refined text the naturalness recheck judges.
 *
 * BOTH STAGES BELONG HERE, which is why this adds to the editor's answer rather
 * than replacing it. Refined text is the editor's repair rewritten for
 * naturalness, so an editor whose fix survived and a refiner who rewrote around
 * it have each had a hand in what the recheck reads.
 *
 * A refinement that lost contributes nobody, and the editor's authorship stands
 * alone: the text that ships is then exactly what the editor produced.
 *
 * @param editorAuthorship - who wrote the repaired text this rewrote
 *
 * @param refineContributors - models whose rewrite won, empty when none did
 *
 * @returns Who wrote the refined text
 *
 * @example
 * ```ts
 * const authorship = collectRefinedAuthors({ editorAuthorship, refineContributors, },);
 * ```
 */
export function collectRefinedAuthors(
  {
    editorAuthorship,
    refineContributors,
  }: {
    readonly editorAuthorship: IssueAuthorship;
    readonly refineContributors: readonly SyntheticModelId[];
  },
): IssueAuthorship {
  if (refineContributors.length === 0)
    return editorAuthorship;

  return {
    perIssue: editorAuthorship.perIssue,
    everyIssue: [
      ...new Set([
        ...editorAuthorship.everyIssue,
        ...refineContributors,
      ],),
    ],
  };
}

//endregion
