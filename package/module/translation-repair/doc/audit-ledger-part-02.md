# Audit ledger, part 02

Part 02 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## Rule text and sheet consistency

Probes:
`~/temp/agent/audit-policy-text/` and `~/temp/agent/audit-sheets/`
(rendered sheets under `sheets/` and `rendered/`,
a sheet-by-block matrix in `report.txt`).
Paths are under `src/`.

### S1: the translate writer keeps the existing translation's tense, against the house tense rule on the same sheet

Status:
fixed in `00eed316e` (guard `b16350d39`),
with the translate writer's no-addition rule.
`translate-wire.ts` says "KEEP THE TENSE OF THE EXISTING TRANSLATION where one is shown";
`house-policy.ts` says a life told in the present is brought to the past.
Class eighty-five fixed the same wording on the consolidation writer only,
and `tense-authority-reaches-every-sheet.unit.test.ts` pins the wrong wording.
Fix:
the consolidation writer's ordered tense rule.

### S2: production translate writers never see ARCHIVE RENDERING DISPUTED

Status:
fixed in `9858a7acb` (guard `translate-produce-dispute.unit.test.ts`).
`translate-stage-repair.ts` spreads `archiveDisputeNote` into `produceTranslateSlate`,
which never declares or forwards it;
a capturing client shows 0 of 2 translator sheets carry the note.
Tests exercise only the builder.
Fix:
declare and forward it;
guard through `produceTranslateSlate`.

### S3: the typed decision seat (Jev) votes without the house rules or community renderings

Status:
fixed in `ce824d933` (guard `decision-seat-policy.unit.test.ts`).
`selectDecision` in `candidate-select-decision.ts` builds criteria,
evidence and candidates only;
the chat seat carries `JUDGE_POLICY_BLOCK` and `communityRenderingsBlock`.
Comments in `stage-decision-call.ts` and `polish-gate-house-rules.ts` claim otherwise.
Commit `bc6fdc9b9` kept the sheet from the seat on purpose;
the fix carries the policy in the decision state (about 4k tokens against a 32k context).

### S4: the adjudication panel has no identity context

Status:
fixed;
the panel sheet carries the fenced DECLARED NAMES block and the shared declared-identity rules
(`declared-identity-rule.ts`,
moved out of the critic),
threaded from `repairChunk` through `runPanelStage`;
guarded end to end in `repair-translation.unit.test.ts`,
shown red with the thread cut.
`buildAdjudicationMessages` takes no `identityContext`,
so a claim against a declared name can be supported and dispute the archive.

### S5: the apparatus list differs across six sheets

Status:
fixed (`e7e3f9c17`,
`2329042f4`,
`914ccb21d`).
`APPARATUS_KINDS` in `page-apparatus-clause.ts` is the one list,
the union of every kind any sheet named;
the critic,
the panel,
the contest,
the writers' clause,
the archive block review,
its selector (`ARCHIVE_BLOCK_SELECTION_CRITERIA`)
and the dispute note read it,
and the critic,
the panel and the selector gained `NARRATIVE_DETAIL_IS_NOT_APPARATUS`.
Guards:
`apparatus-kinds.unit.test.ts`,
the selection-prompt assertion in `archive-block-review-stage.unit.test.ts`.
Left as measured:
the block review's deterministic `editorial-context` check still counts only fixed-prefix,
contributor,
image and comment blocks,
so a reviewer calling a gloss block `editorial-context` is not counted;
the block then ships as the archive wrote it unless a revise vote wins selection,
and the selector now reads the apparatus kinds.
The unclaimed-block census found no footnote or gloss block in the corpus.
Original finding:
`PAGE_APPARATUS_IS_KEPT`,
`CONTEST_POLICY`,
the critic,
the panel,
archive block review
and its selector each list different kinds;
critic and panel keep "only when WRONG".
Fix:
one shared kinds constant with the narrative bound on every sheet that files,
votes on or writes against the archive.

### S6: `CONTEST_POLICY` still says keep what the Chinese is silent about

Status:
fixed (`e7e3f9c17`,
`fa892a7da`).
The silent-keeps sentence covers page apparatus and whole regions
and says a narrative detail the archive adds to a passage is not kept on the archive's word;
the judge tail's precedence sentence names "a criterion or any other rule you have been given".
Guards:
`dropped-covers-the-page.unit.test.ts`,
`contest-ballot-wire.unit.test.ts`,
`decision-seat-policy.unit.test.ts`.
Original finding:
"Where the Chinese is SILENT rather than contradicting,
dropping it is a fault of this kind,
and keeping it is correct" sits beside `NARRATIVE_DETAIL_IS_NOT_APPARATUS`;
the CuspariaKLSY11 gate ballot kept "took medication that night" on that wording.
The JUDGE tail's precedence line names criteria this sheet lacks.

