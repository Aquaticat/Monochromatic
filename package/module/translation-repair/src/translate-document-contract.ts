import type { LaneSliceText, } from './lane-slice-text.ts';
import type { RosterModelId, } from './synthetic-catalog.ts';
import type {
  UnfilledReason,
} from './translate-absence.ts';
import type { SliceAlignmentAssessment, } from './translate-alignment.ts';
import type { TranslateStageResult, } from './translate-stage-result.ts';
import type { SliceSelection, } from './slice-selection.ts';
import type { SliceReplacement, } from './splice-slices.ts';

//region Translate document contract
// What the translate lane stores per slice, and what it returns per document.
//
// SEPARATE FROM THE REPAIR CONTRACT on purpose. A repair outcome carries
// issues, repair regions, resolved issue ids and checker verdicts, none of
// which a translation has; a widened type would give every translate slice
// fields that can only be filled with lies, and a widened cache guard would let
// a repair-shape slice resume into a translate run, which nothing downstream
// could detect.

/**
 Schema of one stored translate slice.
 
 Starts at ONE rather than continuing the repair cache's numbering: the two
 lanes version independently, so a translate change cannot invalidate settled
 repair work and a repair change cannot invalidate settled translations.
 
 Bump for any change to what a record means: the record shape, the decision
 kinds, the alignment predicate, or what the lane asks the models.
 
 VERSION 2, on 2026-08-15, takes the SLICE INDEX out of the key. No record
 changed; what changed is which slices count as the same slice. Keeping the
 index meant any renumbering discarded every slice after it, and one-sided slicing
 renumbers by design, since inserting a slice for an untranslated section
 shifts everything below it. The index is now stamped onto a resumed record by
 whoever asked for it, and `translateSliceKey` carries the measurement saying
 identical-text slices inside one document do not occur in this corpus.
 
 VERSION 3, the same day, puts the INCUMBENT KIND into the key, because what a
 run ASKS about a slice with no translation is a different question: it must
 be filled or left as the gap it is, while a slice that has one may settle on
 what is already there. The bump discards nothing, measured before the change:
 no record had been settled under version 2 at all.
 
 VERSION 4, on 2026-08-20, for the declared-name guard. Every slice cached
 before it was settled without that check, so a resumed run would ship a
 replacement that dropped a declared name rather than re-deciding it. A guard
 any cache hit can walk past is not a guard.
 
 VERSION 5, the same day, because that guard now compares names on letters and
 digits alone. Measured over the pinned corpus, the comparison it replaces
 missed 12 of the 123 declared forms that are present in their own entry, so a
 slice settled under version 4 may have shipped the loss of one of those and
 would report itself decided. The widening loses none of the forms the old
 comparison found, so no cached slice can be re-decided the other way.
 
 VERSION 6, on 2026-08-22 (`973f7b47d`), because the verse rule reached the
 judges' sheet in both lanes. A slice judged before it could have ranked a
 rendering the rule places lower, so every slice settled under version 5 is
 re-judged; nothing about the record's shape or key changed.
 
 VERSION 7, on 2026-08-28, because metadata candidate admission now preserves
 contributor spelling established at same YAML comment path. A cached front
 matter candidate could retain source-script attribution and bypass guard.
 
 VERSION 8, same day, because body contributor lines now preserve public
 identity spellings established by existing English attribution. An earlier
 cached slice can replace them with literal source-side transliterations.
 
 VERSION 9 deterministically floors every candidate on complete target
 contributor survival rather than relying on prompt compliance alone,
 and excludes an unrepairable contributor-violating voice without fabricating
 incumbent authorship.
 
 VERSION 10 replaces identical second judging with prior-decline challenge.
 
 VERSION 11 continues absent passages from latest rejected slate and findings.
 
 VERSION 12 excludes archive wording that fails deterministic source floor
 and treats it as absent fallback until stage-local translation settles.

 VERSION 13 tells the judges of a slice whose archive wording is withheld
 that a declined slate still ships by preference, and ships the follow-up
 round's preferred candidate past a declined challenge round (owner,
 2026-09-27, "Preference + polish"); version 12 told them the passage had no
 translation and stopped the entry on that decline.

 VERSION 14 keeps a disputed archive off the slate as incumbent and as a
 copied candidate, stands the repair lane's text in only where the checkers
 confirmed every disputing issue resolved, and keys the dispute note (owner,
 2026-09-27, "No eligible standing").

 VERSION 15, the same day, for every change to what this lane asks or
 accepts after version 14 landed at 06:34 UTC, none of which moved the number
 (ledger M25). The floors: the address floor (F-1), the suicide floor (F-4),
 the floors that need no grammar on an unreadable original (F-5), the
 line-structure floor (F-7), the sheet-leak floor (F-8), the neutral-pronoun
 floor (F-9), glossary floors inside an accepted Han title (F-11), Han left
 standing in English prose (F-3, `078939ac7`) and a Han signer left in Han or
 romanized with no meaning (A17, `7ec9669bd`). The sheets: the declared names
 fenced on every sheet, the house rules and the apparatus kinds as one list,
 the line rule shown to the translate probe, and the contest reading line
 structure. The lane contest, a windowed stage, sizes its quorum on the
 reachable bench (ledger X8). A slice settled before any of these could resume
 with a candidate the floors now refuse. It costs nothing: the newest of the
 14,596 slice-cache files under the agent runs was written at 04:26 UTC that day,
 before version 14 existed.

 Two later changes ride inside 15 on the same reasoning, checked on
 2026-09-28 against that newest file: the house rules' "-re" line names the
 meter that measures beside the metre (ledger K13, `403db3c6e`), on every
 writing and judging sheet; and the prose ranges the Han-residue floor (F-3)
 reads now look past a JSX comment, a stray quote mark and a lone backtick
 (ledger K7, `1873b23dc` and `dc325d847`), so the floor sees Han it missed
 behind them.

 The glossary audit's corrections ride inside 15 too (ledger C3 to R16,
 `357f534b7`), checked on 2026-09-28 against the newest slice-cache file under
 the agent runs, still 04:26 UTC on 2026-09-27 (eighteen files after 04:20 UTC that
 day, none after 04:27 UTC). The source-carry floor refuses forms it passed and
 passes forms it refused (a slide onto a tier, "fossil-fuel car", "turned into
 in"), and no key reads a refused form; the COMMUNITY RENDERINGS block on the
 select sheets now counts a rendering inflected and bounded; and the
 grammatical English house rule states the doubled preposition. The terms,
 renderings and whys reach the identity context, which the key hashes.

 Rides inside 15 too: every gather now keeps a seat that answered unreadably
 out of the same-prompt retry rounds and re-asks each such seat, whichever
 round it came in, in the nudged recovery round (ledger P2, `005692e11`),
 which changes whose voices a round closes on; checked on 2026-09-28: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: a reply whose complete JSON value more text follows is
 read rather than lost (ledger P8, `cac097368`), which changes whose voices
 every round hears; checked on 2026-09-28: still no slice-cache file newer
 than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: a decision seat whose state the endpoint refuses
 as past its context, or that a stage cannot ask, now reads as out of reach
 for that ballot rather than as a lost voice (ledger P13, `a991ef1e1`), which
 changes the quorum a select round closes on; checked on 2026-09-28: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: no alignment, quote-loss or declared-name refusal keeps
 an archive the publication rule refuses, and such a slice carries
 `translate-archive-ineligible` (ledger X6, `6445a2e35`), which changes a
 refused slice's text and findings; checked on 2026-09-28: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: a reply that could not be used is re-asked once,
 nudged, of the same model on another provider through the uniqueness
 wrapper's claims (ledger P9, `7011d72cc`), which changes whose voices every
 round hears; checked on 2026-09-28: still no slice-cache file newer than
 04:26 UTC on 2026-09-27.

 Rides inside 15 too: a disputed slice's repair text never stands in when it
 is the archive's own wording, and the refused-wording finding a translate
 author reads says why the repair lane's text is refused (withdrawn at
 assembly, or unconfirmed by the checkers) rather than blaming the checkers
 for both (ledger L12, `f66e96f06` and `3ffbcec10`). No settled slice moves:
 0 of 1,132 fully resolved disputes over every artifact had unchanged text.
 Checked on 2026-09-28: still no slice-cache file newer than 04:26 UTC on
 2026-09-27.

 Rides inside 15 too: Bedrock reads dry with 1.33 USD still left, and its
 ledger holds every billed attempt at its bound (ledger P1, `2a108dfb3`,
 `107763dbb` and `7cfd5ae4b`), so a Gemma call moves to OpenRouter sooner
 as Bedrock nears its credit, which changes whose voices a round hears;
 checked on 2026-09-28: still no slice-cache file newer than 04:26 UTC on
 2026-09-27.

 Rides inside 15 too: the recovery round re-asks a reply the length
 limit cut with a nudge naming the cut, apart from one off the shape
 (ledger P10, `ce0ef7b51`), which changes what such a seat is asked and
 whose voices a round hears; checked on 2026-09-28: still no slice-cache
 file newer than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: the strict parse reads a formula as the site does
 (`5ce9370ac`), and a candidate forming a formula its original lacks is
 refused before any judge (ledger X22, `translate-formula.ts`), which
 changes what the lane accepts; checked on 2026-09-29: still no slice-cache
 file newer than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: the declared-name guard and the Han residue floor
 read text by code point, so a handle written in letters beyond the first
 plane is checked rather than projected to nothing, and an ideograph beyond
 it left in prose is refused (ledger B21, `declared-name-survival.ts`,
 `translate-han-residue.ts`); over the pinned archives and settled pages no
 survival answer changes, and neither they nor any stored artifact carries
 such an ideograph; same check, same result.

 Rides inside 15 too: the declared-name guard and the link-name floor carry a
 declared name only where it stands as a name, a letter meeting a digit and a
 small letter meeting a capital counting as edges, and the link floor reads a
 Latin source form, a mention and a page handle at handle edges (ledger B23,
 `name-projection.ts`, `11d029fde`); over the would-ship slices of every
 settled artifact, four wordings of two slices now drop a declared form the
 old containment took as kept, and no link-floor or contributor-authority
 answer moves that this change explains; checked on 2026-09-29: still no
 slice-cache file newer than 04:26 UTC on 2026-09-27.

 Rides inside 15 too: `collapseKey` reads prose quotes through the typography
 fold (ledger B24, `straightenProseQuotes`), so a rendering apart from the
 incumbent or another only in straight against curly prose quotes collapses
 into it on the slate, and the repair lane skips validating it as a copy of
 the incumbent. Over the 2,905 stored slates, 305 carried such a twin and in
 30 the chosen candidate was the incumbent's; checked on 2026-09-29: the
 newest slice-cache file is still the one of 04:26 UTC on 2026-09-27.

 Rides inside 15 too: the validator refuses a candidate whose prose sets a
 quotation in guillemets (ledger B24, `translate-guillemets.ts`), and the
 sheet-leak floor the editor sheet's «REGION marker and its CURRENT TEXT: and
 CONTEXT: ... heads; over the stored artifacts one comparison row of 6,285
 carries a guillemet its incumbent lacks, and none of the pinned originals
 or archives carries a guillemet or those heads. Same cache check as the
 paragraph before.

 THE PRE-LAUNCH CHECK OF 2026-09-28 (ledger M28): 15 was set
 in `66703994a` at 02:56 UTC on 2026-09-28, after the newest slice-cache file under the
 agent runs (04:26 UTC on 2026-09-27), and no slice-cache file has been written
 since, so no answer cached under an earlier question can be served under
 this number. Every source commit since then rides inside it, those the
 accounts above name and those they do not (`corpus-run/cache-account-audit.ts`, ledger M28).
 */
