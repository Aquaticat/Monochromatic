# Status, part 03

Part 03 of [Status](status.md),
whose index lists every part in order.

## Milestone and generation history, continued

Two fresh schema-9 `Weideriche_` validations after the GLM-5.3-Flash roster replacement each attempted the entry twice,
failed absolute naturalness on body slice 1,
and wrote no page or artifact.
The first exposed reviewers treating Markdown soft breaks as visible sentence breaks
even though target MDX renders them as spaces.
Absolute-review instructions now require flow findings to survive rendered soft-break normalization;
a replay over same rejected candidate text and reconstructed context then received nine usable approvals.
The second fresh run still rejected genuinely awkward body wording after both corrections.
It also exposed required-correction fidelity gate calling rejected base already approved and unanimously restoring it.
Required-correction gate now receives rejected status and canonical findings;
base remains fidelity evidence but cannot win merely because improvement is unclear.
Correction generation and selection now treat findings as minimum defects rather than edit whitelist.
Replays over exact candidate texts with reconstructed source and identity context moved gate from base to polished
and selection from partial to broader idiomatic correction.
Those replays are directional prompt evidence,
not publication evidence:
the best replayed correction still received one usable rejection among nine and therefore fails strict floor.
GLM-5.3-Flash returned usable structured answers and approved reviewed candidates in these diagnostics,
but this does not grant specialized role standing or production readiness.
Consolidation cache generation 10 prevents warm reuse of settlements bought under earlier review,
correction-generation,
selection,
or fidelity-gate questions.
The next eight-seat validation proved relative correction selection
still allowed every judge to choose best available text before exact absolute review rejected it.
Consolidation cache generation 11 makes required correction absolute eligibility explicit:
rewriters are instructed to perform separate finding-led and sentence-level native-English passes,
inherited wording gets no presumption from omission in finding list,
and selectors must assess each candidate independently
and decline every candidate when each remains materially unnatural.

Prompt strengthening alone was insufficient.
A newly generated correction fixed demonstrated phrase but introduced another idiomatic defect;
selector still chose it and exact review rejected it.
More importantly,
same exact failed candidate was rejected by original run and first replay,
then accepted by all eight seats in later replay.
One absolute-review draw is therefore not stable enough for publication approval.
Consolidation cache generation 11 now requires one sequential exact-half-quorum confirmation after first acceptance.
Any rejection heard before either bounded settlement remains immediately decisive and feeds bounded correction;
an acceptance ships only after second quorum acceptance of exact candidate.
Consolidation cache generation 12 applies exact-half required participation to every direct roster round;
no stage waits on every provider seat as requirement.
Participation quorum is distinct from existing two-vote corroboration thresholds for pairing and comparative gates.
Sequential naturalness approvals may contain different responding halves;
requiring identity overlap would restore provider-seat dependency the cap removes.
Schema-9 `confirmations` retains earlier acceptable draw with candidate and paragraph digests,
while decisive `rounds` preserves one-review-per-candidate correction-chain invariant.
Runtime settlement produces confirmation evidence by construction;
artifact reader independently checks final-candidate identity,
paragraph digests,
roster order,
and confirmation order.
Final-naturalness completeness guard checks settled runtime state
and does not duplicate artifact reader's digest validation.
Legacy schema-9 records without field remain readable.
Consolidation cache generation 13 landed in `1d16d89c4` and removes two-correction ceiling.
Consolidation cache generation 14 landed in `cf14b379b`
and threads every reviewed rejection into failed-strategy evidence
while durably storing first raw model payload by canonical prompt under run root.
Commit `6369228d5` detects exact repeated correction task before dispatch and pauses it as `INCOMPLETE`.
Interrupted invocation reconstructs exact correction state from payloads without provider resends,
then continues at first unseen prompt.
Payload cache carries corpus and model wording;
it stays inside disposable run root and is never committed or quoted.
Every rejection feeds latest exact text and findings into next correction.
No-change,
selection decline,
structural refusal,
and fidelity retention become prior failed-strategy evidence for materially different next prompt.
Schema-9 reader accepts any count of complete digest-bound transitions and still requires final acceptance.
First acceptance uses defect-discovery responsibility;
confirmation uses prior-acceptance challenge responsibility rather than repeated prompt.
No further validation may reuse generation-12 consolidation cache.

Status on 2026-09-04.
Three entries were run on OpenRouter alone and read line by line:
`luxuanwen3` (60 minutes,
4.65 USD),
`SS3B_0016` (56 minutes,
5.12 USD) and `Uekawakuyuurei` (53 minutes,
3.84 USD).
All three verify mechanically and all three pages are publishable.
That is the first time any page passed the reading gate the owner set on 2026-08-26,
and it does not make the pipeline production ready.

