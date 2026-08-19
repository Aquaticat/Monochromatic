import type { Logger, } from '@monochromatic-dev/module-logger/ts';
import type { ForeignBorrowed, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import { assertJudgeableProducerRoster, } from './repair-contract.ts';
import type { SyntheticModelId, } from './synthetic-catalog.ts';
import type { IncumbentKind, } from './translate-absence.ts';
import { produceTranslateSlate, } from './translate-produce.ts';
import { judgeSlateWithRetry, } from './translate-retry.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';

//region Translate stage
// Every slice is translated from the ORIGINAL by several models independently,
// the translation already in the archive stands as one more candidate, and the
// whole judge roster chooses per slice, with a translator's ballot for its own
// rendering counted at reduced weight.
//
// This is not the editor stage with a different prompt. The editor answers
// "repair these named defects in this region", which cannot reach a passage that
// was never translated and cannot see a slice that is present, fluent and
// mediocre. This asks "render this passage", which reaches both.
//
// A fresh candidate whose Markdown structure, footnote markers, links or
// inline code do not match the ORIGINAL is not dropped: it goes back to the
// model that wrote it with the findings, and that model revises, declines, or
// says the finding is a fact about the passage rather than about its work. See
// `translate-repair.ts`. The apply gate cannot serve here at all, since every
// policy in it is anchored to an edit bounded by an envelope some accepted
// issue named, and a whole-slice replacement has none.
//
// WHAT THIS STAGE STILL DOES NOT DO: check declared names, which needs the
// identity block parsed rather than passed through, and check anything that
// crosses a slice boundary, which is `#92`.


/**
 * Translates one slice from its original and returns the text that ships.
 *
 * @param client - injected model client
 *
 * @param translatorModelIds - models rendering the slice independently
 *
 * @param judgeModelIds - whole roster selection seats, translators included;
 * a ballot for the judge's own rendering counts for less
 *
 * @param sourceText - original slice text
 *
 * @param incumbentText - translation as it stands, blank where this slice has
 * none
 *
 * @param incumbentKind - whether there is a translation to fall back on,
 * decided by the caller from the target chunk rather than from the text being
 * blank: a content span holding only whitespace is the archive's own wording,
 * and an anchor is a place where a rendering belongs and none exists
 *
 * @param identityContext - declared names from both sides' front matter,
 * omitted when neither declares anything
 *
 * @param neighbouringSourceText - original of the sections either side, shown as
 * CONTEXT the candidates are not expected to render. Absent by default, so a
 * caller that does not ask for it gets the sheet production has always sent.
 * `#107` is why it exists: where the archive carried a passage across a section
 * boundary, a judge shown one slice pair sees invention on one side and omission
 * on the other, and `#84`'s alteration arm went from 12 of 16 to 15 of 16 when
 * the same trial was given exactly this
 *
 * @param neighbouringIncumbentText - archive English of the sections either
 * side, shown so a passage missing here can be recognised next door rather than
 * read as one the archive never had
 *
 * @param lineStructured - whether the enclosing CHUNK's original is
 * line-structured, decided by the caller
 *
 * @param signal - caller abort honored by every exchange
 *
 * @param perCallTimeoutMs - deadline per exchange
 *
 * @param l - pipeline logger
 *
 * @returns Shipped text with how it was decided
 *
 * @throws {@link import('./repair-contract.ts').ProducerRosterError} when the
 * roster could not select anything: repeats on either side, no translator, or
 * judges too few to reach the minimum weight
 *
 * @throws {@link TranslateAbsenceError} when a slice with no incumbent produced
 * nothing to write, which every fallback here would otherwise report as a
 * settled slice carrying the archive's own wording, of which there is none
 *
 * @throws {@link BlankSelectionError} when selection chose text that says
 * nothing for a source that says something, in EITHER mode, since that is a
 * deletion rather than an outcome
 *
 * @example
 * ```ts
 * const translated = await runTranslateStage({ ... },);
 * ```
 */
export async function runTranslateStage(
  {
    client,
    translatorModelIds,
    judgeModelIds,
    sourceText,
    incumbentText,
    incumbentKind,
    identityContext,
    neighbouringIncumbentText,
    neighbouringSourceText,
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  }: ForeignBorrowed<{
    readonly client: SyntheticClient;
    readonly translatorModelIds: readonly SyntheticModelId[];
    readonly judgeModelIds: readonly SyntheticModelId[];
    readonly sourceText: string;
    readonly incumbentText: string;
    readonly incumbentKind: IncumbentKind;
    readonly identityContext?: string;
    readonly neighbouringIncumbentText?: string;
    readonly neighbouringSourceText?: string;
    readonly lineStructured: boolean;
    readonly signal: AbortSignal;
    readonly perCallTimeoutMs: number;
    readonly l: Logger;
  }>,
): Promise<TranslateStageResult> {
  // BOTH ROSTERS ARE CHECKED HERE and in neither half, because this is the
  // only place that holds both. A caller driving the halves directly has to
  // make this call itself.
  assertJudgeableProducerRoster({
    producerModelIds: translatorModelIds,
    judgeModelIds,
    role: 'translator',
  },);

  /**
   * Slate this slice produced, bought once.
   */
  const produced = await produceTranslateSlate({
    client,
    translatorModelIds,
    sourceText,
    incumbentText,
    ...((identityContext === undefined) ? {} : { identityContext, }),
    lineStructured,
    signal,
    perCallTimeoutMs,
    l,
  },);

  // JUDGED THROUGH THE RETRY rather than directly, so a panel that declines is
  // asked once more about the same candidates before the slice is recorded as
  // one nothing backed. The window trial drives the halves itself and does not
  // get this, which is correct: judging one slate repeatedly IS its experiment.
  return await judgeSlateWithRetry({
    judging: {
      client,
      produced,
      judgeModelIds,
      sourceText,
      incumbentText,
      incumbentKind,
      ...((identityContext === undefined) ? {} : { identityContext, }),
      ...((neighbouringSourceText === undefined) ? {} : { neighbouringSourceText, }),
      ...((neighbouringIncumbentText === undefined) ? {} : { neighbouringIncumbentText, }),
      signal,
      perCallTimeoutMs,
      l,
    },
  },);
}

//endregion Translate stage
