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

Status: open, owner ruling needed.
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

Status: open, by reading.
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

Status: open.
`buildAdjudicationMessages` takes no `identityContext`,
so a claim against a declared name can be supported and dispute the archive.

### S5: the apparatus list differs across six sheets

Status: open.
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

Status: open.
"Where the Chinese is SILENT rather than contradicting, dropping it is a fault of this kind,
and keeping it is correct" sits beside `NARRATIVE_DETAIL_IS_NOT_APPARATUS`;
the CuspariaKLSY11 gate ballot kept "took medication that night" on that wording.
The JUDGE tail's precedence line names criteria this sheet lacks.

### S7: `SIZE_NOTE_POLICY` calls silent surplus in any far-longer rendering page content

Status: open.
The note exists for a looping candidate,
and its sentence tells the judge the loop's surplus is page content.

### S8: the narrative bound and the cited-reference rule have no precedence

Status: open.
A characterization a cited reference states is ACCURATE on one rule and an addition on the other;
neither limits reader protection
(`cited-reference-rule.ts`, `TRANSLATE_ATTESTED_RULE`, `misreadingRule`).

### S9: reader-protection bullet contradicts itself on "took medication"

Status: resolved by the owner, 2026-09-27: "took medication" is not replicable and may stay (`9eba04abb`).
`house-policy.ts` keeps "took medication" vague as a method
and allows "at most that she had taken medication" for any medication tied to a death.
Proposed condition: the allowance holds only where medication was not the means.

### S10: the refiner keeps "any word left in the original language" and every date unchanged

Status: open.
Contradicts the house block on Han,
Ta,
titles,
handles,
shorthand
and month-first dates.
Only `edit-prompt.ts` says the house rules outrank the sheet;
seven other sheets carry the block with no precedence sentence.

### S11: the polish gate's preface was read as licensing the base's tense

Status: open.
"a present-tense line about their life is the base's choice" was quoted by a TianqiChen66616 ballot;
the comparative policy never prefers a polish whose only change is a house correction.

### S12: the polish gate lacks blocks the consolidate gate carries

Status: open.
Apparatus,
name scope,
community renderings,
dispute note (not forwarded by `consolidation-polish-apply.ts`),
bilingual clause.

### S13: the absolute naturalness review has no house rules yet its findings are required fixes

Status: open.
It tells the reviewer to preserve source-language kinship terms,
against the house rendering of 姐姐.

### S14: the editor sheet has no identity context or cited references

Status: open.
Its selection judges see community departures the editors were never told of.
The editor and refine selection criteria lag the slate criteria,
and "Fits the surrounding text in register and tense" makes the surrounding English the tense authority.

### S15: the bilingual and line-structure rules are missing on the contest and both gates

Status: open.

### S16: the picture scope rule never reached the consolidation writer or the slate

Status: open.

### S17: the consolidation slate is told a decline leaves the passage untranslated where it stops the entry

Status: open.
`candidate-select-wire.ts` via `translate-judge.ts`.

### S18: measurement sheets drift

Status: open.
The rendering audit counts a tense English supplies as `altered-time`;
the introduced-defect probe says dropping wording the ORIGINAL never had is a correct repair,
against the apparatus clause;
the measurement tail's reader-protection line names deaths only,
not attempts or a place that was the means.

### S19: house-policy wording defects

Status: open.

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