The reading found four defect classes,
all four in this package rather than in the corpus.
The publisher compared the assembled page to the source alone and refused a page its own slice rule had accepted.
The corpus's neutral pronoun,
written `TA`,
`Ta` or `ta`,
reached a page untranslated because the
counter read one spelling of three and the house rule never said what English makes of it.
A picture whose canvas noise clears the deterministic presence gate was reported textless by every model,
each report was screened as a refusal,
and three entries were unshippable on any roster for it.
The site's own name was settled by a gate arguing from the archive rather than from a rule.
Each is fixed with a guard shown to fail with its rule neutralised.

Read that rate as the finding.
Two entries read on one afternoon produced two new classes,
and the third produced none,
so the class-per-entry rate is falling but has not reached zero,
and no run has yet completed consolidation unstarved on the current build.
Production readiness needs the passes named in `doc/planning/translation-repair-readiness-signal.md`,
not another green suite.

Status on 2026-09-06.
Synthetic and Hyper are wet again and the passes run on the plain invocation:
the pass keeps four slices in flight and the writer rounds wait 180000 ms by default,
both moved this day from launch dials that every shipped page had needed
(`doc/decision/translation-repair-pass-overlap.md`,
`doc/decision/translation-repair-straggler-grace.md`).
The owner's rule of the day is always kill and relaunch,
written under "A source change while a pass is in flight means kill and relaunch".

The first pass on that invocation,
`yulianNyanner`,
found the fifth class in 28.6 minutes and shipped nothing:
the slice floor handed the strict MDX grammar the raw slice while the document reader masks HTML comments first,
so every slice whose original carried a translator note was an original that could not be read,
and the entry stopped at consolidation.
17 of 92 sources carry a comment,
14 of the 34 comment lines in that one entry;
no page that shipped had one.
Fixed with a guard shown to fail on the unfixed build (`translate-skeleton.ts`).
The class-per-entry rate has not reached zero:
the first entry read on a new shape of source found a new class.
Four pages of that entry then shipped and were read the same day,
and each found a class:
a positional translator note carried into every slice without its position,
one apostrophe convention on the page against another in the archive,
and a JSX string literal curled by the fix for the one before,
after which the publisher reads the whole would-ship page under the MDX grammar and refuses one it cannot
parse (`corpus-run/page-grammar.ts`).

## Superseded consolidation cache generation 14 operation history

This section records behavior of consolidation cache generation 14
(`CONSOLIDATE_CACHE_VERSION` 14 in the version notes of `src/consolidate-key.ts`,
introduced by `cf14b379b` on 2026-08-29),
not of artifact schema generation 14,
and is not standing guidance.
The finite producer constraints in `Standing redesign constraints`
replace its unbounded correction and suspension rules.

A quality rejection is repair work,
not final `do not publish` answer.
Pipeline must continue stage-local correction from latest exact rejected text and latest structured findings
until strict publication gates accept or operational interruption pauses work.
No finite correction ceiling is authorized.
It must not restart whole entry merely because quality work remains.
Cancellation,
dark provider,
quota exhaustion,
transport outage,
and insufficient live seats leave resumable incomplete work.
They must not become quality judgement,
terminal refusal,
unsuccessful quality tally,
or `do not publish` result.
Operational interruption may pause or retry repair,
but may not publish or weaken publication gate.

One model plus one substantive prompt may contribute at most one provider payload per invocation.
Identity is exact model identity plus canonical ordered messages,
including roles and exact content bytes.
Run client memoizes first in-flight or completed payload and reuses it for exact duplicates;
it never sends second provider call.
Pipeline must never resend that task to same model to manufacture independence,
non-bias,
confirmation,
or extra sample.
Changing temperature,
response schema,
round number,
nonce,
whitespace,
or request metadata does not create independent sample.
Providers may silently enable deterministic prompt caching;
duplicate response would then be same computation,
not independent evidence.
Follow-up work must give model substantively distinct task grounded in prior result,
latest rejection,
or different review responsibility.

Same-model same-prompt transport retry is permitted only after connection failure,
reset,
or timeout before completed provider payload exists.
Once any payload exists,
including malformed,
truncated,
schema-invalid,
or semantically rejected payload,
that model and prompt may not be resent as another evidence draw.
Operational recovery and discarded payload together still produce at most one recorded response.
Malformed completed payload keeps memoized failed claim and cannot be resent.
Claims are invocation-local;
a later invocation replacing interrupted work may repeat provider request,
but its result is never independent or non-bias evidence against earlier payload.
Concurrent duplicate waits on first caller's exchange and signal;
it does not start or cancel separate provider call.
Corpus pass persists raw payload memo beneath `prompt-payloads/` in run root.
Corrupted record refuses before provider call.