### S7: `SIZE_NOTE_POLICY` calls silent surplus in any far-longer rendering page content

Status:
fixed (`d94f6787b`).
Silent surplus is page content only where the archive rendering also carries it;
surplus the archive does not carry,
a passage repeated or looping included,
is unsupported.
Guard:
`contest-size-note.unit.test.ts`.
Original finding:
The note exists for a looping candidate,
and its sentence tells the judge the loop's surplus is page content.

### S8: the narrative bound and the cited-reference rule have no precedence

Status:
fixed (`914ccb21d`).
Both reference rules say an event or a characterization a cited reference states is covered,
since the narrative bound is about detail no source states,
and that reader protection outranks the references;
`TRANSLATE_ATTESTED_RULE` says reader protection outranks the attested details;
the dispute note says the adjudicators weighed the references before accepting the claim.
Guard:
`reference-precedence.unit.test.ts`.
Original finding:
A characterization a cited reference states is ACCURATE on one rule and an addition on the other;
neither limits reader protection
(`cited-reference-rule.ts`,
`TRANSLATE_ATTESTED_RULE`,
`misreadingRule`).

### S9: reader-protection bullet contradicts itself on "took medication"

Status:
resolved by the owner,
2026-09-27:
"took medication" is not replicable and may stay (`9eba04abb`).
`house-policy.ts` keeps "took medication" vague as a method
and allows "at most that she had taken medication" for any medication tied to a death.
Proposed condition:
the allowance holds only where medication was not the means.

### S10: the refiner keeps "any word left in the original language" and every date unchanged

Status:
fixed.
The block-level precedence sentence landed in `e8f0b0369`;
`81962c75a` rewrites the refiner's survival sentence in both branches to name the house form
and adds to the translate writer that a name the archive left in Han is not a rendering to keep.
Guards:
`house-policy-wording.unit.test.ts`,
`consolidate-objection-polish.unit.test.ts`,
`translate-wire.unit.test.ts`.
Original finding:
Contradicts the house block on Han,
Ta,
titles,
handles,
shorthand
and month-first dates.
Only `edit-prompt.ts` says the house rules outrank the sheet;
seven other sheets carry the block with no precedence sentence.

### S11: the polish gate's preface was read as licensing the base's tense

Status:
fixed (`091307d14`).
The preface calls a present-tense line of the life in the base a tense the house rules correct,
never a reason to keep the base;
`HOUSE_CORRECTION_IS_AN_IMPROVEMENT` in `polish-gate-house-rules.ts` tells the comparative and objection gates
to prefer a polish that only applies a house rule,
and the comparative refiner is told such a paragraph is a rewrite to make.
Guards:
`consolidation-polish-gate.unit.test.ts`,
`house-policy-wording.unit.test.ts`.
Original finding:
"a present-tense line about their life is the base's choice" was quoted by a TianqiChen66616 ballot;
the comparative policy never prefers a polish whose only change is a house correction.

### S12: the polish gate lacks blocks the consolidate gate carries

Status:
fixed (`1a004389a`).
`candidate-judge-rules.ts` holds the contest's declared-names lines (moved out of `CONTEST_POLICY`,
text byte-identical),
an apparatus rule in candidate vocabulary,
and a judge line clause;
the polish gate reads all three,
the community renderings block and the dispute note,
threaded `applyFinalPolish` to `polishConsolidation` to `runConsolidationPolishRound` to the gate subject.
The bilingual clause arrives with the line clause (S15).
Guards:
`polish-gate-page-rules.unit.test.ts`,
the dispute assertion in `consolidation-polish-apply.unit.test.ts`.
Original finding:
Apparatus,
name scope,
community renderings,
dispute note (not forwarded by `consolidation-polish-apply.ts`),
bilingual clause.

### S13: the absolute naturalness review has no house rules yet its findings are required fixes

Status:
fixed (`3e4cf0441`).
The review splices `MEASUREMENT_POLICY_BLOCK` with its own verdict line,
drops "deliberate source-language kinship terms" for "a term the house rules keep in English letters with its gloss",
and counts a departure from a house rule of form as a material defect.
Guard:
`naturalness-review-sheet.unit.test.ts`.
Original finding:
It tells the reviewer to preserve source-language kinship terms,
against the house rendering of 姐姐.

### S14: the editor sheet has no identity context or cited references