export const TRANSLATE_SLICE_CACHE_VERSION = 15;

/**
 Models the translate lane seats.
 
 @example
 ```ts
 const models: TranslateModels = { translatorModelIds, judgeModelIds, };
 ```
 */
export type TranslateModels = {
  /**
   Models producing independent translations of each slice.
   */
  readonly translatorModelIds: readonly RosterModelId[];

  /**
   Whole roster judging the slate, translators included; a ballot for a
   judge's own translation counts less rather than not at all.
   */
  readonly judgeModelIds: readonly RosterModelId[];
};

/**
 Roster a per-slice hook hands the translate lane, as the repair lane's
 hook hands it one (ledger H5).

 @example
 ```ts
 const seating: TranslateSliceSeating = { translateModels, };
 ```
 */
export type TranslateSliceSeating = {
  /**
   Roster read since the lane started, absent while the given one stands.
   */
  readonly translateModels?: TranslateModels;
};

/**
 What the driver did with one slice's stage result.
 
 @example
 ```ts
 const disposition: TranslateDisposition = 'refused-alignment';
 ```
 */
export type TranslateDisposition =
  /**
   Stage result taken as it stands.
   */
  | 'stage-result'
  /**
   Stage wanted to replace the incumbent and the alignment guard refused,
   because the source cannot account for the text being replaced.
   */
  | 'refused-alignment'
  /**
   Stage wanted to replace the incumbent and the quote guard refused, because
   the replacement carried fewer quoted passages than the archive does.
   */
  | 'refused-quote-loss'
  /**
   Stage wanted to replace the incumbent and the declared-name guard refused,
   because the replacement dropped a name the archive text carried and the
   documents declare.
   */
  | 'refused-declared-name';

