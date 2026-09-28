# Audit ledger

Every finding of the whole-package audit the owner asked for on 2026-09-27
("audit the whole translation-repair pkg for all the mistakes we've made and fix all of them",
"Mistakes made, ever, for this pkg, not just today").
Each finding carries where it is,
the evidence,
the fix,
the guard,
and its status.
A finding leaves this ledger only when its fix and guard have landed,
and its lesson then lives in the prevention doc.

Probe scripts and their outputs stay outside the repository,
under `~/temp/agent/audit-<area>/`,
because they read the pinned corpus,
which is never committed.

## Community and fandom glossaries

Probes: `~/temp/agent/audit-community-glossary/`
(`corpus-floor`, `overreach`, `probe-floor`, `probe-163`, `probe-more`).
Files: `src/community-glossary.ts`,
`src/community-glossary-fandom.ts`,
`src/translate-community-term.ts`.

### C1: refused forms match as raw substrings

Status: fixed in `cc96eca77` (guard `glossary-match.unit.test.ts`), "head mask" added to 头壳.
`renderingCarries` and `refusedFormIn` in `src/translate-community-term.ts` check no word boundary,
and a rendering excuses a refused form only when it opens inside the occurrence and runs past its end.
The built floor refuses "inside her head mask",
"head-mask",
"headgear",
"headdress",
"Atri waited by the laboratories",
"Atri was dictatorial"
and "Arona came from Badalona".
头壳's own why calls the object a "full head mask".
Fix: match Latin forms at ASCII letter and digit boundaries,
excuse an occurrence any accepted rendering overlaps at any position,
add "head mask" to 头壳.
Guard: 小猫戴着头壳 passes "inside her head mask" and "inside her headgear" and refuses "inside her head";
亚托莉在猫舍 passes "Atri napped near the laboratories".

### C2: the 药娘 floor refuses a registered company name

Status: fixed in `f3cd0ef83`, guarded in `6fbcfa2d8` (owner, 2026-09-27: "Allow it, because it's the proper name of an org.").
mikaela_khara names a registered company 小药娘网络科技 (`page.md` lines 194 and 202);
the archive writes "XiaoYaoNiang(XYN)" and its translator's note gives the English name "XYN (Tianjin) Technology".
The floor refuses the archive and every mikaela run that rendered the name.
The class one hundred nineteen ruling refuses the term "even where the existing translation keeps it";
whether a registered name falls under it is the owner's call.

### C3: departures ignore inflection