Status:
fixed (`a8f5cb490` export prep,
`fa949b78f` criteria,
`f16d5e8bf` evidence).
The editor sheet shows the declared names with `DECLARED_IDENTITY_RULES`,
the cited references with their rule,
and the community renderings the translation lacks;
both editor selections read the declared names and references through `repairSelectionSourceEvidence`.
The envelope criterion's tense now follows the house tense rule,
not the surrounding English;
both editor faithfulness criteria carry the declared-name exemption and `PAGE_APPARATUS_IS_KEPT`;
every refine selection mode reads `HOUSE_FORM_CORRECTION_KEEPS_MEANING`.
`house-form-corrections.ts` holds the one house-form list the polish gate,
refiner,
review and refine selection share.
Guards:
`selection-criteria-house.unit.test.ts`,
`editor-page-evidence.unit.test.ts`.
Original finding:
Its selection judges see community departures the editors were never told of.
The editor and refine selection criteria lag the slate criteria,
and "Fits the surrounding text in register and tense" makes the surrounding English the tense authority.

### S15: the bilingual and line-structure rules are missing on the contest and both gates

Status:
fixed (`1a004389a` for the polish gate,
`070db03dd` for the lane contest and the consolidate gate).
`JUDGE_LINE_STRUCTURE_CLAUSE` carries the bilingual clause;
both subjects take a required `lineStructured`,
and the lane contest key appends a mark when the rule governs.
Guard:
`judge-line-structure.unit.test.ts`.

### S16: the picture scope rule never reached the consolidation writer or the slate

Status:
fixed (`efa502d21`).
The consolidation writer reads `TRANSLATE_PICTURE_SCOPE_RULE` when it shows pictures;
the translate judge,
which also judges the consolidation slate,
reads `JUDGE_PICTURE_SCOPE_RULE` in the pictures label.
Guards:
`consolidate-wire.unit.test.ts`,
`document-pictures-reach-the-wire.unit.test.ts`.

### S17: the consolidation slate is told a decline leaves the passage untranslated where it stops the entry

Status:
fixed with the fifteenth addendum
(`select-decline-consequence.ts`:
a withheld standing tells the judges a declined slate ships by preference).
`candidate-select-wire.ts` via `translate-judge.ts`.
The translate lane told the same falsehood over an archive the floor refuses,
fixed in the same change.

### S18: measurement sheets drift

Status:
fixed.
The rendering audit's tense line and the measurement tail's attempts and places landed in `e8f0b0369`;
`b6df6d5ee` gives the introduced-defect probe's drop rule the apparatus exception.
Guard:
`probe-page-rules.unit.test.ts`.
Original finding:
The rendering audit counts a tense English supplies as `altered-time`;
the introduced-defect probe says dropping wording the ORIGINAL never had is a correct repair,
against the apparatus clause;
the measurement tail's reader-protection line names deaths only,
not attempts or a place that was the means.

### S19: house-policy wording defects

Status:
fixed.
Most bullets were already fixed in the current text (the corner-bracket example,
italic titles,
positional words,
first-person contributors,
"trans girl",
English letters for terms,
Canadian spellings in rule text);
the OD rule now keeps OD unnamed where it is the means of a death or an attempt,
and `KEPT_SUBJECT_RULE` makes I (or that person) the one who does it.

- "OD is overdose" is prescribed where OD is a suicide method (Susiethegamer),
    which reader protection keeps vague.
- The corner-bracket rule contradicts its own 「盐田姐姐」 example.
- Titles:
  the rule says quotation marks,
    the archive and `archive-italic-title-restore.ts` use italics (owner call).
- The positional-word rule reads as a ban on "earlier",
    "below" and "above" in any sense.
- "Entries are written in the third person" against first-person contributors.
- "MtF is trans woman,
  as 药娘 is" omits the owner's "trans girl".
- "kept and glossed" does not forbid Han in English prose;
    runs shipped "大证 (…)".
- Non-Canadian spellings in rule text:
    "capitalised",
    "penalises",
    "characterisation",
    "characterise",
    "humor",
    "judgement".
- `KEPT_SUBJECT_RULE` grammar:
  "says that I (or that person) does it".

### S20: smaller sheet defects

Status:
fixed,
item by item.
The attested-details rule licenses only the attested details and the apparatus from the existing translation;
the critic and editor foreign-phrase rules carry one shared sentence taking names and titles out of their scope,
and the Han residue floor passes a Japanese phrase with its English gloss after it (would-ship refusals 68 to 66);
the restoration judge is told references come from archives written before the house rules;
the dispute note names non-translation and is fenced on the contest and gate;
the identity block is labelled DECLARED NAMES and fenced on every sheet,
and the house policy names it so.
The translate writer's "does not already carry" reopens archive narrative;
the critic's foreign-phrase rule conflicts with the title rule;
the restoration judge states a false reason;
the dispute wording omits non-translation;
declared names and the dispute note are unfenced on some sheets;
the identity block goes by four headings.

## Runs

TianqiChen66620 (`.frozen-dist-2f26f440d`) was stopped by this session at 17 min,
on the owner's 2026-09-27 instruction to launch only once no further fix is due;
slice 9 was not reached.