`TALLY status=INCOMPLETE` means stage-local or operational work remains.
It is neither success,
quality verdict,
nor publication evidence.
Scheduler retains caches but does not queue fresh whole-entry attempt in same invocation.
Ordinary hard-cap or transport error remains `status=ERROR` and may resume measured cache progress.

Pipeline must function normally when only one provider is wet.
No provider family,
provider-specific seat,
or cross-provider response is mandatory.
Exact-half participation may come entirely from one provider;
strict quality,
corroboration,
and publication gates remain unchanged.
One wet provider is valid normal operating mode with reduced provider diversity to report,
not reason to stop repair or lower quality.
Too few live seats for stage participation pauses or retries work as operational state;
it is not quality rejection.

Ordinary operation permits either provider alone.
Validation and performance arms requiring both must pass `--require-providers synthetic,hyper`.
Harness verifies both keys and live non-dry meters before any model call,
then logs `REQUIRED-PROVIDERS synthetic,hyper status=wet`.

The live artifact also exposed misleading diagnostic wording:
it reported nine pair relations as though nine of eight source blocks had been paired.
`countPairedBlocks` now reports unique source and target reach separately from relation count,
with one-to-many and many-to-one guards.

Two fresh validations launched from `68c37da59` at 2026-08-29 12:14 UTC.
`Weideriche_` used `~/temp/agent/validation-Weideriche-schema9-half-quorum-v12-20260829`.
Its first attempt refused slice 1 absolute naturalness at 4,840,305 milliseconds,
wrote no artifact or page,
and incorrectly queued whole-entry cache-warm reattempt.
Process was stopped after that behavior was rejected.

Pull request 386 `Carena0442` used exact pull-request files in isolated fixture at
`~/temp/agent/validation-pr386-Carena0442-schema9-half-quorum-v12-20260829`.
Process was stopped after same-model same-prompt repetition was rejected as independence mechanism.
It wrote no artifact or page.
Neither stopped run is publication or readiness evidence.
Artifact and log paths,
fixture method,
and failed startup non-evidence are recorded in
`~/temp/agent/pr386-Carena0442-run-provenance-20260829.md` and `doc/handover/translation-repair.md`.

The stopped runs are not completion-time samples.
Before another `Carena0442` launch,
completion-path work must target fresh-run median below two hours without weakening quality.
`doc/planning/translation-repair-entry-time-to-complete.md` defines phase attribution,
comparison controls,
completion evidence,
and objective.
Concurrent runs share provider capacity and are not matched runtime arms.

## Terminal quality-refusal audit, 2026-08-29 (superseded)

This is the audit as recorded on 2026-08-29 and is not standing guidance.
Its continuous-correction design was superseded:
`1ba8f713a` (2026-09-01) made consolidation a single attempt
and turned the final-selection gate into the reporter `finalSelectionFindings`,
and the finite producer constraints in `Standing redesign constraints` in the package README
replace its unbounded correction.
Present tense in this section describes the pipeline of that day.

Naturalness rejection no longer ends with `do not publish`:
consolidation cache generation 14 continuously corrects,
checkpoints payloads,
and pauses only on operational interruption or exact deterministic task cycle.
Publication gates remain strict.

Audited terminal and bypass findings are integrated as follows:

- Archive-only block repair landed in `ccaad1f53`,
  with contributor-floor test in `78ab244a2`.
  Preparation now scopes each unclaimed target block to expected aligned source section,
  requires exact anchored source support or deterministically shaped editorial apparatus,
  and lets any revise voice block retention.
  Retained wording receives defect-discovery naturalness review plus distinct acceptance challenge.
  Corrections preserve target-authoritative contributors,
  undergo independent whole-roster selection,
  splice in reverse offset order,
  and re-enter preparation before lanes.
  Exact correction and archive-state cycles pause as `INCOMPLETE`.
  A sibling revision intentionally causes remaining unclaimed blocks to be reviewed again;
  this costs calls but avoids carrying a license across changed parser locations and source context.
  The old `assertArchiveReviewed` terminal and `UnreviewedArchiveError` are removed.