Status: open (task #372).
`communityRenderingDepartures` names a departure for "Healing views",
"How hard this mental illness is to cure",
"becoming the doll",
"transgender girl"
and the MeowBot233 archive's own "soothing views".
The block text says "A rendering may inflect".
Fix: add inflected renderings after each lead rendering (the kigurumi guard pins 治愈's lead "healed"),
never a bare "heal" (it sits inside "health"),
and match at boundaries.
Guard: 猫可以治愈人 with "a healing cat" and 猫是药娘 with "a transgender girl" name no departure.

### C4: renderings count as present inside unrelated words

Status: fixed in `cc96eca77`.
"cured" inside "secured",
"outed" inside "shouted",
"atri" inside "psychiatric" hide real departures.
Guard: 猫被治愈 with "The cat was comforted and secured" names a departure.

### C5: whys promise refusals the refused forms do not carry

Status: open (task #372).
变娃 passes "doll up",
"dolls up",
"dolled-up";
头壳 passes "Her head was large and heavy" and "their head";
跨圈 passes "crossdresser community" and "across different communities";
药娘 passes "little HRT girl",
"medicine girl"
and tone-marked "Yào Niáng";
逆子 passes "rebellious child",
the form class one hundred fifty-one shipped twice.
Guard: one cat fixture per gap.

### C6: false or page-specific whys and comments shown to the models

Status: open (task #372).

- 炸柜's why pairs it with throwing away the medication,
    true of XIEPT2 only and false on mikaela_khara.
- 治愈's comment,
    why and the kigurumi test contrast it with 安慰,
    and the planning doc and handover repeated that contrast to the owner:
    TianqiChen666 writes 安抚 (`page.md` line 89),
    never 安慰.
    The owner's "Healed first" still stands on the fandom "healing" and the archive's "healed";
    the owner is told of the misquotation.
    "soothed" stays accepted,
    since MeowBot233's archive renders 治愈人的风景 as "soothing views".
- 治愈's why names one page's use and prints on shihai4h and MeowBot233.
- The header comment says "No candidate is barred by it",
    false since class one hundred nineteen,
    and "A term the archive got wrong is not entered",
    false for 炸柜,
    阿洛娜,
    亚托莉,
    变娃 and 治愈.
- The block heading "rendered as the archive and the community render them" is false where the archive departs.
- 变娃's "who then stays silent" conflicts with the doll's quoted speech.
- 柜门炸开's "never a literal door" beside the accepted "blown out of the closet".

### C7: sibling spellings missing

Status: open (task #372).
爆柜 (Anilovr) and 跨性别圈 (GLaDOSister) have no entries.

### C8: comments cut on the floor side only

Status: fixed in `cc96eca77`.
The floor cuts HTML comments;
`communityRenderingDepartures` and the sheet term lines do not.

### C9: the two floor messages name the term differently

Status: fixed in `cc96eca77` (the term is now `OD`, so both messages name it alike).
One uses the trimmed term,
the other the raw one.

### C10: terms match inside other words

Status: open (task #372).
自切 inside 各自切,
亲自切,
独自切.
"trans circle" is redundant beside "trans circles".

## Rendering glossaries

Probes: `~/temp/agent/audit-rendering-glossary/`.
Files: `src/rendering-glossary*.ts`.

### R1: " OD" misses lowercase and line-start OD, and SHIPPED

Status: fixed in `cc96eca77`; the three false comments corrected there and in this ledger.
hulicaijia opens a paragraph with `OD`;
XingZ60 writes lowercase `od` four times.
XingZ6014 shipped "I hate od, / so once z60 started od,"
and XingZ6010 "I hate od, / … started od'ing".
The comment claiming every OD stands after a space is false in `src/rendering-glossary.ts`,
`src/rendering-glossary-owner-forms.unit.test.ts`
and the planning doc.
" OD" also matches inside " ODE".
Fix: case-insensitive Latin-token matching for terms that carry Latin letters,
on the source and on the Han-kept check.
Guard: 小猫讨厌 od and a line-start OD are refused when kept;
"an odd cat",
"recited an ode"
and 写 MOD pass.

### R2: 燃油车 refuses "fossil-fuel car"

Status: open (task #372).

### R3: 未成年 "minor trans" fires inside transgression, translation, transfer

Status: fixed in `cc96eca77` (boundaries, and "minor transgender" added).

### R4: 滑档 refuses ordinary motion verbs

Status: open (task #372).
"slipped into a low mood",
"tears slid down her face"
and "slid to the floor" are refused.
Fix: key the refusals on the tier.

### R5: 化作 "turned into in " refuses grammatical English and is a sentence lesson

Status: open (task #372).
"That butterfly is what the kitten turned into in spring" is refused.
Fix: move the lesson to `GRAMMATICAL_ENGLISH_RULE` and correct the comment.

### R6: 摆烂's why prescribes one page's sentence

Status: open (task #372).
On lxy "stopped trying" is a mistranslation of 偶尔摆烂.
"slack off" register is an owner question.

### R7: 矫正中心 and 矫正学校 missing

Status: open (task #372).

### R8: 师范学院's why promises an official-name exception the floor refuses

Status: open (task #372).
"normal school" is dated English,
not a calque.

### R9: three whys write "gaokao" while 高考's line refuses it

Status: open (task #372).
Guard: no why carries a form another entry refuses.

### R10: 亲友 "close friends" fires inside "close friendships"

Status: open (task #371, task #372).

### R11: 交往 lists "dated" on the one page where it never means dating

Status: open (task #372).

### R12: 抢救's renderings carry "intensive care"

Status: open (task #372).

### R13: sentence lessons and page-specific whys in word entries

Status: open (task #372).
学霸 (属性),
未成年,
志愿填写,
三剑客.

### R14: refusal overreach without boundaries

Status: fixed in `cc96eca77` by boundaries.
"wish form" in "a wish formed",
"threatened her life" in "lifelong",
"head of year" in "ahead of year-end",
"erben" in "verbena".

### R15: refusal gaps

Status: open (task #372).
"type II diabetic",
"diabetes type II",
"threatens her life",
`JK裙`.

### R16: false or stale comments

Status: open (task #372).
初中 counts,
激素 "two of them also write 药物",
the planning doc's 交往 count,
the double space before " OD" on the sheet.

## Canadian forms passes

Probes: `~/temp/agent/audit-canadian/`.
Files: `src/corpus-run/canadian-date.ts`,
`src/corpus-run/canadian-spelling.ts`,
`src/corpus-run/canadian-forms.ts`,
`src/corpus-run/prose-ranges.ts`,
`src/house-policy.ts`.

### K1: the date rewrite drops the comma after the year, and a test asserts it

Status: open.
aiyysk1 and aiyysk2 shipped "February 9, 2024 was Lunar New Year’s Eve."
The Language Portal of Canada requires a comma after the year when the sentence continues.
`canadian-forms.unit.test.ts` expects "March 13, 2024 in a box".

### K2: `closesRange` gets ranges wrong

Status: open.
Splits a range across a line break,
skips "until 4 May" and a list item "- 4 May:",
and mixes orders when both ends carry a month.

### K3: the closed word list leaves non-Canadian forms, including ones the house policy names

Status: open.
Missing inflections of listed stems,
"judgement" and "summarise" shipped on XingZ6012 to XingZ6014,
"counselor",
"programmes",
"my mum".

### K4: ordinal and year-first dates left alone

Status: open.

### K5: withdrawn slices ship raw archive text

Status: fixed in `3497e0041` (prep `ab4373cd2`, guards `4014d49c4` and `66fe334ce`).
The page passes and the footnote guard now run again over the rows left once the guard takes a row back,
until a round takes nothing back (`corpus-run/page-assembly-rounds.ts`);
the withdrawal stays recorded, and a row a pass wrote over the archive text wins over it.
No stored artifact carries an instance: of 265, only shi_Yumiaoya7 withdraws a slice, an anchor with no archive text.
Guard output is byte-identical to the build before on six stored artifacts, shi_Yumiaoya7 among them.
`restoredOnly` drops the Canadian row of a withdrawn slice and the archive text ships unconverted.

### K6: the house policy writes "capitalised" and "judgement"

Status: fixed in `b45000747`; `sheet-canadian-spelling.unit.test.ts` now reads every rendered sheet.
Its spelling test checks four forms.

### K7: `prose-ranges.ts` protects too much

Status: open.
A quote mark inside a JSX comment and a stray backtick protect the rest of the text.

### K8: small wrong rewrites

Status: open.
"5 May beetles",
"the 4th May",
"4 May2024",
accented neighbours.

### K9: quoted lowercase English is respelled though the README says it is kept

Status: open.

### K10: underscore and slash edges

Status: open.

### K11: capitalized listed words at a sentence start are never respelled

Status: open.

### K12: test names claim more than they check

Status: open.

### K13: the house policy's "-re" line omits "meter" the device

Status: open.

## Consolidation gate

### G1: the gate sheet says choosing an ineligible standing stops the entry

Status: fixed in `0b8788dae`; decision addenda thirteen to fifteen record the owner's answers.
Since class one hundred eighty-five (`419605ff4`) a gate preferring an ineligible standing ships the slate's choice,
but `buildConsolidateGateMessages` still says 'Choosing "standing" stops this entry with no page',
and the `standingEligible` TSDoc in `src/consolidate-settle-gate.ts` says a gate keeping it ends the slice.
Over an ineligible standing every gate verdict now ships the consolidation;
whether the gate should still run there is an owner question.

## Rule text and sheet consistency

Probes: `~/temp/agent/audit-policy-text/` and `~/temp/agent/audit-sheets/`
(rendered sheets under `sheets/` and `rendered/`, a sheet-by-block matrix in `report.txt`).
Paths are under `src/`.

### S1: the translate writer keeps the existing translation's tense, against the house tense rule on the same sheet

Status: fixed in `00eed316e` (guard `b16350d39`), with the translate writer's no-addition rule.
`translate-wire.ts` says "KEEP THE TENSE OF THE EXISTING TRANSLATION where one is shown";
`house-policy.ts` says a life told in the present is brought to the past.
Class eighty-five fixed the same wording on the consolidation writer only,
and `tense-authority-reaches-every-sheet.unit.test.ts` pins the wrong wording.
Fix: the consolidation writer's ordered tense rule.

### S2: production translate writers never see ARCHIVE RENDERING DISPUTED

Status: fixed in `9858a7acb` (guard `translate-produce-dispute.unit.test.ts`).
`translate-stage-repair.ts` spreads `archiveDisputeNote` into `produceTranslateSlate`,
which never declares or forwards it;
a capturing client shows 0 of 2 translator sheets carry the note.
Tests exercise only the builder.
Fix: declare and forward it; guard through `produceTranslateSlate`.

### S3: the typed decision seat (Jev) votes without the house rules or community renderings

Status: fixed in `ce824d933` (guard `decision-seat-policy.unit.test.ts`).
`selectDecision` in `candidate-select-decision.ts` builds criteria,
evidence and candidates only;
the chat seat carries `JUDGE_POLICY_BLOCK` and `communityRenderingsBlock`.
Comments in `stage-decision-call.ts` and `polish-gate-house-rules.ts` claim otherwise.
Commit `bc6fdc9b9` kept the sheet from the seat on purpose;
the fix carries the policy in the decision state (about 4k tokens against a 32k context).

### S4: the adjudication panel has no identity context

Status: fixed; the panel sheet carries the fenced DECLARED NAMES block and the shared declared-identity rules
(`declared-identity-rule.ts`, moved out of the critic), threaded from `repairChunk` through `runPanelStage`;
guarded end to end in `repair-translation.unit.test.ts`, shown red with the thread cut.
`buildAdjudicationMessages` takes no `identityContext`,
so a claim against a declared name can be supported and dispute the archive.

### S5: the apparatus list differs across six sheets

Status: fixed (`e7e3f9c17`, `2329042f4`, `914ccb21d`).
`APPARATUS_KINDS` in `page-apparatus-clause.ts` is the one list,
the union of every kind any sheet named;
the critic, the panel, the contest, the writers' clause, the archive block review,
its selector (`ARCHIVE_BLOCK_SELECTION_CRITERIA`)
and the dispute note read it,
and the critic, the panel and the selector gained `NARRATIVE_DETAIL_IS_NOT_APPARATUS`.
Guards: `apparatus-kinds.unit.test.ts`, the selection-prompt assertion in `archive-block-review-stage.unit.test.ts`.
Left as measured:
the block review's deterministic `editorial-context` check still counts only fixed-prefix, contributor, image and comment blocks,
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
Fix: one shared kinds constant with the narrative bound on every sheet that files,
votes on or writes against the archive.

### S6: `CONTEST_POLICY` still says keep what the Chinese is silent about

Status: fixed (`e7e3f9c17`, `fa892a7da`).
The silent-keeps sentence covers page apparatus and whole regions
and says a narrative detail the archive adds to a passage is not kept on the archive's word;
the judge tail's precedence sentence names "a criterion or any other rule you have been given".
Guards: `dropped-covers-the-page.unit.test.ts`, `contest-ballot-wire.unit.test.ts`, `decision-seat-policy.unit.test.ts`.
Original finding:
"Where the Chinese is SILENT rather than contradicting, dropping it is a fault of this kind,
and keeping it is correct" sits beside `NARRATIVE_DETAIL_IS_NOT_APPARATUS`;
the CuspariaKLSY11 gate ballot kept "took medication that night" on that wording.
The JUDGE tail's precedence line names criteria this sheet lacks.

### S7: `SIZE_NOTE_POLICY` calls silent surplus in any far-longer rendering page content

Status: fixed (`d94f6787b`).
Silent surplus is page content only where the archive rendering also carries it;
surplus the archive does not carry, a passage repeated or looping included, is unsupported.
Guard: `contest-size-note.unit.test.ts`.
Original finding:
The note exists for a looping candidate,
and its sentence tells the judge the loop's surplus is page content.

### S8: the narrative bound and the cited-reference rule have no precedence

Status: fixed (`914ccb21d`).
Both reference rules say an event or a characterization a cited reference states is covered,
since the narrative bound is about detail no source states,
and that reader protection outranks the references;
`TRANSLATE_ATTESTED_RULE` says reader protection outranks the attested details;
the dispute note says the adjudicators weighed the references before accepting the claim.
Guard: `reference-precedence.unit.test.ts`.
Original finding:
A characterization a cited reference states is ACCURATE on one rule and an addition on the other;
neither limits reader protection
(`cited-reference-rule.ts`, `TRANSLATE_ATTESTED_RULE`, `misreadingRule`).

### S9: reader-protection bullet contradicts itself on "took medication"

Status: resolved by the owner, 2026-09-27: "took medication" is not replicable and may stay (`9eba04abb`).
`house-policy.ts` keeps "took medication" vague as a method
and allows "at most that she had taken medication" for any medication tied to a death.
Proposed condition: the allowance holds only where medication was not the means.

### S10: the refiner keeps "any word left in the original language" and every date unchanged

Status: fixed.
The block-level precedence sentence landed in `e8f0b0369`;
`81962c75a` rewrites the refiner's survival sentence in both branches to name the house form
and adds to the translate writer that a name the archive left in Han is not a rendering to keep.
Guards: `house-policy-wording.unit.test.ts`, `consolidate-objection-polish.unit.test.ts`, `translate-wire.unit.test.ts`.
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

Status: fixed (`091307d14`).
The preface calls a present-tense line of the life in the base a tense the house rules correct,
never a reason to keep the base;
`HOUSE_CORRECTION_IS_AN_IMPROVEMENT` in `polish-gate-house-rules.ts` tells the comparative and objection gates
to prefer a polish that only applies a house rule,
and the comparative refiner is told such a paragraph is a rewrite to make.
Guards: `consolidation-polish-gate.unit.test.ts`, `house-policy-wording.unit.test.ts`.
Original finding:
"a present-tense line about their life is the base's choice" was quoted by a TianqiChen66616 ballot;
the comparative policy never prefers a polish whose only change is a house correction.

### S12: the polish gate lacks blocks the consolidate gate carries

Status: fixed (`1a004389a`).
`candidate-judge-rules.ts` holds the contest's declared-names lines (moved out of `CONTEST_POLICY`, text byte-identical),
an apparatus rule in candidate vocabulary, and a judge line clause;
the polish gate reads all three, the community renderings block and the dispute note,
threaded `applyFinalPolish` to `polishConsolidation` to `runConsolidationPolishRound` to the gate subject.
The bilingual clause arrives with the line clause (S15).
Guards: `polish-gate-page-rules.unit.test.ts`, the dispute assertion in `consolidation-polish-apply.unit.test.ts`.
Original finding:
Apparatus,
name scope,
community renderings,
dispute note (not forwarded by `consolidation-polish-apply.ts`),
bilingual clause.

### S13: the absolute naturalness review has no house rules yet its findings are required fixes

Status: fixed (`3e4cf0441`).
The review splices `MEASUREMENT_POLICY_BLOCK` with its own verdict line,
drops "deliberate source-language kinship terms" for "a term the house rules keep in English letters with its gloss",
and counts a departure from a house rule of form as a material defect.
Guard: `naturalness-review-sheet.unit.test.ts`.
Original finding:
It tells the reviewer to preserve source-language kinship terms,
against the house rendering of 姐姐.

### S14: the editor sheet has no identity context or cited references

Status: fixed (`a8f5cb490` export prep, `fa949b78f` criteria, `f16d5e8bf` evidence).
The editor sheet shows the declared names with `DECLARED_IDENTITY_RULES`,
the cited references with their rule, and the community renderings the translation lacks;
both editor selections read the declared names and references through `repairSelectionSourceEvidence`.
The envelope criterion's tense now follows the house tense rule, not the surrounding English;
both editor faithfulness criteria carry the declared-name exemption and `PAGE_APPARATUS_IS_KEPT`;
every refine selection mode reads `HOUSE_FORM_CORRECTION_KEEPS_MEANING`.
`house-form-corrections.ts` holds the one house-form list the polish gate, refiner, review and refine selection share.
Guards: `selection-criteria-house.unit.test.ts`, `editor-page-evidence.unit.test.ts`.
Original finding:
Its selection judges see community departures the editors were never told of.
The editor and refine selection criteria lag the slate criteria,
and "Fits the surrounding text in register and tense" makes the surrounding English the tense authority.

### S15: the bilingual and line-structure rules are missing on the contest and both gates

Status: fixed (`1a004389a` for the polish gate, `070db03dd` for the lane contest and the consolidate gate).
`JUDGE_LINE_STRUCTURE_CLAUSE` carries the bilingual clause;
both subjects take a required `lineStructured`,
and the lane contest key appends a mark when the rule governs.
Guard: `judge-line-structure.unit.test.ts`.

### S16: the picture scope rule never reached the consolidation writer or the slate

Status: fixed (`efa502d21`).
The consolidation writer reads `TRANSLATE_PICTURE_SCOPE_RULE` when it shows pictures;
the translate judge, which also judges the consolidation slate, reads `JUDGE_PICTURE_SCOPE_RULE` in the pictures label.
Guards: `consolidate-wire.unit.test.ts`, `document-pictures-reach-the-wire.unit.test.ts`.

### S17: the consolidation slate is told a decline leaves the passage untranslated where it stops the entry

Status: fixed with the fifteenth addendum
(`select-decline-consequence.ts`: a withheld standing tells the judges a declined slate ships by preference).
`candidate-select-wire.ts` via `translate-judge.ts`.
The translate lane told the same falsehood over an archive the floor refuses, fixed in the same change.

### S18: measurement sheets drift

Status: fixed.
The rendering audit's tense line and the measurement tail's attempts and places landed in `e8f0b0369`;
`b6df6d5ee` gives the introduced-defect probe's drop rule the apparatus exception.
Guard: `probe-page-rules.unit.test.ts`.
Original finding:
The rendering audit counts a tense English supplies as `altered-time`;
the introduced-defect probe says dropping wording the ORIGINAL never had is a correct repair,
against the apparatus clause;
the measurement tail's reader-protection line names deaths only,
not attempts or a place that was the means.

### S19: house-policy wording defects

Status: fixed. Most bullets were already fixed in the current text (the corner-bracket example, italic titles, positional words,
first-person contributors, "trans girl", English letters for terms, Canadian spellings in rule text);
the OD rule now keeps OD unnamed where it is the means of a death or an attempt,
and `KEPT_SUBJECT_RULE` makes I (or that person) the one who does it.

- "OD is overdose" is prescribed where OD is a suicide method (Susiethegamer),
    which reader protection keeps vague.
- The corner-bracket rule contradicts its own 「盐田姐姐」 example.
- Titles: the rule says quotation marks,
    the archive and `archive-italic-title-restore.ts` use italics (owner call).
- The positional-word rule reads as a ban on "earlier",
    "below" and "above" in any sense.
- "Entries are written in the third person" against first-person contributors.
- "MtF is trans woman, as 药娘 is" omits the owner's "trans girl".
- "kept and glossed" does not forbid Han in English prose;
    runs shipped "大证 (…)".
- Non-Canadian spellings in rule text:
    "capitalised",
    "penalises",
    "characterisation",
    "characterise",
    "humor",
    "judgement".
- `KEPT_SUBJECT_RULE` grammar: "says that I (or that person) does it".

### S20: smaller sheet defects

Status: fixed, item by item.
The attested-details rule licenses only the attested details and the apparatus from the existing translation;
the critic and editor foreign-phrase rules carry one shared sentence taking names and titles out of their scope,
and the Han residue floor passes a Japanese phrase with its English gloss after it (would-ship refusals 68 to 66);
the restoration judge is told references come from archives written before the house rules;
the dispute note names non-translation and is fenced on the contest and gate;
the identity block is labelled DECLARED NAMES and fenced on every sheet, and the house policy names it so.
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

## History, classes 93 to 185

Notes: `~/temp/agent/audit-history-93-185/notes.md`
(families F1 to F19, a per-class list, probes `probe-siblings.mjs`, `fixture-corpus.mjs`, `guard-order.mjs`,
`verify-hashes.mjs`).
All 95 recorded guard commits precede their fixes;
of 221 cited hashes only `0e0bd1a8c` (named in `811d908a9`'s message) does not resolve.

### H1: a rejection of every valid proposal still stops the entry

Status: fixed in `ee6d31e88`, guarded in `37128bf6c` (owner, 2026-09-27, "Preference + polish"); only a slate with no candidate or no voice heard still stops, having nothing to ship.
`translate-runoff-tie.ts` breaks only a challenge round's tie;
any other decline throws,
and `consolidate-settle.ts` turns it into `ConsolidationStandingIneligibleError` over an ineligible standing
(the hulicaijia14 shape).

### H2: the lane contest winner is validated without `lineStructured`

Status: fixed in `a0fd3cc7c`, guarded in `b867b3180`.
`lane-contest-eligibility.ts` passes `declared` only;
with the class one hundred two fixture the floor says invalid and `laneContestChoiceVerdict` says it may ship.

What that cost, read from the code rather than assumed:
the verdict gates only persistence and the log line in `lane-contest-driver.ts`,
and the consolidation's `readStandingVerdict` does pass `lineStructured`,
so the merged winner never shipped unrefused;
it was written to the slice cache and twin memo as warm-run evidence,
which is what the verdict exists to prevent.

The fix makes `lineStructured` required on `laneContestChoiceVerdict` and `laneContestChoiceMayShip`,
and threads `prepared.lineStructuredSliceIndices` through `runPassContest` and `contestDocumentLanes`.
Required rather than defaulted, because the defect was an optional flag reading false where a caller left it off.
The guards are a verdict case and a driver case (merged winner of a governed slice not persisted;
the same winner persisted where no rule governs; the line-keeping lane persisted where one does);
removing the flag from the validation call turned both red at their `mayShip` and `persisted` assertions.

The same family was checked across the package:
every other production `validateTranslatedSlice`, `laneTextsForSlate`, `repairInvalidCandidates` and
`buildTranslateMessages` caller passes `lineStructured`,
the two front-matter calls in `lane-contest-eligibility.ts` return before any line check,
and `corpus-run/translate-probe.ts`, the `#70` prototype still runnable as the `translate-probe` task, omitted it.
The probe now decides governance with the pipeline's own `governedSliceIndices` over its section and slices.
Replayed offline over its entry, none of its three probed slices is governed,
so its sheet is unchanged there;
the positive control (a governed two-line slice) adds 882 characters of line rule to the sheet.
The probe calls providers and prints no sheet, so no live run was made for this.

### H3: the 治愈 misquote

Status: owner told 2026-09-27; the comment,
why and `community-glossary-kigurumi.unit.test.ts` still carry 安慰 (task #372).
The comment also calls the reasons the owner's,
though the owner wrote only "I kinda disagree here".

### H4: the repair lane's own sheets never see the archive dispute

Status: fixed (`d91b338d7`).
The editor and the checker read `ADDITION_IS_REMOVED_NOT_SOFTENED` (`addition-repair-rule.ts`):
an accepted addition is fixed only by removing the detail, and a softer restatement keeps it,
which the checker answers not-fixed.
Class one hundred eight measured the repair lane softening an accepted invented event into milder wording.
Guard: `addition-repair-rule.unit.test.ts`.

### H5: the translate lane and the consolidation never re-seat under a hold

Status: open.
`corpus-run/pass-reseat.ts` and `corpus-run/pass-consolidate.ts` only wait.

### H6: the absolute naturalness review is shown wrapped prose and no house rules

Status: fixed with S13 (`3e4cf0441`).
The subject takes a required `lineStructured`; on prose the wire folds each paragraph for display only.
The subject's texts stay exact:
`absolute-naturalness-review-stage.ts` digests them
and `corpus-run/artifact-two-lane-read-naturalness-digest.ts` recomputes those digests from the shipped text,
so folding the subject would have broken every artifact read.

### H7: the consolidation writer and the translate judge see picture transcripts with no scope rule

Status: fixed with S16 (`efa502d21`).

### H8: the introduced-defect probe has no declared names or glossary

Status: fixed (`b6df6d5ee`).
The probe shows the declared names with their rules and the community renderings over each region's BEFORE and AFTER;
`runIntroducedDefectProbe` and `proveRepairedChunk` take a required `identityContext` string, empty for none,
since the repo forbids nullish unions and an optional field would let a caller omit it silently.
Guard: `probe-page-rules.unit.test.ts`.

### H9: observations left unbuilt after the owner said to fix everything

Status: open, to re-check on current pages:
更多人 omitted,
螐 in three treatments and the album in two forms,
"Yuli" with no literal gloss,
同类 narrowed.

### H10: stale statements against the code

Status: open.
`doc/slice-context.md` says a slate over an eligible standing keeps its single round on a decline
and that a tie or rejection is re-asked once;
the TSDoc in `consolidate-settle.ts` says the same.

### H11: the address floor counts the 你 in 迷你

Status: fixed with F-1 in `d0c788468` (`addressesNobody` in `translate-address-original.ts`, guarded in `address-drop.unit.test.ts`).

### H12: minimax-m3 ignores OpenRouter endpoints one at a time and names none measured

Status: open.

### H13: the seeds test pins the whole term list

Status: fixed in `992d6c984` (properties and named renderings, the owner's 药娘 and 治愈 included).
`community-glossary.unit.test.ts` went red three times on additions.

### H14: Freud's "id" becomes "ID"

Status: open (latent).

### H15: fixtures carry corpus text

Status: fixed in `98054d72b` (every file below rewritten with invention).
`address-drop.unit.test.ts` (two fixtures),
`consolidation-polish-gate.unit.test.ts`,
`rendering-glossary-idiom.unit.test.ts`,
`suicide-drop.unit.test.ts`,
`community-glossary.unit.test.ts`,
`consolidate-gate-wire.unit.test.ts`.

### Process mistakes, classes 93 to 185

- Passes ran a stale build (a nested `cp` copy),
    launched from uncommitted trees,
    or launched on builds whose full suite was red
    (hulicaijia30, shi_Yumiaoya38, TianqiChen66614, TianqiChen66618, TianqiChen6663, yingying9).
- A failing test was reported inside a PASS count and never fixed
    (the `lane-contest-stage` grace case, five times).
- A suite ran on a build other than the one committed (class one hundred fifty).
- PASS counts before 2026-09-26 counted describe blocks, not tests.
- A commit message names a hash that does not exist (`811d908a9` names `0e0bd1a8c`).
- Doc facts not taken from the source (launch times, counts, a stale handover line).
- Class one hundred forty-eight's fix has no planning-doc entry.
- Launch mistakes: a wrong entry id,
    a waiter watching the old pid,
    a build in the run's cgroup killed by systemd-oomd.
- Results claimed without a validated probe (the en_CA scan's false positives;
    class one hundred ten not replayed on real texts).
- Evidence misquoted to the owner and rulings misread (治愈's 安慰; class fifty-four's reading of "else fail").
- Shell rule slips in this session: a `;` in a suite command and in a test command.

## History, classes 1 to 92 and before numbering

Notes: `~/temp/agent/audit-history-1-92/`
(`notes-classes-01-44.md`, `notes-classes-45-76.md`, `verify-hashes.out`: 213 cited hashes, none missing).
Families found there:
narrow fix leaving siblings,
a gate or tie stopping the entry over a valid proposal,
two readers of one text applying different rules,
sheet text contradicting another rule or the code,
a rule's sample wording steering output,
a check placed after the last decision (publish-only),
a decision made without evidence the pipeline holds,
silence counted as a vote,
an enumerated list where a general rule was needed,
a fallback hiding a failure,
missing log context,
slice-by-slice judging blind to page consistency,
a fix introducing a regression,
provider replies misclassified.

### E1: destination loss is caught only at publish, and the refusal names neither destination nor slice

Status: fixed.
The diagnostic half in `7668c6ce7`;
the remedy in `cc6762f46` (red guard `d8009bfb1`),
following the owner's ruling of 2026-09-27 that a settled page ships with its defects reported.
Every publish-time content check (front matter, archive original, contributor names, destinations, headings)
now runs through `corpus-run/publish-defects.ts`:
its own refusal becomes a defect that is logged and printed as a `DEFECTS` line beside the tally,
anything else it throws still stops the entry,
and the page ships.
A page that does not parse, or that disagrees with its artifact, still refuses.

Found as:
`corpus-run/publish-fixed.ts` threw after all spending;
no page-assembly pass names a destination;
`corpus-run/destinations-line.ts` and `corpus-run/pass-entry.ts` claim the addresses are in the run log,
false on the refusal path.
XingZ6011 lost 96.3 min to it on 2026-09-26.
The refusal now logs each dropped address with the slices whose original, archive span and shipped text carry it,
and its message names the source slices.

Measured on 2026-09-27 over the 246 stored artifacts whose carve reproduces, 461 source destinations inside a slice:
302 carried by both the archive span and the shipped text,
151 missing from the archive span and restored by the shipped text,
5 missing from both and dropped by the page, all from August runs before the either-rendering rule of 2026-09-04
(wangzihao980 slices 3 and 4 written by a lane, Toka_ls slice 13 left to the archive),
3 missing from both and carried elsewhere on the page,
and none carried by the archive and lost by the shipped text.
So the live failure is an archive sentence without the link shipping,
and a take-back to the archive would never have helped.
Refused entries leave no artifact, so they are counted from run logs:
seven real entries were refused at publish for one dropped destination each
(luxuanwen3, Mio, shi_Yumiaoya twice, XingZ60 three times),
after 53 to 136 minutes each, about 10.3 hours in all.

### E2: the reader-protection bullet prescribes "she ended her life" for deaths and attempts alike

Status: fixed in `e8f0b0369`.
The bullet opens on "a death or an attempt" and its sample says "the page says that she ended her life",
the class seventy-nine shape;
class one hundred twenty-four's later sentence contradicts it.

### E3: stages running their own rounds count unreachable seats in their quorum

Status: open.
`absolute-naturalness-review-stage.ts` sizes on `modelIds.length`,
so a false "quorum not met" skips the confirmation;
`pair-blocks-stage.ts` and `pair-sections-stage.ts` time their grace the same way.
`reachableQuorum` exists (`stage-reachable-quorum.ts`).

### E4: an empty standing with no valid lane text fails at publish, not at once

Status: fixed, in two steps.
First in `d9cb910e4` (red guard `d2f0e07ef`),
which made the slice fail at once under the owner's rule of 2026-09-04;
then the owner ruled the same day that such a slice keeps the archive and the page ships
("Keep archive, ship", `doc/design-commitments.md`),
fixed in `7f79ada48`, `002f21f43` and `e7d409fdd` (red guards `4acd8bd40`),
recorded as the eighteenth addendum of `doc/decision/translation-repair-ineligible-standing.md` at the repo root.

Found as:
the `no-standing-text` exit in `consolidate-settle.ts` was the one exit keeping the standing
that skipped `requireShippableTerminal`,
so a slice with no valid proposal anywhere settled with no polish,
and `assertFinalNaturalnessComplete` stopped the entry at persist
after every later slice had been bought.
XingZ60 lost about 3.0 hours that way on 2026-09-22 (slice 89),
on the variant with a lane text on offer that class eighty-seven fixed.
An empty standing passes the rule only over a blank original,
which the pinned corpus never carves (0 of 1259 deterministic slices, 2026-09-27),
and such a slice still keeps nothing.
Since the naturalness check of 2026-08-28,
no stored artifact carries a `no-standing-text` slice;
all 15 that do are from August.

The first step also fixed a vacuous check beside it:
the `incumbent-only` case read its served counter off a return a throw never delivers,
so its "no judge bought" assertion held whatever was bought.

### E5: floor refusals and panel votes the log cannot explain

Status: open.
`translate-produce.ts` returns floor refusals as findings with no log line;
a panel verdict carries no reason.

### E6: a malformed archive competes in repair selection as though it parsed

Status: open.
`repair-chunk-verdict.ts` passes `UNCHANGED_MEASUREMENTS` with `integrityOk` true.

### E7: the sheet-leak label list has fallen behind the sheets

Status: fixed with F-8; a fenced block no longer depends on the list.
`translate-sheet-leak.ts` lists seven labels;
`REJECTED CANDIDATE N`,
`WHAT THE JUDGES FOUND`
and `PRIOR FAILED CONSOLIDATION STRATEGY` are fenced but not listed.

### E8: more fixtures paraphrase corpus content

Status: fixed in `98054d72b` (every file below rewritten with invention).
`archive-footnote-relabel.unit.test.ts`,
`pair-definition-order.unit.test.ts`,
`coverage-verdict.unit.test.ts` (names from the corpus).

### E9: tests pin roster sizes to literals

Status: fixed in `87f95d62f` (no provider spelling for two roster models; the contract's checker floor).
`roster-reach.unit.test.ts`,
`corpus-run/owner-cull.unit.test.ts`.

### E10: the page-name glossary reads raw documents

Status: open, impact unmeasured.
`page-name-glossary.ts` does no front-matter split and no comment or code-fence masking.

### E11: the retry-wait parser is case-sensitive and knows only h, m and s

Status: open (latent).

### E12: the English-original recognizer is a list of exact wordings

Status: open (latent).

### Process mistakes, classes 1 to 92 and before

- A suite called green when red (`e7307d304` for `d70087757`) and a miscounted PASS total.
- Runs launched on red builds (CuspariaKLSY3 on a real defect; others red on fixtures),
    on stale builds (two green runs that never executed the new code),
    or with the wrong roster or entry id.
- Results claimed without reading the output (the owner: "You didn't even look at its actual output.")
    and reads that declared no defect where one stood.
- Early fixes committed their tests inside the fix;
    red-first commits start with class five.
- A test file in the wrong shape registered nothing and exited 0.
- A mechanical lint autofix changed behaviour (`92c5192ee`).
- A question put to the owner whose example contradicted its label (class eighty-three).
- Observations recorded and not fixed that later became classes
    (84, 85, 75 and 76, 79, 67 and 68, 71, 106).

## Floor replay over archives and settled pages

Probes: `~/temp/agent/audit-floor-replay/`
(`replay.mjs`, `fires.json`, `classification.json`, `controls.json`, `page-checks.json`, `han-residue.json`).
Archive against itself: 1277 slices, 75 refused;
every settled would-ship slice: 5520 slices, 233 refused,
every true fire from a run built before its floor.

### F-1: the address floor refuses correct English whenever any third-person pronoun appears anywhere in the slice

Status: fixed; the floor reads block by block and refuses only a surplus third-person pronoun.
Replayed old against new over 1,264 archive slices and 3,975 would-ship slices
(`~/temp/agent/audit-floor-replay/address-replay.mjs`): refusals 25 to 13, none added.
Cleared: every false refusal named here but lintong s1,
plus Huasheng s3 (an address rendered by name, no pronoun in its place),
MTF_0615 s8, Rentable_A s4 and windward0032 s4, s15 and s18 (omissions the judges read).
Kept: the person switches (Huasheng s7, Mizuki_Yuuki s5, yingying s2 twice, XingZ60 s110 and s112),
the indirect-speech conversions this finding counted as switches (Xu_Yushu s12, shihai4h s15),
Xu_Yushu s28 (an omitted quote whose refusal asks for it back),
lintong s1 (the count's limit: a generic 你 beside a subject-dropped description),
and mikaela_khara s17, whose would-ship text belongs to another slice (the F-6 carving).
The `thirdPerson` filter in `droppedAddressFindings` scans the whole slice;
the header names 干干你的 as left to the judges and the built floor refuses it.
Also counted as addresses: 迷你,
你们好,
你追我赶,
你我,
generic 你.
False archive refusals: BI4PBV s3, Zha_Ke s3 (a vocative), Y1Ran s18, Xu_Yushu s15, lintong s1;
hulicaijia8 and hulicaijia13 had "“Sis! What's wrong!” I kept calling out to her" refused.
Fix: refuse only a surplus of third-person pronouns over the original's own,
and drop the non-address patterns.

### F-2: publication checks cannot re-verify pages an earlier build published

Status: closed by A16b and A16c, by the owner's choice rather than by the fix first proposed.
`inArchiveTypography` re-applies today's typography to old artifacts,
so 77 of 209 pages built before class one hundred eighty-one no longer reproduce by splice.
Fix first proposed: record the per-slice text shipped at publish and verify against it.
Re-measured on 2026-09-27 as 77 of 214 (A16c), and put to the owner,
who chose that a pass rewrites such pages to the running build's reading.
`verify-published` now names such a disagreement `READ BY ANOTHER BUILD` with both digests,
and a pass resumed in the directory republishes the page, after which it verifies;
a record proving an old page equals what its own build shipped would serve no reader,
since the page is rewritten rather than kept.

### F-3: no floor refuses a Han name or line left in English prose

Status: fixed; the floor in `translate-han-residue.ts`, the identity flag in `identity-han-items.ts`.
shihai4h2 shipped "Wrong,\n小柿子." (the archive has "Wrong.");
the identity context shows the archive's untranslated Han alias as the English declaration.
Fix: a Han-residue floor outside comments,
code,
destinations and attributes, excusing a parenthesized gloss;
mark a Han-only TRANSLATION value as untranslated.

The floor refuses a run of Han (with any kana and 々 inside it) in the candidate's prose,
read outside `protectedRanges` with comments and title-floor-accepted titles cut.
It excuses a parenthesized gloss, a kana line with no Latin letter (a Japanese quotation kept beside its English),
and a run the original and the page both carry.
THE FLOOR IS RELATIVE TO THE PAGE, chosen so the archive's deliberate keeps (the 澪 a name is written with,
Japanese lyric lines, a hidden line inside an element) do not fail their own slices;
it refuses Han a candidate adds, not Han the archive already carries from the original.
It runs with the untranslated floor in both the readable and unparseable branches (the F-5 lesson),
and a copied original is named once, by the untranslated floor.

Measured with a prototype over the census (`~/temp/agent/audit-floor-replay/han-residue-census.mjs`,
`han-residue-prototype.mjs`), then with the built floor (`han-residue-port.mjs`), no per-slice delta:
of 1,264 archive slices 14 carry Han in prose and 4 are refused;
of 3,975 would-ship slices 98 carry Han and 68 are refused.
The four archive refusals are one entry's quotations the archive left untranslated
and respelt in traditional characters where the original writes simplified (一抹陽光 against 一抹阳光),
so on those slices the incumbent cannot stand in and a lane must translate them: chosen, not overlooked.
Every would-ship refusal matches a house rule:
handles left in Han (小柿子, 锦心, 雨狸, 洁澄天奏 and others), terms (大证, 贴贴, 药娘),
titles, a corner-bracketed word, and the Chinese half of a pair the original gives in both languages.

Two mistakes surfaced on the way, both fixed.
A bracketed title carrying both Han and Latin letters (《舞萌DX》) fell between the Han title floor,
which reads Han-only titles, and the Latin title floor, which reads Latin-only ones,
each header naming the other;
a pin asserted a bare 《Nyan物语》 in English prose valid.
`withoutGlossedTitles` now cuts every glossed title carrying Han,
so a glossed mixed title passes as a glossed Han-only title does and a bare one is refused by the residue floor.
And the first port of the floor iterated a line by code point against flags indexed by UTF-16 unit,
which would have shifted every flag after a character outside the basic plane;
lint caught the spread, and a guard now pins the alignment.

The identity line now names each TRANSLATION item written in Han alone as still in Han and no English rendering,
item by item, since the shihai4h value mixes Han items with a Latin one (`小柿子, 猫小泪, u3`).

### F-4: the suicide floor refuses ordinary English and its census counted entries, not slices

Status: fixed; an attempt on a life, a death by one's own hand after a death word,
and an attributed quotation of a published work pass, and the finding no longer says "she".
Replayed old against new over the same 5,239 slices
(`~/temp/agent/audit-floor-replay/floor-replay.mjs droppedSuicideFindings`): refusals 11 to 8, none added;
the three cleared are the correct English this finding names (one phrasing, one quotation in two builds),
and each of the eight kept drops or blurs the word.
The header's entry census is corrected by the slice replay.
"Died by her own hand" had no replay case; it is guarded by an invented one.
Refuses "attempts on her own life",
"died by her own hand",
and a canonical English quotation whose Chinese added 自杀;
the message hardcodes "she".

### F-5: a source the strict grammar refuses turns off floors that need no grammar

Status: fixed for the floors; the disagreement over `unknown` moves to X10.
The untranslated, line-count and neutral-pronoun floors run before `unknown` is returned.
`validateTranslatedSlice` returns `unknown` before the untranslated,
line-count and neutral-pronoun checks;
stages disagree on what `unknown` means.

### F-6: `carveSettled` does not carve as the pipeline did

Status: fixed in `c7f534353` (red guard `83f35d955`), with A18.
It omits `includeFrontMatter`, `frontMatterAuthority` and `sealArchiveOriginal`,
shifting slice indices by one on archive-authority entries.
`carveSettled` now carves through `rebuildPreparation`, which reads every flag off the artifact,
so the probes, the rendering audit and republishing share one carve,
and it reports whether the carve reproduces the run's rows (the displacement probe warns when it does not).
`includeFrontMatter` defaults to true, so only the authority and the seal moved a carve;
the guard carves an archive-authority entry, which the old code sliced with an extra metadata slice.

### F-7: the line-structure floor counts HTML comment lines

Status: fixed; content lines are read outside comments and one line reads "1 line".
Replayed (`floor-replay.mjs compareLineCounts`): refusals 23 to 21, the two cleared being these slices, none added.
yulianNyanner s8 and s12 archives refused;
the message prints "1 lines".

### F-8: the sheet-leak floor misses six labels its own sheets print

Status: fixed with E7; every fenced header line is refused whatever its label,
and the list gains the missing heads for unfenced copies.
The guard calls the floor directly: through the composed verdict the added block is refused by the block comparison first,
which hid the gap.
Replayed (`floor-replay.mjs sheetLeakFindings`): no refusal before or after, so the fence rule refuses no page text.

### F-9: the neutral-pronoun floor never reads the original

Status: fixed; the floor takes the original and asks only where it writes TA, Ta or ta.
Replayed (`floor-replay.mjs neutralPronounFindings`): the same four refusals before and after,
each on an original that writes the pronoun; the false ones were constructed controls, now guarded.
"The TA graded the cat's homework." (助教) and "Ta!" are refused.

### F-10: `assertHeadingsStayDistinct` goes silent when heading counts differ

Status: fixed; a page heading repeated more often than the original repeats any heading refuses whatever the counts.
Measured (`~/temp/agent/audit-floor-replay/heading-replay.mjs`) over 92 archive pages and 213 fixed run pages:
only yuliannyanner3 refused, as before.
A first version counted one heading as a repeat and would have refused yingying's archive and 12 runs
(an added heading on an original with none); caught by the measurement before commit.

### F-11: the glossary floors refuse a glossed Han title the title floor allows

Status: fixed; the glossary floors read the candidate with the accepted title occurrences cut.
Latent: no replayed slice carries such a title, and the community floor adds no refusal.

### F-12: low items

Status: the first two fixed; the plausible pair measured and closed, no gap in the current build.
`ArchiveOriginalCompletenessError` stores neither entry nor span;
the declared-link floor refuses Zhihu @-mentions the archive rendered as the user's slug; owner, 2026-09-27, "Account handle": an @-mention of a declared person may carry the account handle the page writes under the same link.

The error now carries `entryId`, `spanIndex`, `startOffset` and `endOffset` as fields, and its message the offsets (guard shown red with one field unset).
The declared-link floor passes a rendering whose link text, under the href of an original @-mention of the declared person,
carries an @-handle the page writes under that href, and its finding offers the handle;
a link naming the person without a mention still owes the declared form.
Measured through the composed verdict: the GLaDOSister s8 and Kotori s8 archives went from refused to passing;
zhangyubaka s18 is refused first by the suicide floor, one of its eight kept refusals.

The plausible pair, read from the code:
a lanes-agreed text is the translate lane's delivered text, which is a candidate `translate-floor.ts` passed
through `validateTranslatedSlice` with `lineStructured`, `declared` and `disputedWordings`,
and then only the semantic wrap, which splits prose lines, never joins them, and skips governed slices;
a repair-lane text ships otherwise only through the contest verdict (line structure read since H2)
or the consolidation's `readStandingVerdict`, both of which call the floor.
So the repair lane not calling `validateTranslatedSlice` leaves no unfloored path to the page.
Re-flooring every would-ship wording of the settled artifacts with today's floors
(`~/temp/agent/audit-floor-replay/refloor-by-decider.mjs`) refuses 163 of 1,961 contest winners,
51 of 853 consolidations, 11 of 269 lanes-agreed texts, 82 of 909 polishes and 7 of 163 page-assembly rows;
those artifacts were written by builds before the floors this audit added or tightened,
so the numbers measure how far the floors moved, not a live gap.
Plausible, unproven: nothing re-floors a lanes-agreed would-ship text,
and the repair lane never calls `validateTranslatedSlice`.

## Test suite

Probes: `~/temp/agent/audit-tests/`
(a runtime harness logging every `expect` that runs, `scan-corpus.mjs` and `classify-hits.mjs` for corpus text,
`run-container.mjs` for load runs, `magic-*.tsv`, `untested-dist-functions.tsv`, `coverage-holes.txt`).

### T1: an assertion that never runs

Status: fixed in `9603ff7a8`; shown to fail with chunk inheritance disabled (3 of 4 slices governed).
`document-preparation.unit.test.ts` "inherits the line-structure verdict from the enclosing CHUNK":
its loop runs zero times, because the verse fixture is too short to subdivide.

### T2: vacuous checks and catch-only asserts

Status: fixed in `75900e601` (oxlint does not flag an unused `using` binding), `5955c9d8e` and `38f59b737`.
32 `expect(<using binding>).not.toBe(undefined)` on disposables that are always objects
(`writer-grace-override`, `corpus-run/slice-overlap`, `grace-override`, `corpus-run/pass-entry`,
`corpus-run/artifact-pool-names`);
`assembly-content-survival.unit.test.ts` has no boundary case for its six-letter floor or its two-use cap;
`prompt-uniqueness-client.unit.test.ts` asserts only inside `catch`.

### T3: tests pinning wrong or retired behaviour

Status: partly fixed.
The two standing tests are renamed to what they assert;
the restore test no longer claims the owner's whole rule, and the behaviour gap it pinned is A17;
`dropped-covers-the-page.unit.test.ts` moves with S6.
`dropped-covers-the-page.unit.test.ts` pins the silent-original wording of S6;
`corpus-run/contributor-name-restore.unit.test.ts` pins handle restorations
that drop the literal gloss the house rule requires,
under a name citing the owner's "with the literal translation in parentheses";
`consolidate-gate-wire.unit.test.ts`'s class fifty-six name still says a kept standing would stop the entry;
`consolidate-standing-verdict.unit.test.ts` names "still stops the entry" and never asserts it.

### T4: corpus text and real personal data in about 45 test files

Status: fixtures fixed in `98054d72b` (58 test files).
A rescan on 2026-09-27 (`~/temp/agent/audit-tests/scan-corpus.mjs`, previous hits kept as `*-before.json`)
left shared markup, public facts, glossary entries that are dictionary terms by design,
and corpus quotes in comments and test names that cite an incident
(for example `name-gloss-restore.unit.test.ts:3`, `owner-cull.unit.test.ts:4`);
those wait for the owner's sanitization pass after the project.
A real birth date and hometown, a suicide-site sentence, method sentences, self-harm scars,
real names, handles and entry ids, and verbatim or near-verbatim corpus lines,
many under a header claiming "no corpus content appears here".
`package.json` `files` includes `src`, so the tests would ship with the package.
The owner said sanitization of the repository comes after the project;
the fixture rule (cat-themed invention) stands, so these are fixed as fixtures.

### T5: flaky timing

Status: fixed; the finding text below the measurements is as first recorded.
The contest case's delayed seats never answer, on an abortable timer: 5 of 5 pass at 0.2 CPU
(`~/temp/agent/audit-tests/t5-fix-summary.log`).
The naturalness-review sibling measured 5 of 5 at 0.2 CPU before any change and is left as it is:
its fake answers in microtasks, so the race read into it does not occur.
Real sleeps removed: the `stage-quorum` stall (30.49 s to 0.51 s),
the contest driver's production backoff (27.4 s to 0.55 s),
and the client's malformed-body case (11.98 s to 0.76 s).
`consolidate-driver` ran 10.24 s, 0.77 s after the fix:
its two positive controls ("reaches the roster" cases) passed only because
five production backoffs outlasted `driveWith`'s 5 s abort,
so they asserted a timeout, not a roster call;
they now count transport calls under a zero-retry client and assert the observed exits.
A sweep of all 729 test files for timers of 500 ms or more
(`~/temp/agent/audit-repair/long-timer-sweep.json`) found three more real waits:
the `benchmark` fake's two 2 s waits, now a fake clock the benchmark reads (`544169f98`, 2.36 s to 0.59 s),
the `stage-round-refill` slow seat, now abortable (`9441af9de`, 1.94 s to 0.46 s),
and `transient-retry`'s backoff, which is the behaviour under test and stays.
Long `settleWithin` and `armCallDeadline` timers are armed and cleared and cost no wall time.
The shapes read into the rest were measured, 8 runs each at 0.2 CPU
(`~/temp/agent/audit-tests/t5-rest-summary.log`, `t5-peak-summary.log`):
`synthetic-client`, `hyper-client`, `provider-router`, `transient-retry`, `budget-hold-wait`,
`refine-phase` and `lane-contest-driver` passed 8 of 8 and are left as they are
(a floor on a wait only grows under load; the `transient-retry` ceiling is a daily refusal's wait).
`stage-round` failed 1 of 8: time to the first answer (398 ms) passed the 250 ms grace it was compared with;
it is now anchored on when the first voice really answered (`c10d62663`), 16 of 16 after.
`consolidate-driver` failed 1 of 8 on the T6 order check this audit added,
ordered by 20 ms against 5 ms sleeps; both overlap cases now order by a gate (`d76d2424a`, M11),
16 of 16 each at 0.2 CPU after (`t5-gate-summary.log`).
`lane-contest-stage.unit.test.ts` "RECORDS RAW HALF-QUORUM BALLOTS" fails 2 of 5 at 0.2 CPU
(positive control: the `podman run` in `~/temp/agent/audit-tests/run-container.mjs`);
its sibling case, the naturalness-review grace case,
settle-by-timer checks in `synthetic-client`, `hyper-client` and `provider-router`,
and the driver trio's `peak` checks are the same shape by reading;
wall-clock floors in `transient-retry`, `budget-hold-wait`, `stage-round` and the benchmark have no slack.
Real sleeps: `stage-quorum` waits 30 s ignoring the abort signal;
`synthetic-client` and `lane-contest-driver` run production backoff.

### T6: names claiming more than they check

Status: fixed in `292939dab`, `6baf52dbe`, `bc80c8c14` and `6d7d83c1b`,
whose order checks were timing-ordered and are made deterministic in `d76d2424a` (M11);
the "trio" is two files (refine phase, consolidation driver) whose names claim the second call answers first.
`bedrock-catalog` "EVERY ROUTE" checks one route;
`synthetic-catalog` pins a literal price;
`block-pairing-protocol` compares a wrapper to its own builder;
the driver trio never asserts the second call answers first.

### T7: magic numbers

Status: fixed in `c0ce1a2c5`, `7a4d521ed`, `962770574`, `04a9f499a` and `e2c887ee7`;
`roster-reach` under E9.
`roster-reach`, `request-pace`, `synthetic-catalog`, `deepseek-v41-admission`, `synthetic-client`, `repair-slice-key`,
`anthropic-request` (a cap that should be computed from the exported caps),
and vote weights not derived from exported constants in `candidate-select` and `candidate-select-decision`.
The rule applied: a measured provider fact or owner limit is pinned once, where it is owned
(`hyper-catalog`, the GLM wire facts, the account limit in `request-pace`), with its source named;
every other test derives from the export.
Kept as pins, deliberately: `repair-slice-key`'s key literals, which exist to fail when a key changes,
and `request-pace`'s account limit.
`completion-cap` gained the only check that a pooled card name resolves to one shared figure;
before, the DeepSeek test's 13,082 literal was its only cover.

### T8: untested exported functions

Status: open; recounted 2026-09-27 at 79 of 1,178 barrel-exported functions
(`~/temp/agent/audit-repair/untested-exports.mjs`, list in `untested-exports.json`),
queued after the findings that change a run's output.
76 public functions named by no test;
a coverage sample shows `isPaymentRefusal`, `statedWaitMsOf`, `routedJson`,
`secondOpinionsFrom` and others never called,
and the decision reply's refusal branches never exercised.

### T9: every test run writes a log into `node_modules/.monochromatic/`

Status: open, owned by `module-logger` (issue #576, measurements added 2026-09-27).
1,220,455 files there; the tests are not hermetic.
Measured on 2026-09-27: most of that count is the deliberate `translation-repair-runs*` run directories;
the logs themselves are 34,919 top-level `*.log.jsonl` files (846 MB with the runs),
about 22 added per unit suite run,
and the logger's file sink (`package/module/logger/src/sink/file.ts`) reads no switch that could turn it off in tests.

## Page assembly and the corpus-run driver

Probes: `~/temp/agent/audit-assembly/`
(`replay2.out`, `categorize.out`, `chain-probe.out`, `fixtures.out`, `seats-probe.mjs`, `tally-check.out`,
`findings.txt`).
Replaying stored decisions through the current reader reproduces 93 recent pages byte for byte;
the other 41 differ only by typography code that changed after they ran.

### A1: an archive "Under Construction" placeholder ships, replacing a source heading on 8 pages

Status: fixed in `6a0a8cbf6`.
`archive-stub.ts` now reads a paragraph under blockquote markers and inside one code span,
and knows the token `under construction`.
A census over the 92 archives strips exactly two paragraphs,
XIEPT2 line 8 `(To-Do)` and XingZ60 line 358;
dogesir_'s "To be continued!" (the person's own words) and mikaela_khara's 未完待续 are no placeholders and stay.
XingZ60's archive ends at 三句承题, so the source sections after it are source-only and left to pairing.
`corpus-run/archive-stub.ts` knows `to-do`, `todo`, `tbd`, `wip` in one bracket layer;
XingZ60's archive writes ``>>> `Under Construction` ``,
all 17 shipped XingZ60 pages carry it,
and 8 have no rendering of the source heading 七句破题.

### A2: a Han handle left in English prose (with F-3)

Status: fixed with F-3; the shape is refused at validation, and the identity line no longer offers the Han as English.
shihai4h1 and shihai4h2 shipped "Wrong,\n小柿子."

### A3: CRLF from a model wording ships inside an LF page

Status: fixed in `f582157a9`.
`corpus-run/line-ending-fold.ts` folds every replacement first in the page-assembly guard,
before any other pass reads it, and records each changed slice as a row the page carries.
mikaela17 lines 223 to 225 end in `\r`;
`foldCarriageReturns` runs only at the corpus read.

### A4: archive link destinations rewritten to the source's Chinese-site ones

Status: fixed by the page-assembly pass `corpus-run/archive-destination-restore.ts`; owner, 2026-09-27, "Archive's English": where the archive links the English counterpart of the original's destination, the page keeps the archive's destination. Measured: 12 archive-only destinations in 92 entries, 3 of them localized (two zh.wikipedia to en.wikipedia, one source.android.google.cn to source.android.com) and 2 differing only by www.
shihai4h2 links PTSD to zh.wikipedia where the archive links en.wikipedia;
aiyysk links source.android.google.cn where the archive links source.android.com.

The pass pairs the links of a slice whose original and archive carry equal counts by position,
and keeps a replacement only where the original destination appears nowhere on the archive page,
the archive destination nowhere in the original, and the original destination is replaced one way.
Over 92 entries it reads six replacements:
the three localizations, a `www.` host, twitter.com to x.com, and a moved path on one host,
the last three the same kind of deliberate archive choice, kept under the same answer and open to the owner's veto;
a swap of two destinations both sides carry (noname3031) is left alone.
Replayed over settled artifacts it changes shihai4h s21, aiyysk s76 and s77, and luxuanwen3 s1.

### A5: seats with no wet provider are seated anyway

Status: kept by decision; its costs fixed under P3 and L1.
`corpus-run/run-seats.ts` `seated()` returns true on `NO_PROVIDER`;
TianqiChen66620 seated Qwen3.8-27B and glm-5.3 with no provider serving them,
logged 360 `NoProviderForModelError` lines,
and counted both in every quorum denominator.
This is the owner's rule of 2026-09-09 (`doc/decision/translation-repair-short-bench-share.md`, "The rule"):
a seat no wet provider serves stays on the judge benches,
so the quorum and the `stage-short-bench` findings mark a page decided on a thin bench.
Withholding it would hide exactly that.
Its costs were the round-0 place a refusal spent (P3, fixed)
and the checker bench it left short (L1, fixed);
what remains is the log volume of one refusal line per ask.

### A6: the handle-gloss pass moves a link title's translation onto a handle

Status: fixed in `2c6e42c27`.
A parenthesis holding a bracket, a nested parenthesis, a backtick, a tag or `://` is no gloss,
and that appearance stands as the writer left it.
The first fixture was vacuous (the authority step never read the linked signer);
the positive control led to a prose-link fixture, which reproduced the bug.
The fixed-point test passes on the old build too, so it guards the property only.
Reading replaced slices only is by design: the archive's own text is never rewritten.
`handle-gloss-place.ts` accepts any same-line parenthesis, link text included,
reads only replaced slices,
and is not at a fixed point when run twice.

### A7: deterministic page refusals are labelled ERROR and re-attempted

Status: fixed in `b11fd5409`.
`entry-error-outcome.ts` omits `CollapsedHeadingError`, `UnparseablePageError`, `PublishedPageDisagreesError`,
`UnansweredContestSliceError` and `SliceSpliceError` from the stopped set.

### A8: the README says an unfilled passage fails the entry; the code ships it as a gap

Status: fixed in `d721449e2`.
The README now says an unfilled passage ships as a recorded gap and an outage stops the entry INCOMPLETE.

### A9: the DONE line undercounts on a resume into a directory holding a decline

Status: fixed in `ead0a2d98` (prep `517facb2d`, guard `4127bfdcb`).
The pass skipped entries with an artifact or a decline,
then reported artifacts after the run less the size of that set.
The guard went red on the old formula with 0 where the run finished two entries,
and -1 where it finished none on a runs dir holding one decline.
`corpus-run/pass-finished.ts` reads the finished set the same way before and after the run
and counts the ids new to it.

### A9b: the decline listing reads an unlistable directory as no declines

Status: fixed in `150819e64` (guard `325f2d732`, found while fixing A9).
`declinedEntryIds` returned no declines on any listing failure (EACCES, ENOTDIR),
which would re-run every declined entry and drop it from `verify-published`'s count,
and it counted a directory named like a record,
the drift `pass-settled.ts` already records for artifacts.
It now lists with file types and throws `DeclinedEntriesUnreadableError` on every failure but absence.

### A10: TALLY `pageChanged` reads before typography

Status: fixed in `e0354d62d` (guard `48c573f20`).
The TALLY now reads each slice through `wouldShipTextPerSlice`, as the publisher does.
Replayed over the stored artifacts: hulicaijia31 34 to 31 and hulicaijia20 41 to 40, the audit's page counts;
TianqiChen66610 and TianqiChen66614 unchanged.
The test fixture now states `archiveText` and `pageAssembly`, which the contract requires.

### A11: logging gaps

Status: fixed.
The slice cache persists atomically and warns on a file that does not parse (`972682353`, guard `03af65966`).
The attempt store warns on each reset and each count read as zero, and writes atomically (`b9d5c8009`, guard `e68733836`).
`src/log-context.ts` (`907805225`) carries an `AsyncLocalStorage` context:
the pass runs each entry under its name and pipeline,
and the repair, translate, contest and consolidation drivers run each slice under its lane and index (`99c35e526`).
Every module root logger reads it (`842c1feff`),
the repair and translate lane loggers add the slice to every line,
and ledger rounds record it and are written atomically (`fdcd003ef`).
Guards: three calls queued behind one `p-limit` slot each write a SPEND line naming their own slice (`d0e912a0c`),
so the provider queue keeps the context;
the lanes' lines at overlap 2 (`d14346bb4`); a ledger round's context (`2e5d2ab38`);
and a source scan that fails on a plain module root (`07151e084`), which finds all 41 on the tree before `842c1feff`.
The consolidation driver's slice body was indented against its nesting (the X9 shape) and is now indented to it.
Client-layer loggers carry no entry
(3279 of 5914 lines of TianqiChen66616.log, SPEND lines among them);
the repair and translate lanes' lines carry no slice under overlap;
`slice-cache-namespace.ts` swallows a `SyntaxError`;
`attempt-store.ts` resets a malformed attempts file silently and writes it non-atomically;
ledger records carry no entry, slice, lane or generation.

### A12: `rebuildPreparation` silently fails to reproduce a folded entry

Status: fixed in `7c444de3e` (prep `f46f5a7b7`, guard `27e9ec7ea`).
mikaela15 records 34 slices and rebuilds to 32 with nothing named.
Attributed: mikaela15 settled at `caac222a6`, before `a43c5d88d` (class one hundred twelve) read an interior gap
unplaced on both sides as one merge; its section 2 leaves original blocks 3 to 7 unpaired,
which the run carved as source-only slices and today's slicer merges.
The artifact also records the carve after the carried-insertion fold, and nothing records the fold:
TianqiChen66614 rebuilds with position 13 moved (its log folds slice 15 into 14 and shifts 14's original into 13).
`RebuiltPreparation` claimed an empty gap list meant the run's own carve;
it now carries `reproduction`, read off the recorded rows (`artifact-two-lane-rebuild-rows.ts`),
naming the first departure.
`2c4207912` first read it off the recorded identity, which called every settled artifact moved
(see A12b); a commit comment on it records the correction.
Over stored artifacts: mikaela16, mikaela17 and TianqiChen66610 reproduce;
mikaela15 (32 of 34), hulicaijia31 (71 of 72) and TianqiChen66614 (position 13) move.

### A12b: the rendering audit refuses every settled artifact

Status: fixed in `da9ca20b0` and `487146cd2` (guard `ce97e60a2`, repin `d280961b0`; found while fixing A12).
`verifySettled` required the recorded preparation identity,
which also hashes the declared names as the run's build worded them,
and the recorded alignment findings, which include the roster pairing rounds' own (mikaela16's six);
a rebuild reproduces neither, so mikaela16, mikaela17 and TianqiChen66610,
whose rows match slice for slice, all printed REFUSED on `preparation.identity`.
A rebuild is now verified by its rows and by `verifyArtifactMeasurements`
(slice count, document sizes, alignment pairs, each lane's slice count);
the identity and findings checks stay in `verifyArtifactAgainstPreparation` for a preparation the run itself built.

### A13: the consolidation cache key omits the dispute note and the declared name pairs

Status: fixed in `c8f2a2af3` (prep `bcf31dae2`, guard `69d47d61f`).
Identity and reference context are in the run shape already,
and the dispute note has been in the slice key since X5.
The declared name pairs reached the key only through the identity context,
which renders the same front matter name and alias fields in other words;
`consolidateRunShape` now takes them as a required parameter and folds them in when there are any.

### A14: stale comments and README claims

Status: fixed in `55d895820`.
"As the page will carry it" (README, `canadian-forms.ts`, `page-slice-rewrite.ts`) is true since the K5 rounds,
so those lines stand.
"No stage assembles a document",
"as the page will carry it" for withdrawn slices,
"every appearance is in view",
"four stores",
"as the stage left them",
and every pass rewrite logged as "trimmed".

### A15: withdrawn-slice siblings of K5

Status: fixed with K5 in `3497e0041`.
A withheld container half enters the rounds as a withdrawn row does,
and a row a pass writes for it wins over the withholding;
cross-slice passes now decide on the page the guard leaves.
`restoredOnly` does not exclude `halves.withheld`;
cross-slice passes decide on a page the footnote guard may still change.

### A16: low items

Status: fixed (A16a to A16c); the write order is kept by design.
A lane wording's triple newline ships: not a defect.
Owner, 2026-09-27: "There is no need to eliminate extra newlines, because markdown doesn't care",
recorded in `doc/design-commitments.md`.
Measured before the ruling: 30 of 272 published pages carry a run of three newlines, most where the archive does too;
a wording whose trailing newline the archive span lacks adds one at the seam (XingZ616 slice 78),
and one that drops it joins no paragraphs (the page still carries the separator).
Asked the same day, the owner kept the A3 carriage-return fold.

#### A16a: the runs lock judged liveness by pid alone

A lock left by a killed pass named a pid the kernel later hands to any process,
and after a reboot pids start again from the bottom;
the lock then read as held by that unrelated process,
and the refusal told the operator the holder was alive.
Fixed in `ebf768e66` (prep `dc6826f6b`, red guard `0eac33216`):
the lock records host, boot, pid namespace and start ticks (`process-identity.ts`),
is taken over only on positive evidence (a later boot, a free pid, another start time),
holds when another namespace or machine took it,
and the refusal states how it judged (`runs-lock-holder.ts`).
Every one of the 96 locks on disk predates the fields and judges as gone by pid, as the old code did;
all of them come from killed runs, since every run directory holding an artifact had released its lock.
That fix compared hostnames before boot ids,
and `os.hostname()` can change within one boot (DHCP, `hostnamectl`),
after which every stale lock on the machine would read as another machine's and hold forever.
Fixed in `25ae252a1` (red guard committed just before it):
a boot id is random per boot, so equal boot ids prove the same machine,
and the hostname decides only between a later boot here (gone) and another machine (held).
This host's static and kernel hostnames agree today (`bazzite`), so no lock here met that order.

#### Write order: kept by design

The page is written before the artifact,
because a pass skips an entry once its artifact exists,
so publishing first makes "done implies published" true by construction (`publish-fixed.ts`, `pass-entry-persist.ts`).
A crash between the two writes leaves a page no artifact records;
none exists among the 214 pages in 372 run directories (a planted page was found, as a positive control).
The owner then ruled that a run always ships (`doc/design-commitments.md`),
so such a page ships and is reported, never refused.

#### A16b: the verifier exits 1 on findings

Status: fixed in `354f6bae7` (red guard `bd7c555b7`), `6898f1768` and `e52de1f23`.
The verifier exits 0 on every finding and 2 only for a run it cannot read,
each finding line names the pass that repairs it,
and a disagreement over an artifact another build settled prints `READ BY ANOTHER BUILD`.
Driving the built CLI for the guard found a further defect:
`publishedEntryIds` listed entry directories, not page files,
so an entry whose page was gone read as published, paired as matched,
and printed `REFUSED by Error` instead of `SETTLED AND NEVER PUBLISHED`;
it now lists entries by their page file.
The `DECLINED AND PUBLISHED ANYWAY` line promises that the next pass removes the page,
and a declined entry is never visited again,
so the pass's republish step now removes every page standing for a declined entry (`6898f1768`).
The runbook's expected lines had drifted from the real output (`declined=<n>`, the closing line's wording)
and now match it; the three `pass-entry.ts` references (M17) and a fourth,
`artifact-two-lane-project.unit.test.ts` naming it as the artifact builder's only caller,
now name `pass-entry-persist.ts` and `pass-entry-artifact.ts`.
Earlier state, kept for the record:
Owner, 2026-09-27: `verify-published` prints every finding and exits 0,
keeping exit 2 for a run it could not read at all.
Its messages also promise what no longer holds once a pass republishes
(`SETTLED AND NEVER PUBLISHED ... A resumed pass skips it`),
and three comments name `pass-entry.ts` as the home of the write order,
which moved to `pass-entry-persist.ts` when that file was split at the line cap.
It also calls a page "disagreed" when only the reader moved:
run over every stored page on 2026-09-27 it reports 77 of 214,
all of them pages that agreed with the build that wrote them (A16c).
Where the artifact's `pipelineDigest` is not the verifier's own build,
a disagreement is today's reading of an older settlement and must say so.

#### A16c: no pass republishes a missing or disagreeing page

Status: fixed in `3872729e1` (guard `498ddff1b`, shared fixture `ae21bcbf8`)
and, for the decline, `f98b2d87f` (prep `791e23e17`, red guard `2224ea2d7`).
Before any entry runs, `pass-republish.ts` judges every settled page with `page-agreement.ts`,
the verifier's own judgement since `2ce0e9f07`,
and `page-republish.ts` re-carves each missing or disagreeing one with the artifact's recipe,
over the archive the artifact stored,
and republishes it; a moved carve or a publish-time page check leaves the page and logs the class name.
The step sits after the `--plan` return and the build-generation guards.
A decline removes a leftover page before it writes its record.
Over scratch copies of all 214 stored pages:
137 agree, 51 are republished and every one then agrees
(49 differ from the old page only in typography, 2 by a blank line at a seam),
23 are left by the front-matter check, 2 by the destination check and 1 by a corpus read.
A first version spliced into the corpus copy instead of the stored archive;
the census caught it (shihai4h came out 9 characters short, and 23 carves read as moved),
since the pass reshapes the archive before it carves (`passArchiveText`, a heading relabel, `repairArchiveBlocks`).
At the user boundary, a real `corpus-pass --only mikaela_khara` in a scratch copy of mikaela17 with its page deleted,
nothing pending, rewrote the page, spent nothing and exited 0,
and `verify-published` then found 1 of 1 pages carrying every wording at the expected length.
Earlier state, kept for the record:
Owner, 2026-09-27: a pass starting in a runs directory rewrites from its artifact any page that is missing
or that differs from what the artifact says ships.
Following from that rule and the archive-note rule,
a decline removes a page an earlier crash left for the entry.
The first answer rested on a count that had only checked pages exist (M18).
The agreement census, `page-agreement.ts` over the 214 stored pages with the build of 2026-09-27:
137 agree at their weighed length and 77 disagree, and the extracted verdict matches the old composition on all 214.
None of the 77 predates `c36d597b5` (2026-08-24), which refuses a disagreeing page before it is written,
so each agreed with its own build.
The would-ship reader applies `restoreTypography` at read time,
and two fixes of 2026-09-26 changed it: `768408d1d` sets closing punctuation inside a quote (class 181),
`f4adc4c9f` curls a nested quotation as a pair (class 147).
By where each missing wording first departs from its page:
33 only by punctuation the reader now sets inside a closing quote,
20 only by a quote it now curls, 16 by both;
6 carry every wording and are a character long or short,
and 2 depart elsewhere too (a straight double quote, and one letter).
Told this, the owner chose again that a pass rewrites such pages to the running build's reading
(`doc/design-commitments.md`).

### A17: a handle every writer left in Han ships romanised with no literal meaning

Status: open (found while fixing T3).
The owner's rule of 2026-09-22 is pinyin as one capitalised word with the literal meaning in parentheses
at the first appearance.
`contributor-name-restore.ts` romanises a handle the page left in Han,
and `handle-gloss-place.ts` places only a gloss some writer wrote,
since it cannot invent a meaning;
so when every writer left the handle in Han the page ships the bare pinyin.
No floor refuses a candidate that leaves a handle in Han
(`translate-untranslated.ts` refuses only a whole slice returned untranslated),
so the writers are never asked for the gloss.
The fix belongs at the writers: a floor naming the declared handle a candidate left in Han.

### A18: the rendering audit rebuilds a carve over the corpus copy, not the archive the run carved

Status: fixed in `c7f534353` (red guard `83f35d955`), at the root:
`rebuildPreparation` carves over the archive the artifact stored,
and over the corpus copy only for an artifact written before that text was stored,
so the rendering audit, `carveSettled` (F-6) and republishing all carve as the run did.
Re-carving all 265 stored artifacts with the fix: 246 reproduce the run's rows and 15 move,
each with a cause already recorded (mikaela15's class 112 slicer change, TianqiChen666's unrecorded fold,
and the August pairing experiments), and 4 cannot be read (3 artifacts that do not parse, 1 corpus read);
hulicaijia31 now reproduces.
The A12 guard had stood in for a moved carve with an archive that gained a paragraph,
which the stored archive now overrides; it now changes the original instead.
Found while fixing A16c.
`readArtifactSubjects` in `rendering-audit-settled-input.ts` reads the archive English at the artifact's commit
and carves over it,
but a pass reshapes the archive before it carves (`passArchiveText`, a heading relabel, `repairArchiveBlocks`),
and the artifact stores the text it carved.
The same mistake in the first republish read 23 of 77 stored carves as moved and left shihai4h's page 9 characters short;
carving over the stored archive reproduced all 23.
The audit's own reproduction check reports the moved carves as departures from the run
(hulicaijia's `71 slices rebuilt where the run recorded 72` among them),
so the rendering audit refuses artifacts whose carve it would reproduce.

## Providers, routing and seating

Probes and full report: `~/temp/agent/audit-providers/report.txt`.

### P1: the Bedrock ledger records completed calls only

Status: open.
873 Bedrock streams ended unledgered across the logs (cut and overrun);
`bedrockIsDry` has no margin for calls in flight,
and the ledger reads 6.97 USD left.

### P2: the recovery round never re-asks a seat that answered unreadably before the last round

Status: open.
`stage-quorum.ts` overwrites the unreadable list each round and returns the seat to `pending`,
where the prompt-uniqueness cache answers it with the same bytes;
TianqiChen66620 slice 15's gate settled on neither 2 to 2 with one such voice lost.

### P3: seats the phase knows are unreachable fill the round-0 window

Status: fixed with guard `9466786dc`, fix `84a6caa02`.
Every retry round 1 had one or two refused seats in round 0.
The first reading of this entry said rounds then ran to the 360 s deadline;
that was wrong: no round in TianqiChen66619 or TianqiChen66620 ran past 181 s.
The real cost: a seat refused in the same millisecond spent the round's spare place,
so the round waited for its slowest reachable voice with no grace or fell through to a retry round.
TianqiChen66620 closed 269 of 421 rounds a seat short with no grace, 2,852 s of the 4,575 s its rounds took.
A refused window seat now hands its place to the next pending seat within the round
(`runGatherRound` `reserve`), and the seat stays on the bench as the 2026-09-09 rule has it.

### P4: the recall benchmark still seats gpt-oss-120b

Status: open (latent).
`repair-benchmark.ts` default judges;
`reachOf` ignores `OWNER_CULLED`.

### P5: the archive-block-review guard rejects a shape its prompt never forbids

Status: open.
All 11 guard rejections in five runs are editorial-context with a non-empty `sourceQuote`.

### P6: the seat tally cannot see an unusable reply

Status: open.
`SEAT inception/mercury-2.5 asked=1007 usable=1007 unusable=0` beside 40 schema losses.

### P7: abandoned-spend estimates mix units

Status: open.

### P8: a complete JSON value followed by more text is lost

Status: open.
36 in five runs, 760 across all logs, mostly mercury.

### P9: the router's cross-provider re-ask never runs in production

Status: open, owner call (it would break the prompt-uniqueness rule).

### P10: the deepseek-v4.1-flash card is stale against its own measurement rule

Status: open.

### P11: owner-rule enforcement relies on absence rather than a guard

Status: open.
Qwen3.8-27B and glm-5.3 stay off OpenRouter only because their cards lack an OpenRouter block;
no test covers every client body for thinking parameters.

### P12: log lines that cannot be attributed

Status: open (with A11).
Retry lines never name the model;
"ms to quorum" printed when quorum never stood;
`EveryProviderDryError` omits Bedrock;
`run-config.ts` says Qwen is withheld whenever Synthetic is dry.

### P13: low items

Status: open.
`transient-retry.ts` backoff ignores the caller's abort;
a payment refusal clears on any meter movement;
decision-seat structural losses marked reachable;
decision-seat prompts reach 30,203 of a 32,000-token context
and `ce824d933` adds the house rules to them with no size check;
the Bedrock stream bound spans the whole retry ladder;
card prices differ from the endpoint bought.

## Repair lane

Probes and notes: `~/temp/agent/audit-repair/notes.md`
(`seat-probe.mjs`, `regress-check.mjs`, `dispute-standin.mjs`, `ride-along.mjs`, `preservation-vacuous.mjs`).

### L1: every checker verdict rests on two voices

Status: fixed: the ballot floor with guard `8c4fc28e1`, fix `30e66051e`;
the measured bench with guard `f037a3eae`, fix `f10de5198`.
Qwen3.8-27B is seated as a checker with no provider serving it, so every reading is 2 of 3;
a 1 to 1 split is the most common outcome,
`regressed` never fired though checkers voted `worse` 55 times,
and XingZ6014 slice 87 resolved an issue on one ballot, which shipped.
Measured on 2026-09-27: 759 of 8,788 recorded checker readings over 403 run directories resolved on one cast ballot,
756 inside a selected patch.
The checker benchmark (85 settled fixes, and the same 85 issues against the unchanged archive text)
scored the bench that dominant reading seated, `gemma-4-26b-a4b-it` and `google.gemma-4-e2b` with Qwen3.8-27B unserved,
at 35 fixes resolved and 9 unchanged texts wrongly resolved;
the all-wet bench scored 82 and 4, and every bench of three from the measured order 81 or 82 and 2 to 5.
Fixed two ways: one cast ballot resolves nothing (`MIN_RESOLUTION_BALLOTS`,
`SLICE_CACHE_VERSION` 32, `REFINE_CACHE_VERSION` 5),
and the bench is the first three of `RUN_CHECKER_ORDER` a wet provider serves,
padded with unserved ranked seats only while fewer than three are served.
`regressed` keeps no floor: it only ranks a candidate and never ships text.

### L2: the archive-dispute stand-in is the archive's own wording whenever the repair lost

Status: fixed with guard `23cbbdaaa` (owner answer 2026-09-27, "No eligible standing");
sixteenth addendum of `doc/decision/translation-repair-ineligible-standing.md`, read issue by issue
(the stand-in stands only where the checkers confirmed every disputing issue resolved: 1 of 87 measured).
60 of 87 disputed slices;
the translate lane then keeps it as lane agreement and no contest runs;
a withdrawn text also becomes a stand-in.

### L3: edits the checkers did not confirm ship inside a selected patch

Status: open.
TianqiChen66616 slice 3 shipped "it left a trace of her turned to ash" (one ballot worse),
the patch having won on one resolved minor omission.

### L4: the editor preservation gate can never reject anything

Status: open.
Envelopes and licensed quotes are the same quotes;
`residualTokens` is 0 on 536 of 540 regions.

### L5: wrong panel acceptances

Status: open.
Glosses of works outside the panel's apparatus list;
a supplied object outside its forced-difference line;
footnote-carried attributions judged dropped;
an MDX editor comment deleted;
鲨鲨 (a plush shark) taken for a person;
a neutral "correctly renders" claim accepted and cut into an envelope.

### L6: the lane contest runs on insertion slices the repair lane does not apply to

Status: open.
31 wasted contests on XingZ6014.

### L7: the lane contest is shown probe claims about a patch that lost

Status: open.

### L8: a heard ballot with no usable verdict still counts toward quorum

Status: open.

### L9: the dispute rule reads the critic's filed severity, not the adjudicated one

Status: fixed in `6a0f68cec`, guard `b15ba5464`
(owner answer 2026-09-27, "Adjudicated";
seventeenth addendum of `doc/decision/translation-repair-ineligible-standing.md`).

### L10: the attestation screen only looks at addition claims

Status: open.

### L11: refinement on a slice whose patch lost gets no recheck

Status: open (class one hundred eight's open half, with H4).

### L12: logging gaps in the repair lane

Status: open (with A11).
No chunk index on critic,
editor,
checker,
refine,
select and probe lines under overlap;
ballot irregularities never logged.

### L13: stale TSDoc and comments

Status: open.
"must ship unchanged",
"Nothing ships from any of them",
"judges that wrote none of them",
"no stage decided by a single model",
the dispute header,
the preservation-check claims.

### L14: smaller items

Status: open.
The resolution checker sheet has no identity, references or claim quotes;
editors write neighbouring text into an envelope;
`selectChunkPatch` tells judges a decline keeps the trusted text while an indecision ships the strongest patch.

## Docs and comments against code

Probe scripts: `~/temp/agent/audit-docs2/`
(`backticks.mjs`, `repo-wide.mjs`, `examples.mjs`, `owner-quotes.mjs`, `hygiene.mjs`, `class-dates.mjs`, `pairing.mjs`).
Roster values were computed from `src/corpus-run/run-config.ts` itself:
`RUN_ROSTER` 9 seats, `RUN_READER_MODELS` 6, 7 wide seats, 8 late judges.
Paths below are package-relative.

### D1: the README says the editor roster check still requires disinterested judges

Status: fixed in `4397d7d2a`.
`README.md:301-303`; `repair-contract.ts:224-229` says the 2026-08-14 ruling removed that requirement,
and the check refuses only repeats, no editor, or judge capacity short of the minimum weight.

### D2: the schema generation the pass writes is misstated in three places

Status: Markdown fixed in `4397d7d2a` (generations 1 and 2 use the chunk spelling, 3 is mixed);
the two `.ts` comments below are open.
`doc/configuration.md:326`, `:334`, `:352` say generation 4 and three generations;
`artifact-schema-version.ts:34` says V7;
`corpus-run/artifact-two-lane-contract.ts:36` says V12.
The pass writes V14 (`corpus-run/artifact-two-lane-build.ts:260`, `corpus-run/pass-schema-guard.ts:426`)
and reads generations 1 to 14.
`artifact-schema-version.ts:42-90` stops its history at version 9.

### D3: pull-request runs are documented through a variable nothing reads

Status: fixed in `4397d7d2a` (two probe variables were also missing);
two repo docs outside the package still name the variable (D18).
`doc/configuration.md:293-295` names `TRANSLATION_REPAIR_CORPUS_DIR` and an uncommitted fork;
production reads `TRANSLATION_REPAIR_CORPUS_CLONE_DIR` and `TRANSLATION_REPAIR_CORPUS_COMMIT`
(`corpus-run/corpus-pin-override.ts`), documented nowhere in the package.
`doc/configuration.md:5` claims every knob is listed and omits six.

### D4: the OpenRouter checker substitute is misnamed

Status: fixed in `4397d7d2a`, then superseded by `f10de5198`, which replaced the substitute with the measured order.
`doc/design-commitments.md:177` says gemma-4-26b-a4b-it;
`corpus-run/run-seats.ts:113` has `google.gemma-4-e2b`.

### D5: the removed preparation layer is described in the present tense

Status: fixed in `4397d7d2a`; two `.ts` comments still describe it (D16).
`doc/seats-and-calibration.md:50-239` names about fifteen identifiers,
four artefacts and two mise tasks removed in `cbedea357`;
`:124` claims a bootstrap build dependency `mise.toml` no longer has.
`blockPairingQuestion`, `blockPairingProtocol` and `prepareBlockPairing` survive.

### D6: stale constants and counts in the docs

Status: Markdown fixed in `4397d7d2a`; `corpus-run/run-config.ts:785` is open.
`doc/pictures.md:89` says 8 MiB (7 MiB since 2026-08-22, `image-reading-stage.ts:120`);
`doc/configuration.md:18` says a run without the Synthetic key throws (every key is optional,
`corpus-run/run-providers.ts:94-130`);
`doc/configuration.md:201` says a stalled entry drops after its second try (its first,
`corpus-run/entry-reattempt.ts:214-223`);
the picture reader count is four or five in `README.md:353`, `doc/pictures.md:54`,
`doc/slice-context.md:316` and `image-reading-stage.ts:17,21` (six);
`README.md:109` says 20 Synthetic slots across four models (two models, 10);
`README.md:287` misdescribes stage quorum retries (`stage-quorum.ts:337-376`);
`doc/seats-and-calibration.md:458` says ten editors (nine);
`corpus-run/run-config.ts:785` says a 90 minute entry ceiling (420);
`doc/provider-availability.md:67,114,121` frames two providers (four meters).

### D7: the OpenRouter routing description is stale

Status: fixed in `4397d7d2a`.
`doc/configuration.md:73,81-85` and `doc/roster-changes.md:25-31`
against `model-cards.ts:209,320-328` and `openrouter-catalog.ts:98-100,263`.

### D8: comments name functions that never existed

Status: open.
`image-reading-pair.ts:393` names `runStageRound` (`runGatherRound`);
`declined-target-runs.ts:44` names `pairBlocksAcrossRoster` (`pairBlocksWithRoster`);
`artifact-key-vocabulary.ts:19,47,104` miscounts its keys and misdates a table.

### D9: examples call the wrong function or pass keys it does not take

Status: open.
Wrong callee or keys:
`contributor-translation-guard.ts:22`,
`corpus-run/displacement-probe.ts:110`,
`delivery-coherence.ts:174,245`,
`editor-ensemble.ts:314`,
`consolidate-slice-buy.ts` (`buyConsolidationAttempt`),
`corpus-run/artifact-two-lane-read-naturalness-seat.ts:98`,
`corpus-run/pass-archive.ts:28`,
`restore-typography.ts:94-105` (no `@param` for `mask`).
These omit a required key:
`apply-patch.ts:194` and `editor-ensemble.ts:472` (`preservation`),
`corpus-run/artifact-two-lane-consolidate.ts:446` (`sliceIndex`),
`corpus-run/artifact-two-lane-read-contest.ts:68` (`keys`, `generation`, `comparison`),
`corpus-run/artifact-two-lane-read-rows.ts:52,140,278` (`keys`),
`corpus-run/band-order.ts:140` (`settledPerBand`),
`corpus-run/bench-sample.ts:81` (`pin`),
`corpus-run/pass-entry-artifact.ts:56` (`pageAssembly`),
`corpus-run/pass-entry.ts:586` (`publishDir`, `declinedDir`),
`corpus-run/rendering-audit-settled-input.ts:282` (`runSetDir`),
`corpus-run/title-reference-locate.ts:411` and `corpus-run/title-reference-marks.ts:193` (`rendering`),
`document-readings.ts:74` (`readOcr`),
`front-matter.ts:320` (`openLength`),
`lane-slice-text.ts:196` (`notApplicableHere`),
`pair-agreement.ts:175` (`pairings`, `needed`, `pairingShape`),
`refine-eligibility.ts:224` (`minimumChars`),
`refine-slice-settle.ts:460` (`refineContributors`),
`repair-chunk-verdict.ts:108` and `repair-refine-step.ts:95` (`declaredNames`),
`repair-contract.ts:254` (`role`),
`sample-manifest.ts:166` (`generation`),
`slice-cost-log.ts:189` (`signal`),
`stream-drain.ts:191` (`label`).
The probe checked `function` declarations only, not arrow functions, methods or types.

### D10: owner quotes not in the record

Status: open.
`provider-name.ts:11` quotes the owner in the first person where the records hold a paraphrase;
`translate-runoff-tie.ts:25` truncates "prefer the best valid proposal, else fail the slice at once".

### D11: status and hygiene

Status: Markdown fixed in `4397d7d2a` except the ALL-CAPS paragraphs it did not touch (D19);
`seat-tally.ts:326` is open.
`doc/status.md` puts its history under the current heading,
names a consolidation cache generation 14 that collides with artifact schema generation 14,
says `assertFinalSelectionSettled` remains (removed in `1ba8f713a`),
and calls a 2026-08-26 audit current evidence.
ALL-CAPS emphasis across the docs,
lines over 120 characters in `doc/slice-context.md` and `doc/status.md`,
positional references (`doc/configuration.md:328`, `doc/status.md:105,123`),
an italic (`doc/status.md:428`),
unbackticked model ids,
double blank lines,
mixed list markers in the README.
`seat-tally.ts:326` cites an untracked script.

### D12: class dates and clock times

Status: open (`.ts` only; every Markdown clock time carries a zone, checked in `4397d7d2a`).
Four class dates match only the local day of their commit
(class seventy-seven, one hundred seventy-six, one hundred seventy-seven, one hundred seventy-eight);
`corpus-run/run-seats-wait.ts:14-18` and `corpus-run/run-seats.ts:66-67` give clock times with no zone.

### D13: a setting documented as read by launch logs that nothing reads

Status: open.
`corpus-run/run-config.ts:875-879`: the `RUN_CORPUS_PIN_SETTING` TSDoc says "for launch logs",
but nothing reads it, so no launch line names where the corpus pin came from.

### D14: an invalid Hyper request rate is not refused

Status: open.
`request-pace.ts:305` falls back to the default rate for an invalid `TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR`,
where every other dial refuses an invalid value.

### D15: probe variables exported empty are used as given

Status: open.
`corpus-run/damage-sample.ts:267` and `corpus-run/score-verify.ts:199` read their variables with `??`,
so an exported-empty `DAMAGE_SAMPLE_SEED` or `VERIFY_SHEET_BASENAME` is used rather than defaulted or refused.

### D16: stale comments on providers and removed features

Status: open.
`corpus-run/budget-sample.ts:14-27,54-55` says "both providers" (four);
`block-pairing-question.ts:41` and `block-pairing-protocol.ts:63` mention replay and receipt planning
that `cbedea357` removed;
the `SLICE_SPELLED_KEYS` TSDoc in `artifact-key-vocabulary.ts` says generation 3 writes the slice spelling
and its header compares generations 1 and 2 with 4.

### D17: the recovery round re-asks only the last round's unreadable seats

Status: open (tracked as P2).
`stage-quorum.ts` sets `unreadable = answeredBadly` each round,
so a seat that answered unreadably in an earlier round is not re-asked; the README now states this behaviour.

### D18: repo docs name a corpus variable nothing reads

Status: open.
`doc/runbook/translation-repair-corpus-pass.md:38` and `doc/handover/translation-repair-handover-2026-08-29.md:379`
name `TRANSLATION_REPAIR_CORPUS_DIR`.

### D19: ALL-CAPS emphasis left in untouched paragraphs

Status: open.
`README.md`, `doc/configuration.md`, `doc/design-commitments.md`, `doc/pictures.md`,
`doc/provider-availability.md`, `doc/roster-changes.md`, `doc/seats-and-calibration.md`,
`doc/slice-context.md` and `doc/status.md` keep ALL-CAPS emphasis in paragraphs the D fixes did not reach
(the docs agent's report of 2026-09-27 lists the lines).

## Found while fixing

### X1: the translate lane stopped the entry on a rejected slate over an archive the floor refuses

Status: fixed with the fifteenth addendum's translate-lane extension (sixteenth addendum).
`translate-stage.ts` treats an archive failing the floor as an absent incumbent;
two rejected production rounds rethrew `TranslateAbsenceError`,
and `translate-slice-attempt.ts` rethrows it for a content slice,
so the entry stopped.
Guard: `slate-decline-ships-by-preference.unit.test.ts` (the translate stage case).

### X2: a scripted gather-stage test's seat rotation depends on its prompt text

Status: open (test fragility, with T1 to T9).
`stage-fanout-window.ts` picks the seats to ask by an FNV-1a hash of the prompt modulo the roster size,
so rewording a fixture changes which scripted seat is heard;
`reference-attest.unit.test.ts` and `reference-attest-confirm.unit.test.ts`
failed against a passing HEAD on a reworded fixture
until phrases matching HEAD's rotation were chosen.
A test that depends on which seat is heard should pin the rotation rather than inherit it from its text.

### X3: comments and TSDoc quoting corpus text or handles in source files

Status: open (with D11).
`reference-attest-match.ts:18-19,29-30,48-50`,
`translate-suicide-drop.ts:4-21` (quotes a method, a date and handles),
`rendering-glossary-phrasing.ts:56,76-79`,
`archive-original-note.ts:37-53`,
`markdown-blocks.ts:13`,
`bilingual-pair-bound.ts:25`,
`bilingual-line-clause.ts:19`,
`corpus-run/run-config.ts:106`,
`image-asset.ts:45`,
`image-reading-stage.ts:98`;
and in untouched tests, names in comments and test names
(XingZ60 32, hakureico 23, Toka_ls 6, gqt 6, Yumao 5, aiyysk 3, lintong 3, 羽毛 3, Ling 2, Hanasaka 1),
Yumao and 羽毛 as string literals.
The owner defers sanitization to the project's end;
the method quote in `translate-suicide-drop.ts` is the one the reader-protection rule covers now.

### X4: the consolidation producers' repair turn re-checked revisions without the declared names

Status: fixed with the sixteenth addendum.
`consolidate-produce.ts` validated each proposal with `subject.declared`
and passed no `declared` to `repairInvalidCandidates`,
so a revision that dropped a declared name passed the re-check.

### X5: neither slice key named the archive dispute

Status: fixed with the sixteenth addendum.
`translateSliceKey` and `consolidateSliceKey` hashed the texts but not the dispute note,
so a slice judged under accepted claims could resume a record settled for the same texts undisputed,
and with the archive as incumbent on an unresolved dispute the texts would be identical.

### X6: the translate lane's refusals keep an archive the floor refuses

Status: open.
`translate-slice.ts` gates its alignment, quote-loss and declared-name refusals on the slice having archive wording,
not on that wording passing the floor,
so a replacement refused there ships the floor-refused archive as the lane's text
(shihai4h2 slice 14 kept a 1665-code-point archive against a 102-character source);
the consolidation then refuses it as a standing.
The disputed case no longer does this; the floor-refused case needs the stage's eligibility on the record.

### X7: windowed stages re-ask a seat the router refused

Status: fixed with guard `9466786dc`, fix `84a6caa02`.
`stage-windowed-rounds.ts` put every seat that never answered back on its pending list,
a refused one included,
so the lane contest, pairing, the gate, the naturalness review and the polish gate
re-asked a seat no wet provider served in every retry round
(a four-seat fixture asked it four times).
`stage-quorum.ts` fixed the same defect on 2026-09-09 (`hulicaijia`); this path never got it.

### X8: windowed stages size quorum over the seated bench

Status: open.
`runWindowedRounds` takes `heardNeeded` from `rosterQuorumSize` over the seated bench
and never applies `reachableQuorum`,
though the 2026-09-09 addendum of `doc/decision/translation-repair-short-bench-share.md`
says the reachable share sizes every gather.
A windowed stage whose reachable seats cannot meet the bench quorum spends its retry rounds and closes short
without the `stage-short-bench` finding the gathers carry.

### X9: code indented against its nesting, which no check reads

Status: fixed in `632ef5fbc` and `f7b766fa4`; enforcement is issue #577.
`runCriticBenchmark`'s inner attempt, its `try` body and its retry block sat two to three levels too deep
for about 190 lines of `benchmark.ts`;
a test body in `repair-translation.unit.test.ts` dropped two spaces for about 60 lines,
and the stall case in `stream-idle-guard.unit.test.ts` left an argument and its assertions too shallow.
All were lint-clean: the dprint TypeScript plugin was retired for `oxlint-plugin-stylistic`,
which has no indentation rule.
A heuristic scan of the 1666 source files flagged 35 lines, the rest being template-literal ends
(`~/temp/agent/audit-repair/indent-scan.mjs`).
The trailing-comma drift in some test files is not a finding:
`package/config/oxlint/src/overrides.ts` lets tests lay out calls freely and no config enables `comma-dangle`.

### X10: a slice carved through an element can never settle, and the stages disagree on `unknown`

Status: open, with #379 (carving).
NIGHT81473140 slice 22 of the deterministic carve opens a `<blockquote>` that closes in a later slice,
so the strict grammar refuses the original (`end-tag-mismatch` at 1:1) and the verdict is `unknown`.
The producers read `unknown` as a pass (`translate-floor.ts` keeps any voice not `invalid`;
`translate-repair.ts` lets it stand with a `translate-unvalidated` finding),
while every gate reads it as a refusal (`translate-stage.ts` keeps the incumbent off the slate;
`lane-contest-eligibility.ts`, `consolidate-lane-offer.ts`, `consolidate-standing-verdict.ts`
and `consolidation-polish-round.ts` accept only `valid`),
and a candidate that mirrors the cut fails the strict grammar itself and is refused as unparseable.
The slice can therefore never settle, and the entry stopped;
since the owner's ruling of 2026-09-27 ("Keep archive, ship") no wording passing the rule keeps the archive there,
so the entry ships with the slice on its `DEFECTS` line, but the slice is never improved.
The root is the carve cutting an element; once carving keeps elements whole,
`unknown` means an original the upstream MDX compile would also refuse, where refusing is right.
One slice of 1,277 in the replay; no run has reached it (no settled artifact exists for the entry).

## Process mistakes in this audit

These are the agent's own mistakes while fixing, recorded for the prevention doc.

### M1: `;` in shell commands

Status: recurring.
At least five times on 2026-09-27
(`sed ... ; sed`, `node <guard> ; rg`, `rg ... ; ls`, `xargs <lint> ; rg`, and one by the fixture agent),
against the rule of at most three `&&` and no `;`;
twice more later that day (`node <test> | rg ; node <test> | rg`, and one `rg` then `awk` by the docs agent),
and once a shell `for` loop over line numbers, which the same rule forbids,
and once `<test> | rg ... ; true` to force a zero exit;
twice more still (`<test> > log ; echo "exit $?"`, and `rg --files ... ; rg <config>`),
and once more during H2 (`<test> > log && rg --count FAIL log ; rg <name> log`),
and once during S19 (`sleep 1 && rg --count PASS log ; tail <output>`), a foreground sleep as well,
and once during S5 (`build > log && tsc | rg --count ; true`),
and once during S12 (`rg --count <file> ; rg --line-number <file>`),
and a foreground `sleep 1 && tail <log>` during #379.
During A6 a test file was edited while the full suite ran,
against the rule that nothing the suite reads changes until it finishes.
Twice more during A11 (`node --print ... ; ls`, and `rg <roots> | rg --invert-match ; rg --count`).
Also during A11, a wrap script matched the first line of a multi-line signature as its end;
the diff showed it before anything was committed, and the four files were restored from HEAD.
Prevention for scripted rewrites: print each located boundary and read the diff before lint or commit.
Once more during A12b (`<test> | rg ... ; echo done`).
Twice during E1 and E4:
`<test> > log 2>&1 ; rg --count` to capture a test's output,
and a heredoc appended to a test file with the lint command on the next line,
two commands no `&&` joined.

### M19: a suite run against a stale build after a mutation was restored

Status: caught the same hour, 2026-09-27 (E1).
The package's `test:unit` task runs the tests against `dist` without building;
only `buildAndTest` builds first.
After a mutation check the source was restored with `git checkout --`
and the suite launched through `test:unit`,
so it ran against the mutant's build and reported its two guards failing.
Prevention: every suite run goes through `buildAndTest`,
and so does any single test file run after a source change,
through `mise run build` first.

### M20: docs naming a log line the code never writes

Status: corrected, 2026-09-27 (E4).
The README and the corpus-pass runbook both said dropped addresses reach the run log at `info`
under `publish: dropped destination`;
no such line exists, and the real one is at `warn`,
reading `entry <id>: page drops source destination <address>`.
Prevention: before a doc names a log line, a message or an output line,
`rg` the source for the exact string and copy it from there.

### M21: a check that could not fail

Status: corrected in `d2f0e07ef` (E4).
A test asserting that a throwing settlement bought no judge read its counter off the return value,
which a throw never delivers,
so the assertion held at its initial zero whatever was bought.
A parser test named "listing the two it does" had pinned three kinds, and later four.
Prevention: a counter or state a throwing path must leave untouched is held by the test outside the call;
test names describe the property, not a count that the next change makes false.

### M15: a finding carried and a fix started against an owner ruling

Status: corrected; the ruling is now in `doc/design-commitments.md`.
A16 listed a triple newline as a defect, and a seam-spacing guard was written for it,
though the owner had said extra newlines need no fixing, since Markdown renders them alike;
the ruling was in no package doc, so neither the audit that filed A16 nor the fix read it.
Owner, 2026-09-27: "There is no need to eliminate extra newlines, because markdown doesn't care. I believe I said this before."
Prevention: an owner ruling goes into `doc/design-commitments.md` (or its decision record) the turn it is given,
and a finding is checked against those commitments before any fix starts.

### M18: a count put to the owner that measured something narrower than the option it backed

Status: corrected by re-asking, 2026-09-27 (A16c).
A question said a page had never disagreed with its artifact, "0 of 214 pages across 372 run directories";
the script behind the number had compared which files exist and never judged a page against its artifact.
The owner chose on that premise; judged, 77 of 214 disagree.
The ledger already said so: F-2 recorded 77 of 209 pages that no longer reproduce by splice,
so a search of this file before asking would have caught the claim.
Prevention: every number in a question option names the check that produced it,
and a claim about a state is backed by a run of the instrument that decides that state,
with its positive control, before the question is asked;
and the ledger is searched for the state (`rg` over `doc/audit-ledger.md` and `doc/status.md`)
before any claim that it has never occurred.

### M17: a file split at the line cap, with comments elsewhere still naming the old file

Status: corrected in `e52de1f23` (four references, one more than first counted).
`pass-entry.ts` was split at its line budget and the write order moved to `pass-entry-persist.ts`,
yet `published-page-check.ts`, `verify-published.ts` and a `publish-fixed.unit.test.ts` case name still
credit `pass-entry.ts` with it.
A reader sent there finds no write at all.
Prevention: every split runs `rg` for the backticked old filename across `src`, tests and `doc`,
and each hit that names a moved responsibility is repointed in the same commit.

### M16: a commit message claiming records not yet written, and a hash typed rather than resolved

Status: corrected by a commit comment on `5ab33539f`.
Its message said A13, A14 and K5 were already in the ledger; they were recorded in the next commit.
The first attempt at that comment named a full hash typed out by hand, which GitHub refused as no commit.
Prevention: a commit message states only what `git show --stat` of that commit shows;
every hash is resolved with `git rev-parse` in the same command that uses it.

### M14: a reproduction check committed without a positive control

Status: corrected in `7c444de3e`, with a commit comment on `2c4207912`.
The A12 fix compared the rebuilt identity with the recorded one, checked only against a synthetic fixture,
and was committed before any stored artifact was run through it;
every stored artifact then read as moved, mikaela17 among them though its rows matched slice for slice.
The same shape recurred one step later, when the rendering audit's rows-plus-measurements check
was committed with the alignment findings in it and every reproduced carve still refused.
Prevention: a check that classifies real artifacts runs over stored ones before its commit,
with at least one that must pass and one that must fail (QPC), and every class it can print is read.
A related shape, `<test A> | rg --count FAIL || <test B> | rg --count FAIL`, never ran B when A went red (S10);
and `mise run --cd <package> build` once, against CM5.
The first `;` one also hid which of two files failed, since both counts printed as one number.
Prevention: a report that should run after a failing command is `a || b`, never `a ; b`;
two independent checks are two tool calls.

### M2: a wording change committed without the full suite

Status: fixed in `0cf2017b3`.
`e8f0b0369` reworded house-policy sentences and bumped a cache version with single-file runs only;
three pins broke (the version 17 key literal, the corner-bracket sentence, the place-as-means sentence).
Prevention: any sheet wording or cache version change runs the full suite right after its commit
(GCE puts the commit first) and before the next change builds on it,
and a version bump repins its key literal in the same commit.

### M3: a guard whose first red was a link failure

Status: fixed by the prep export `refactor(module-translation-repair): export archiveStandInFor`.
`archive-dispute-standing.unit.test.ts` first failed because `archiveStandInFor` was not exported,
which says nothing about behaviour.
Prevention: read each FAIL reason of a red run; a missing export gets its own prep commit first.

### M4: a guard committed red with a lint warning

Status: fixed in the following fix commit.
`88fdb1923` carried a `no-mixed-operators` warning
because the lint step sat in an `&&` chain whose `rg` succeeded on warnings.
Recurred on 2026-09-27: the F-9 guard went in red with seven type errors,
because it passed `sourceText` to a floor that did not yet take it.
Prevention: commit only after the lint line reads `Found 0 warnings and 0 errors`;
a guard that needs a new parameter gets a prep commit adding the parameter first.

### M5: a new condition guarded on one branch only

Status: fixed (guard `88fdb1923`).
`bd98bdc70` refused the judged part of the incumbent whenever a target-only run was held out,
which refused an eligible stand-in with a trailing transcript;
the guard had no eligible stand-in with a held-out run, and review found it.
Prevention: a guard for a new condition covers every combination of the inputs it branches on,
with a positive control that must move.

### M6: edits attempted on files not read

Status: recurring, harmless (the tool refuses).
Twice more on 2026-09-27 (`tally-resolution.unit.test.ts`, `roster-fixture.ts`),
both files viewed with `sed` rather than the Read tool.
Prevention: read the region with the Read tool before editing it;
a `sed` or `rg` view does not count as a read.

### M7: an adopted reading parked in docs across a compaction

Status: fixed (owner confirmed "English letters" on 2026-09-27).
The "kept in English letters" reading waited in the planning doc for a veto instead of being asked.
Prevention: a reading adopted without the owner's answer is asked in the same turn.

### M8: asked the owner a measurable question

Status: corrected; measured, and the bench reseated in L1.
The agent asked which model should fill the third checker seat,
offering gemma-4-31b, Mercury 2.5, a stop, or no change,
when checker quality on the role's own sheet is measurable.
Owner, 2026-09-27: "Why don't you measure? Also Mercury 2.5 is really cheap so it's fine."
Measurement: `~/temp/agent/audit-repair/checker-cases.mjs` builds 85 pairs from twelve runs
(a unanimous-fixed patch, and the same issue against the unchanged archive, where not-fixed is certain);
`checker-bench.mjs` and `checker-bench-raw.mjs` score each candidate on the resolution sheet.
The owner approved Mimo v2.6 Flash and Mimo v2.6 Pro on OpenRouter the same day,
then Solar Mini 4 (`upstage/solar-mini4`);
all three are among the candidates.
Solar Mini 4 is out of the checker seat on its first reading:
78 of 85 positives called fixed,
but only 7 of 85 unchanged archive texts called not-fixed,
so it calls almost any text fixed.
Result: the ranked order in `RUN_CHECKER_ORDER` (L1).
The Mimo candidates were first scored by raw fetch without `zdr`;
through the run client Mimo v2.6 Flash reaches only DeepInfra, its one zero-retention endpoint,
and scored 81 and 80 at 3.9 s median against 82 and 79 at 0.35 s.
A measurement for a seat is taken on the route the run uses.
Prevention: a model-for-role choice is measured on that role's task before anything is asked;
only what a measurement cannot settle goes to the owner.

### M9: a ledger claim written from a summary rather than measured

Status: corrected in P3.
P3 said rounds ran to the 360 s deadline; the two runs it cited had no round past 181 s.
Prevention: a timing or count in a finding is read off the log it cites before the finding is written.

### M10: lint run on changed files only

Status: fixed in `13c3f51af`.
Every batch linted the files it touched,
so two `unicorn(consistent-function-scoping)` warnings from `0aa800ab4` (2026-09-03)
stood in `provider-budget.ts` and `openrouter-client.ts` for 24 days;
a whole-package run (`oxlint-wrapper.mjs src`, 1666 files, about 30 to 50 s) showed them at once.
Prevention: before a batch is called done, lint the whole `src` tree and read its summary line.

### M11: a fix for one test defect written in the shape of another

Status: fixed in `d76d2424a` and `a9230202d`.
The T6 fix made two tests assert that the second call finishes first,
and ordered the calls by 20 ms against 5 ms sleeps, which is the T5 shape;
`consolidate-driver` then failed 1 of 8 at 0.2 CPU.
Twice more a comment stated how a check fails before any mutation showed it:
`e40ccf6d2` said a hanging voice ends at the exchange deadline (the fixture arms none, so the bound could never fail),
and the gate comment said the case fails on the run deadline (the file exits 13 on the unsettled wait).
Both are corrected, with commit comments on `e40ccf6d2` and `c10d62663`.
Prevention: an ordering claim in a test is enforced by a gate, never by a head start;
a comment that says how a check fails is written after the mutation that shows it.

### M12: a floor change committed with its own test file run, not the full suite

Status: fixed in `b1dc34af2`.
The F-9 fix (the neutral-pronoun floor reads the original) ran only `translate-neutral-pronoun.unit.test.ts`;
`translate-validate.unit.test.ts` pinned the old behaviour and failed until the F-5 work ran it.
The ledger edit that moved M9 also cut M8 in two, because the region was read short of M8's end;
M8's prevention sat under M11 until this entry's commit.
Prevention: a floor change runs the full suite before its commit, as M2 already asks of sheet wording;
a region is read to the next heading before text is inserted after it.

### M13: a pin search that quoted a whole clause

Status: caught by the full suite before commit (`112b399a5`).
Before rewording `KEPT_SUBJECT_RULE` the search for pins quoted the clause "says that I (or that person)";
`source-subject-policy.unit.test.ts` pins it split across two string lines, so the search found nothing
and the full suite failed on it.
Prevention: search for a pin of a sentence by a fragment of four words or fewer, and by each end of the sentence;
the full suite before commit (M2) stays the backstop.