Status: open.
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
(families F1 to F19, a per-class list, probes `probe-siblings.mjs`, `fixture-corpus.mjs`, `guard-order.mjs`, `verify-hashes.mjs`).
All 95 recorded guard commits precede their fixes;
of 221 cited hashes only `0e0bd1a8c` (named in `811d908a9`'s message) does not resolve.

### H1: a rejection of every valid proposal still stops the entry

Status: open, owner ruling needed.
`translate-runoff-tie.ts` breaks only a challenge round's tie;
any other decline throws,
and `consolidate-settle.ts` turns it into `ConsolidationStandingIneligibleError` over an ineligible standing
(the hulicaijia14 shape).

### H2: the lane contest winner is validated without `lineStructured`

Status: open.
`lane-contest-eligibility.ts` passes `declared` only;
with the class one hundred two fixture the floor says invalid and `laneContestChoiceVerdict` says it may ship.

### H3: the 治愈 misquote

Status: owner told 2026-09-27; the comment,
why and `community-glossary-kigurumi.unit.test.ts` still carry 安慰 (task #372).
The comment also calls the reasons the owner's,
though the owner wrote only "I kinda disagree here".

### H4: the repair lane's own sheets never see the archive dispute

Status: open (class one hundred eight's open half).

### H5: the translate lane and the consolidation never re-seat under a hold

Status: open.
`corpus-run/pass-reseat.ts` and `corpus-run/pass-consolidate.ts` only wait.

### H6: the absolute naturalness review is shown wrapped prose and no house rules

Status: open (with S13).

### H7: the consolidation writer and the translate judge see picture transcripts with no scope rule

Status: open (with S16).

### H8: the introduced-defect probe has no declared names or glossary

Status: open (class one hundred fourteen's open half).

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

Status: open (latent).

### H12: minimax-m3 ignores OpenRouter endpoints one at a time and names none measured

Status: open.

### H13: the seeds test pins the whole term list

Status: open.
`community-glossary.unit.test.ts` went red three times on additions.

### H14: Freud's "id" becomes "ID"

Status: open (latent).

### H15: fixtures carry corpus text

Status: open.
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

Status: open.
`corpus-run/publish-fixed.ts` throws after all spending;
no page-assembly pass names a destination;
`corpus-run/destinations-line.ts` and `corpus-run/pass-entry.ts` claim the addresses are in the run log,
false on the refusal path.
XingZ6011 lost 96.3 min to it on 2026-09-26.

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

Status: open (class eighty-seven's open path).

### E5: floor refusals and panel votes the log cannot explain

Status: open.
`translate-produce.ts` returns floor refusals as findings with no log line;
a panel verdict carries no reason.

### E6: a malformed archive competes in repair selection as though it parsed

Status: open.
`repair-chunk-verdict.ts` passes `UNCHANGED_MEASUREMENTS` with `integrityOk` true.

### E7: the sheet-leak label list has fallen behind the sheets

Status: open.
`translate-sheet-leak.ts` lists seven labels;
`REJECTED CANDIDATE N`,
`WHAT THE JUDGES FOUND`
and `PRIOR FAILED CONSOLIDATION STRATEGY` are fenced but not listed.

### E8: more fixtures paraphrase corpus content

Status: open.
`archive-footnote-relabel.unit.test.ts`,
`pair-definition-order.unit.test.ts`,
`coverage-verdict.unit.test.ts` (names from the corpus).

### E9: tests pin roster sizes to literals

Status: open.
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

Status: open.
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

Status: open.
`inArchiveTypography` re-applies today's typography to old artifacts,
so 77 of 209 pages built before class one hundred eighty-one no longer reproduce by splice.
Fix: record the per-slice text shipped at publish and verify against it.

### F-3: no floor refuses a Han name or line left in English prose

Status: open.
shihai4h2 shipped "Wrong,\n小柿子." (the archive has "Wrong.");
the identity context shows the archive's untranslated Han alias as the English declaration.
Fix: a Han-residue floor outside comments,
code,
destinations and attributes, excusing a parenthesized gloss;
mark a Han-only TRANSLATION value as untranslated.

### F-4: the suicide floor refuses ordinary English and its census counted entries, not slices

Status: open.
Refuses "attempts on her own life",
"died by her own hand",
and a canonical English quotation whose Chinese added 自杀;
the message hardcodes "she".

### F-5: a source the strict grammar refuses turns off floors that need no grammar

Status: open.
`validateTranslatedSlice` returns `unknown` before the untranslated,
line-count and neutral-pronoun checks;
stages disagree on what `unknown` means.

### F-6: `carveSettled` does not carve as the pipeline did

Status: open.
It omits `includeFrontMatter`, `frontMatterAuthority` and `sealArchiveOriginal`,
shifting slice indices by one on archive-authority entries.

### F-7: the line-structure floor counts HTML comment lines

Status: open.
yulianNyanner s8 and s12 archives refused;
the message prints "1 lines".

### F-8: the sheet-leak floor misses six labels its own sheets print

Status: open (with E7).

### F-9: the neutral-pronoun floor never reads the original

Status: open.
"The TA graded the cat's homework." (助教) and "Ta!" are refused.

### F-10: `assertHeadingsStayDistinct` goes silent when heading counts differ

Status: open (latent).

### F-11: the glossary floors refuse a glossed Han title the title floor allows

Status: open (latent).

### F-12: low items

Status: open.
`ArchiveOriginalCompletenessError` stores neither entry nor span;
the declared-link floor refuses Zhihu @-mentions the archive rendered as the user's slug (owner ruling).
Plausible, unproven: nothing re-floors a lanes-agreed would-ship text,
and the repair lane never calls `validateTranslatedSlice`.

## Test suite

Probes: `~/temp/agent/audit-tests/`
(a runtime harness logging every `expect` that runs, `scan-corpus.mjs` and `classify-hits.mjs` for corpus text,
`run-container.mjs` for load runs, `magic-*.tsv`, `untested-dist-functions.tsv`, `coverage-holes.txt`).

### T1: an assertion that never runs

Status: open.
`document-preparation.unit.test.ts` "inherits the line-structure verdict from the enclosing CHUNK":
its loop runs zero times, because the verse fixture is too short to subdivide.

### T2: vacuous checks and catch-only asserts

Status: open.
32 `expect(<using binding>).not.toBe(undefined)` on disposables that are always objects
(`writer-grace-override`, `corpus-run/slice-overlap`, `grace-override`, `corpus-run/pass-entry`, `corpus-run/artifact-pool-names`);
`assembly-content-survival.unit.test.ts` has no boundary case for its six-letter floor or its two-use cap;
`prompt-uniqueness-client.unit.test.ts` asserts only inside `catch`.

### T3: tests pinning wrong or retired behaviour

Status: open.
`dropped-covers-the-page.unit.test.ts` pins the silent-original wording of S6;
`corpus-run/contributor-name-restore.unit.test.ts` pins handle restorations that drop the literal gloss the house rule requires,
under a name citing the owner's "with the literal translation in parentheses";
`consolidate-gate-wire.unit.test.ts`'s class fifty-six name still says a kept standing would stop the entry;
`consolidate-standing-verdict.unit.test.ts` names "still stops the entry" and never asserts it.

### T4: corpus text and real personal data in about 45 test files

Status: open.
A real birth date and hometown, a suicide-site sentence, method sentences, self-harm scars,
real names, handles and entry ids, and verbatim or near-verbatim corpus lines,
many under a header claiming "no corpus content appears here".
`package.json` `files` includes `src`, so the tests would ship with the package.
The owner said sanitization of the repository comes after the project;
the fixture rule (cat-themed invention) stands, so these are fixed as fixtures.

### T5: flaky timing

Status: open.
`lane-contest-stage.unit.test.ts` "RECORDS RAW HALF-QUORUM BALLOTS" fails 2 of 5 at 0.2 CPU
(positive control: the `podman run` in `~/temp/agent/audit-tests/run-container.mjs`);
its sibling case, the naturalness-review grace case,
settle-by-timer checks in `synthetic-client`, `hyper-client` and `provider-router`,
and the driver trio's `peak` checks are the same shape by reading;
wall-clock floors in `transient-retry`, `budget-hold-wait`, `stage-round` and the benchmark have no slack.
Real sleeps: `stage-quorum` waits 30 s ignoring the abort signal;
`synthetic-client` and `lane-contest-driver` run production backoff.

### T6: names claiming more than they check

Status: open.
`bedrock-catalog` "EVERY ROUTE" checks one route;
`synthetic-catalog` pins a literal price;
`block-pairing-protocol` compares a wrapper to its own builder;
the driver trio never asserts the second call answers first.

### T7: magic numbers

Status: open.
`roster-reach`, `request-pace`, `synthetic-catalog`, `deepseek-v41-admission`, `synthetic-client`, `repair-slice-key`,
`anthropic-request` (a cap that should be computed from the exported caps),
and vote weights not derived from exported constants in `candidate-select` and `candidate-select-decision`.

### T8: untested exported functions

Status: open.
76 public functions named by no test;
a coverage sample shows `isPaymentRefusal`, `statedWaitMsOf`, `routedJson`, `secondOpinionsFrom` and others never called,
and the decision reply's refusal branches never exercised.

### T9: every test run writes a log into `node_modules/.monochromatic/`

Status: open.
1,220,455 files there; the tests are not hermetic.

## Page assembly and the corpus-run driver

Probes: `~/temp/agent/audit-assembly/`
(`replay2.out`, `categorize.out`, `chain-probe.out`, `fixtures.out`, `seats-probe.mjs`, `tally-check.out`, `findings.txt`).
Replaying stored decisions through the current reader reproduces 93 recent pages byte for byte;
the other 41 differ only by typography code that changed after they ran.

### A1: an archive "Under Construction" placeholder ships, replacing a source heading on 8 pages

Status: open.
`corpus-run/archive-stub.ts` knows `to-do`, `todo`, `tbd`, `wip` in one bracket layer;
XingZ60's archive writes ``>>> `Under Construction` ``,
all 17 shipped XingZ60 pages carry it,
and 8 have no rendering of the source heading 七句破题.

### A2: a Han handle left in English prose (with F-3)

Status: open.
shihai4h1 and shihai4h2 shipped "Wrong,\n小柿子."

### A3: CRLF from a model wording ships inside an LF page

Status: open.
mikaela17 lines 223 to 225 end in `\r`;
`foldCarriageReturns` runs only at the corpus read.

### A4: archive link destinations rewritten to the source's Chinese-site ones

Status: open, owner call on the rule.
shihai4h2 links PTSD to zh.wikipedia where the archive links en.wikipedia;
aiyysk links source.android.google.cn where the archive links source.android.com.

### A5: seats with no wet provider are seated anyway

Status: open.
`corpus-run/run-seats.ts` `seated()` returns true on `NO_PROVIDER`;
TianqiChen66620 seated Qwen3.8-27B and glm-5.3 with no provider serving them,
logged 360 `NoProviderForModelError` lines,
and counted both in every quorum denominator.

### A6: the handle-gloss pass moves a link title's translation onto a handle

Status: open.
`handle-gloss-place.ts` accepts any same-line parenthesis, link text included,
reads only replaced slices,
and is not at a fixed point when run twice.

### A7: deterministic page refusals are labelled ERROR and re-attempted

Status: open.
`entry-error-outcome.ts` omits `CollapsedHeadingError`, `UnparseablePageError`, `PublishedPageDisagreesError`,
`UnansweredContestSliceError` and `SliceSpliceError` from the stopped set.

### A8: the README says an unfilled passage fails the entry; the code ships it as a gap

Status: open.

### A9: the DONE line undercounts on a resume into a directory holding a decline

Status: open (by reading).

### A10: TALLY `pageChanged` reads before typography

Status: open.

### A11: logging gaps

Status: open.
Client-layer loggers carry no entry
(3279 of 5914 lines of TianqiChen66616.log, SPEND lines among them);
the repair and translate lanes' lines carry no slice under overlap;
`slice-cache-namespace.ts` swallows a `SyntaxError`;
`attempt-store.ts` resets a malformed attempts file silently and writes it non-atomically;
ledger records carry no entry, slice, lane or generation.

### A12: `rebuildPreparation` silently fails to reproduce a folded entry

Status: open.
mikaela15 records 34 slices and rebuilds to 32 with nothing named.

### A13: the consolidation cache key omits the dispute note and the declared name pairs

Status: open.
Identity and reference context are in the run shape already.

### A14: stale comments and README claims

Status: open.
"No stage assembles a document",
"as the page will carry it" for withdrawn slices,
"every appearance is in view",
"four stores",
"as the stage left them",
and every pass rewrite logged as "trimmed".

### A15: withdrawn-slice siblings of K5

Status: open (structural, no corpus instance).
`restoredOnly` does not exclude `halves.withheld`;
cross-slice passes decide on a page the footnote guard may still change.

### A16: low items

Status: open.
A lane wording's triple newline ships;
the runs lock judges liveness by pid only;
the page is written before the artifact.

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

Status: open (with A5).
Every retry round 1 had one or two refused seats in round 0,
and rounds ran to the 360 s deadline instead of the grace.

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
decision-seat prompts reach 30,203 of a 32,000-token context and `ce824d933` adds the house rules to them with no size check;
the Bedrock stream bound spans the whole retry ladder;
card prices differ from the endpoint bought.