- Unfilled-passage continuation landed in `ed756993b`,
  with cycle guard test in `1649c480d`.
  Translate version 11 produces from latest exact rejected slate and findings without finite correction count.
  Insertion placement rechecks latest semantic,
  destination,
  and shortfall evidence until admitted,
  proven carried elsewhere,
  operationally interrupted,
  or exact task cycle repeats.
  Carried passages map to `not-applicable` at insertion anchor;
  final would-ship page must retain every exact anchored region that proved full coverage.
  This exact-region rule can conservatively pause semantically equivalent rewrites as `INCOMPLETE`.
  `assertPublishableTranslation` is now defensive invariant and cannot trigger fresh whole-entry retry.
- Source-destination recovery landed in `0dc6e510c`.
  Translate version 12 excludes archive fallback that misses source atoms and continues as absent-mode translation.
  Ordinary repair-lane or archive standing is validated before consolidation eligibility,
  so a contest-endorsed linkless candidate enters version-16 recovery instead of becoming final.
  Final destination comparison runs before any page write and pauses as names-only `INCOMPLETE` invariant.
- Continuous final-selection recovery landed in `a84bb3a7a`,
  with role-alias guard in `f858ab538`.
  Consolidation version 16 treats every unendorsed or publication-ineligible standing baseline as unfinished.
  It threads prior selection slate,
  anonymized producer and judge roles,
  selection ballots,
  gate ballots,
  terminal,
  and findings into substantively distinct producer recovery.
  Recovery continues until a fresh consolidation wins selection and fidelity gate,
  provider operation stops,
  caller aborts,
  or exact evidence cycle repeats.
  Identical unsafe twins share one recovery chain;
  only final safe settlement persists.
  `assertFinalSelectionSettled` was then a defensive invariant,
  classified as `INCOMPLETE` rather than whole-entry quality retry;
  `1ba8f713a` (2026-09-01) removed it,
  and `finalSelectionFindings` reports the same condition beside the tally
  (`src/corpus-run/final-selection-completeness.ts`).
- One-sided front-matter support landed in `56a47cb81` and creates insertion slice for source-only metadata,
  deterministically admits it,
  and validates candidate against source YAML shape when archive has none.
  Target-only metadata remains exact archive content outside localized slices.
  Missing/misplaced slice and contradictory assembled-page structure pause as `INCOMPLETE` invariants;
  incumbent fallback and candidate YAML/schema invalidity remain handled before publication.
- `assertContributorNamesComplete` throws when final attribution drops target-authoritative public form.
  Consolidation cache generation 15 landed in `5211c54dd` and floors translation candidates,
  excludes unrepairable violator voices without fabricated authorship,
  rejects unsafe ordinary lane winners,
  and floors consolidation and polish candidates.
  Repair/refine text that differs reaches lane winner floor;
  uncontested identical text matches translate lane already floored.
  Invalid slate deterministically retains target-authoritative incumbent.
  Body-slice floor does not replace front-matter comment authority,
  which remains in metadata validator.
  Final completeness guard remains defensive.
  Cache generations move to translate 12,
  refine 4,
  lane contest 5,
  and consolidation 16.

- Visual-evidence guard landed in `d14e641e6` and gives each image retry substantively distinct responsibility:
  complete transcription,
  small text,
  layout,
  then identifier verification.
  Corroborated and reviewed no-text outcomes proceed.
  Missing or unavailable image-dependent evidence pauses as `INCOMPLETE` before lanes,
  so visual content cannot bypass publication review.

On a fresh corpus path under consolidation cache generation 14,
`assertFinalNaturalnessComplete` is runtime persistence invariant after continuous naturalness,
not ordinary quality outcome.
Existing artifact readers do not invoke it.
Parser,
ledger,
assembly,
filesystem,
provider,
and cancellation failures are operational errors rather than quality verdicts.
The code-level terminal-quality register is closed.
Continuous-repair verification is recorded in `doc/audit/translation-repair-continuous-repair-invariant.md`.
Fresh validation remains gated by Carena completion-path analysis.
Exact deterministic cycles deliberately pause as `INCOMPLETE` until strategy or evidence changes;
they never authorize fallback publication.

Corpus-readiness work is defect-driven:
once output proves reproducible systemic blocker,
stop unrelated corpus arms,
fix and verify blocker,
then rerun affected entry before resuming measurement.
More samples do not compensate for known mechanism.

Remaining corpus arms,
hard-case output reading,
live calibration checks,
site-grammar gaps,
package reading CLI,
Hyper catalog drift check,
and declined-archive seam remain open.
Read milestone figures as history:
they were measured under earlier pipeline shapes and none is readiness claim.
The evidence and traces of that period are in `doc/audit/translation-repair-output-reading-20260826.md`
and `doc/planning/translation-repair-corpus-overlap-measurement.md`.