/**
 Settled record for one translate slice.
 
 Carries the WHOLE stage result beside the driver's decision, so a reader can
 tell "judges preferred a replacement and the guard refused it" from "judges
 kept the incumbent". Those are opposite facts about the same lane and both
 ship the same text.
 
 @example
 ```ts
 const changed = record.outputText !== incumbentText;
 ```
 */
export type TranslateSliceRecord = {
  /**
   Lane discriminator, checked when a cache file is read so a repair outcome
   can never be resumed as a translation.
   */
  readonly kind: 'translate-slice';

  /**
   Schema this record was written under.
   */
  readonly schemaVersion: number;

  /**
   Global slice index, as preparation stamped it.
   */
  readonly sliceIndex: number;

  /**
   Everything the stage decided, including the slate, every ballot and its
   findings.
   */
  readonly stageResult: TranslateStageResult;

  /**
   Text the driver accepted for assembly.
   */
  readonly outputText: string;

  /**
   Whether that text differs from the translation already in the archive.
   */
  readonly changed: boolean;

  /**
   What the driver did with the stage result.
   */
  readonly disposition: TranslateDisposition;

  /**
   Declared forms the replacement dropped, when that is why it was refused.
   
   STORED, unlike the alignment refusal's sentence, because these forms name
   no slice index and so survive a record being resumed at a different
   position. The reporter has no preparation to recompute them from.
   */
  readonly droppedDeclaredNames?: readonly string[];

  /**
   Measurements behind the alignment decision, recorded on every slice rather
   than only refused ones: a rate needs its denominator.
   */
  readonly alignment: SliceAlignmentAssessment;

  /**
   Stage findings plus any refusal this driver added.
   */
  readonly findings: readonly string[];
};

/**
 One passage this run left missing, with why and what it heard.
 
 @example
 ```ts
 const unfilled: UnfilledSlice = { sliceIndex: 4, reason: 'no-candidate', findings, };
 ```
 */
export type UnfilledSlice = {
  /**
   Slice the archive has no translation for.
   */
  readonly sliceIndex: number;

  /**
   Why this run produced none either.
   */
  readonly reason: UnfilledReason;

  /**
   What the stage gathered before it gave up: which translators were heard,
   what collapsed, what the judges counted.
   
   ALSO IN {@link TranslateDocumentResult.findings}, deliberately. The flat
   list is what a corpus-wide count reads, and this is what says which passage
   each finding belongs to; neither answers the other's question.
   */
  readonly findings: readonly string[];
};

/**
 Result of translating one whole document.
 
 Has no partial variant. A lane that ran out of time throws, leaving its
 settled slices in the cache for the next attempt, because a result reporting
 unvisited slices as unchanged is indistinguishable from a document that
 needed no translation.
 
 @example
 ```ts
 const { translatedText, changedSliceCount, } = await translateDocument({ ... },);
 ```
 */
export type TranslateDocumentResult = {
  /**
   Translation rebuilt from accepted per-slice text.
   */
  readonly translatedText: string;

  /**
   Slices preparation produced, which every count below is out of.
   */
  readonly sliceCount: number;

  /**
   Slices whose accepted text SHIPPED, which is what the document carries.
   
   Counted after assembly rather than from the records, because the footnote
   guard can withdraw a replacement the judges chose: a record saying it
   changed and a document carrying the archive's text are both true, and this
   count belongs to the document.
   */
  readonly changedSliceCount: number;

  /**
   Slices where the alignment guard refused a replacement the judges chose.
   */
  readonly refusedSliceCount: number;

  /**
   Slices whose replacement was withdrawn at assembly.
   
   Three causes, and the findings are what tell them apart: a footnote the
   assembly would have left worse than the archive's, a structural regression
   no identifier names, and a surviving set that reassembles to the archive
   text exactly. The last one withdraws replacements nothing is wrong with,
   because a document identical to the archive carries no change to name.
   */
  readonly withdrawnSliceCount: number;

  /**
   Slices the returned document CARRIES a replacement for, in document order.
   
   Named rather than counted, because what this lane is measured against is
   per slice: which slices it replaced, and whether the repair lane touched
   the same ones. A count answers neither, and re-deriving the set from the
   records would re-derive it WRONG, since a record says what the slice chose
   rather than what the document carries.
   */
  readonly changedSliceIndices: readonly number[];

  /**
   Who won each slice and whether the document kept it, in document order.
   
   The index sets say WHICH slices moved; this says who the text came from
   and how the judges got there. Every question asked of this lane since it
   was built is per slice and per producer, and a count answers none of them.
   */
  readonly sliceSelections: readonly SliceSelection[];

  /**
   Slices whose replacement the assembly guard took back, in document order.
   
   Ordered by `orderedChangeSets` rather than left in the order the guard
   worked, so a reader joining two lanes slice by slice reads both sets by one
   rule. Disjoint from {@link TranslateDocumentResult.changedSliceIndices} by
   construction, and the same fact
   {@link TranslateDocumentResult.withdrawnSliceCount} counts.
   */
  readonly withdrawnSliceIndices: readonly number[];

  /**
   Shipped slices whose text the assembly guard trimmed, with the text the
   document carries: the decision with an orphan definition block cut.
   
   The delivery ledger reads a shipped row's text here before it reads the
   decision, so the rows say what the document carries. Empty when every
   shipped slice carries its decision whole.
   */
  readonly trimmedReplacements: readonly SliceReplacement[];

  /**
   Slices resumed from the cache rather than translated this run, so a cheap
   run is distinguishable from a lane that found nothing to do.
   */
  readonly resumedSliceCount: number;

  /**
   Whether this document is a whole translation.
   
   READ THIS BEFORE {@link TranslateDocumentResult.translatedText}. A result
   whose status is `unfilled` carries a document with passages the archive
   never translated and this run could not either, so publishing it or
   comparing it against a complete one measures something else. The field
   exists because the gaps were nameable and still missable: a consumer
   reading only the old fields would have seen an ordinary success.
   */
  readonly status: 'complete' | 'unfilled';

  /**
   Slices with NO translation in the archive that this run could not fill, in
   document order, each with the reason and the evidence.
   
   A different thing from every other set here, and the reason it is its own
   field. A slice that is unshipped, unwithdrawn and unchanged elsewhere in
   this result means the judges looked and kept the archive's wording; these
   slices have no archive wording to keep, so the document carries the gap it
   came with. They settle no record and cache nothing, so the next run asks
   again.
   
   STRUCTURED RATHER THAN A LIST OF INDICES, because the evidence has to have
   an owner: several unfilled slices flatten their stage findings into one
   document-level list, where nothing says which passage each belongs to.
   */
  readonly unfilled: readonly UnfilledSlice[];

  /**
   One settled record per slice, in document order.
   
   SHORTER THAN THE SLICE COUNT when {@link TranslateDocumentResult.unfilled}
   names any slice, since a slice that produced nothing settles no record.
   */
  readonly slices: readonly TranslateSliceRecord[];

  /**
   What this lane DECIDED for every prepared slice, beside the archive's own
   wording, in document order.
   
   Built at the document level rather than stored on
   {@link TranslateDocumentResult.slices}, which are CACHE records: an
   incumbent belongs to a preparation, and a slice resumed from an earlier run
   would otherwise serve the wording that preparation had then. Carries no
   shipped flag for the same reason, since whether a slice shipped is decided
   by an assembly guard reading the whole document and can differ between two
   runs of the same slice.
   */
  readonly sliceTexts: readonly LaneSliceText[];

  /**
   Every slice's findings, flattened for the artifact.
   */
  readonly findings: readonly string[];
};

//endregion Translate document contract
