# Translation repair handover snapshot: 2026-09-06, part 04

Part 04 of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
whose index lists every part in order.

## Where the work stands, continued

### Verified baseline before acquisition implementation, continued

`proc_103d` completed in 212 seconds with 34 requests.
All editors retain the name;
one adds a duplicate list marker.
The whole-chunk selector chooses the clean administrator correction at weight five.
In the name-only discriminator,
baseline chooses the rename at weight 4.5,
while revision evidence selects preservation at weight five and weight six in reversed order.
These are selected repairs,
not fallback retention.
Some historical rationales misstate the old spelling;
only the actual diff and selected text support the conclusion.

`proc_5c7c` completed in 372 seconds on frozen `.frozen-dist-b9d3b2ea0`.
All three editors retain the name,
correct the administrator role and correct the disclosure direction.
The selected GLM-flash chunk wins six votes without fallback.
Provider-free replay matches all 58 calls with zero misses;
strict slice validation and paragraph/list structure pass.
This remains an evidence-injection prototype,
not an implemented production feature.

Task 21 waits on tasks 26 to 28.
Task 26 has selected the implementation in
[scoped archive evidence design](../planning/translation-repair-archive-evidence-design-2026-09-10.md).
A generic Git prototype finds the naming revision without selecting its commit,
but also returns punctuation and partial-word edits.
Generic history descriptions have failed either name preservation or a genuine mentioned-form control.

A typed current-archive-use alternative is now being tested to avoid that dependency.
`proc_a1a0` produced matching baseline/augmented block pairings
and correctly corroborated occurrence kinds across the real name and control spans.
The initial invalid `fanOut: 'all'` argument followed the window branch;
a corrected provider-free replay with `fanOut: 'window'`
verifies the same fourteen calls and classifications.
It was not an exhaustive eleven-voice run.
The old five-claim comparison did not match the successful history benchmark.
A corrected isolated-claim comparison reproduces the exact history result from cache
and finds generic typed-use evidence also rejects the false name claim four-to-two.
The kind-specific prose alternative fails and is excluded.

`proc_9854` completed the typed follow-up:
safety controls pass,
the compound and pure rename claims are rejected,
and the name-only selector preserves the name in both orders.
Fresh criticism retains administrator correction but has no participant-correction claim;
this is an unresolved combined-path concern,
not a proven causal effect of typed evidence.

`proc_0e80` completed in 542 seconds with seventy requests.
It preserves the name and repairs administrator wording,
but leaves the original wrong disclosure sentence untouched because no corresponding correction claim reaches editing.
That fails the combined goal;
different cohorts and post-window evidence injection prevent attributing the failure to typed text alone.

The selected design is
[qualified archive naming revisions](../decision/translation-repair-qualified-archive-naming-revisions.md):
corroborated initial person/group/place reference use plus exact pinned same-path revision evidence,
with the changed span equal to the complete reference occurrence.
This generically reconstructs the successful naming-specific evidence
without labeling arbitrary history edits as names or creating a cross-entry glossary.

Implementation proceeds through task 27's qualifier/Git reader,
task 29's initial-use corroboration in existing pairing calls,
and task 28's structured pre-window prompt/cache/artifact integration.
The final compiled path must use actual acquisition,
not interception,
and must correct actor,
role and name together.
Task 27 has an in-progress public `readQualifiedArchiveNamingRevisions` implementation.
Its initial naming tests and new physical-object/EOF/graft controls pass after build and types
at `c34ab893e`;
see `~/temp/agent/archive-provenance-green-20260910.out`.
Shared `corpus-source.ts` reads now use the same intrinsic Git context as history.
The behavioral red is `archive-provenance-red-r2-20260910.out`;
the earlier missing-export failure was not guard proof.

Task 27 remains incomplete:
lint,
coordinate mapping through normalization,
remaining history/parser/environment fixtures,
guard mutations,
real Mio acquisition and the complete package suite are outstanding.
Task 29 has not acquired use observations from production pairing calls.
No renderer or repair/cache/artifact handoff is wired.
The decision defines “local English naming choice” operationally,
without editor intent or officiality.
No model or full-entry process is active.
No production history feature or one-off name mapping is added.
The provider-free trace also confirms the pure administrator issue's broad quote includes the group name;
adjudication alone is not proof that an editor will preserve it.
No production name-policy change or one-off glossary entry has been made for task 21.
See [reference-name authority](../planning/translation-repair-name-authority-2026-09-10.md).
No full-entry run is active.
Task 20 is deferred and non-blocking.

The historical measurement record in this section predates this implementation;
its previously active runs are complete.
The canonical detailed record is
[temporal and participant source context](../planning/translation-repair-temporal-context-2026-09-10.md).
The implementation now routes actual revisions past the retention-only anchor gate,
without lowering review or selector quorum;
compares them with the unchanged block;
and carries archive context plus anonymous review action/category-to-candidate evidence.
Unanchored retention claims remain excluded from selector evidence and visible in audit findings.

Cache-only replay proved that Mio12 had already produced a complete typo correction that never reached selection.
Typed evidence made all six probe judges retain the useful label,
and all six removed a directly contradicted factual claim despite a misleading retention majority.
The orphan-label control was imperfect and is not claimed as a success.

The first `6c24c82c1` live integration still left spelling errors:
it generated only a flawed literalized revision and selection tied.
A measured change to the existing first-review brief now requires complete minimal English corrections,
distinguishes already-adequate English from mere factual support,
and treats parallel image readings as witnesses rather than additional messages.
Red guard `ede699627` and implementation `ba01babda` follow that measurement.

Compiled-stage integration `proc_4eec` completed in 783 seconds without the prototype's message interceptor.
It retained the label through the normal branch,
then selected a complete corrected chat at weight 3.5 over seven ballots.
`musculine` and `Wechat` are corrected and no untranslated filler is introduced.
The source-supported trait becomes "sensitive yet determined".
Both outputs compile.
Report:
`~/temp/agent/archive-brief-integrated-20260910/report.json`.
Log:
`~/temp/agent/archive-brief-integrated-20260910.log`.
Bedrock cost was 0.00046112 USD;
two OpenRouter calls reported zero,
with three unpriced Hyper and seven unpriced Synthetic calls.
The daily helper ran afterward.
Dialogue-interpretation disagreements remain recorded in the wording plan,
not converted into blanket deletion rules.

Task 18 is complete.
Task 20 is deferred and unresolved,
with no production change and no further prompt trial scheduled.
The agent's designation of it as a Mio readiness blocker is retracted after tracing its output effect.
Context and presentation trials improved some replies but left false audit findings:
zero accepts among fourteen baseline replies,
two among twelve with context,
eight among fourteen with context and scope,
and six among twelve with in-place presentation.
These combine distinct responsibilities and are not runtime quorum or readiness measurements.

The public-wrapper check in `~/temp/agent/archive-audit-effect-20260910.out`
proves audit acceptance/rejection produce identical `repairArchiveBlocks` outputs,
with the detailed finding discarded.
A selected-removal positive control changes output.
The production caller passes no prior audit findings to later blocks;
`pass-prepare.ts` receives only operation-level retained/revised findings.
Awaited audit calls still cost resources and can delay or abort through operational failures,
but this context defect has no demonstrated page-text effect.
See [archive audit context measurement](../planning/translation-repair-archive-audit-context-2026-09-10.md)
for complete experiments,
costs,
caller trace and independent review.

Temporal-context task 19 is in progress and takes priority before the fresh Mio pass.
Its fixed-slate probe passed the direct-source positive control with all six judges.
Adding the source paragraph past the intervening heading moved correct choices from one of six to four of six;
paired source/archive context also produced four correct choices,
with only abstentions remaining.
The writer probe did not fix the bullet:
Qwen and Kimi still reproduce it under wider context,
and Mercury's wider response fails schema validation.
No initial-writer context change was integrated.

`e086402a6` implements forward-only heading context,
verified through `134a2e20c`.
An immediate heading-only source neighbor brings exactly one following body slice into view;
another heading,
metadata or empty body stops extension.
Media counts as body,
unknown nonempty content counts as body,
and there is no backward or arbitrary distant scan.
Both languages use identical selected positions.
The compiled Mio12 window byte-matches the measured treatment.

`proc_c166` completed `translation-repair-temporal-repair-path-probe-20260910`
in 748 seconds on frozen `.frozen-dist-134a2e20c`.
Report:
`~/temp/agent/temporal-repair-path-probe-20260910/report.json`.
Log:
`~/temp/agent/temporal-repair-path-probe-20260910.log`.
The actual `repairChunk` returned a compiling but unsuccessful result:
it removed the list and changed the established group name to source script plus `Harunome Studio`.
No precise temporal/participant claim survived;
broad list-addition claims were accepted by four of six responding panelists,
and all three editors removed the list.
Several literal group-name/gloss claims drew five supporting votes.
Task 21 separately tracks the name-authority failure and also blocks the next Mio pass.

The provider-free replay reproduces all forty-six calls with zero misses and identical text:
`~/temp/agent/temporal-repair-path-replay-20260910.json`.
No whole-page run is authorized by this result.
The next measurement must distinguish current coverage/edit scope from nearby source's role as factual evidence,
using the exact captured critics and panel packets.
Keep the name-authority change separate;
do not assume packet size or the window caused it without a matched comparison.
During that measurement phase production prompts remained unchanged beyond the verified heading window.

`proc_12b5` completed the evidence-scope experiment in 476 seconds.
The fixed old blanket claims lose authorization at three-to-three votes.
New critics now produce target-anchored participant corrections,
including the 2022 reconnection,
but the derived panel accepts both those corrections and new blanket removal claims.
It also condemns the second friendship bullet,
whose source support lies beyond the window.
No production prompt change was integrated.

`proc_9549` completed in 576 seconds.
Neither full source evidence nor claim extent reliably removed blanket-deletion authority;
the combined arm still accepted it.
No treatment was integrated.

`proc_b599` completed in 388 seconds.
All six assembled editor candidates remove the list and change the group name,
in both the stock and treatment arms.
They compile but fail the existing archive block-shape check.
No editor-responsibility treatment was integrated.

`proc_ec6f` completed the accurate-claim editor control:
all three editors correct disclosure direction and keep the list,
second friendship item,
administrator item and established group name.
Both GLMs explicitly date it by reconnection;
DeepSeek's other prose repeats the administrator detail.
All pass the existing structure check,
but they also edit other allowed regions and are not automatically publication-ready.
No production gold-label filter was added.

`proc_02d2` then isolated a true and false claim for the eight panelists actually asked in the full-packet arm.
The true participant correction is accepted at seven supports and one malformed-vote abstention.
The false friendship-addition claim is rejected at six opposing and two supporting votes.
Within the original six responding panelists,
DeepSeek Pro and Mercury switch to opposition,
reversing the matched tally from four-to-two support to four-to-two opposition.
This is evidence for packet-content/size interference,
not a universal claim about batching or renumbering.

`proc_2d45` completed cluster-level review in 430 seconds.
In the mixed list cluster,
blanket deletion loses authorization at four-to-four,
the two-item removal claim is rejected three-to-five,
and the second friendship claims are rejected two-to-six.
The actual participant correction remains accepted seven-to-one.
Name-change and administrator-placement claims still pass.
No production batching change was made.

`proc_ba3f` completed stock-window cluster-to-editor verification in 155 seconds,
with thirty panel and three editor calls.
GLM-5.3 now produces the correct disclosure direction and keeps the second friendship item,
but moves the administrator fact to prose and changes the group name.
The other drafts delete the first item or duplicate the second.
All structurally validate,
which is not semantic success.

`proc_ae78` completed `translation-repair-selection-context-probe-20260910`.
Report:
`~/temp/agent/repair-selection-context-probe-20260910/report.json`.
Log:
`~/temp/agent/repair-selection-context-probe-20260910.log`.
It holds the actual generated candidates,
authorship,
system criteria and fallbacks fixed,
comparing stock selection with added source evidence.
The affected envelope and complete chunk are tested independently,
with no invented composite or extra generation.
Sixty-four calls maximum and a twenty-minute global bound.
At that measurement point no batching change was integrated.
The implemented packet and selector changes are recorded in the current status.

The caller trace also found that per-envelope and whole-chunk repair selectors do not receive neighboring source.
Any good editor candidate will need verification at those actual selection boundaries;
the existing window has not yet been threaded to them.
See [temporal and participant source context](../planning/translation-repair-temporal-context-2026-09-10.md).
Do not reinstate task 20 as its blocker because the audit experiment remains unresolved.
No full-entry pass is active.
The complete archive and naming trace is
[Mio12 wording follow-up](../planning/translation-repair-mio12-wording-2026-09-10.md).

Historical state after the naming-policy integration:
`85f7bac01` is the verified code tip.
`514db9b1f` scopes declared-name rules so they do not erase a word or spelling being discussed.
`8a59469f2` keeps established names outside the generic-term first-use gloss requirement.
Build,
types,
oxlint and the full suite pass;
`~/temp/agent/naming-final-unit-20260910.out` ends `unit exit 0`.

The real bounded `runTranslateStage` probe completed on frozen `85f7bac01`:
Qwen wrote a fresh elliptical opening retaining both `澪` and `Mio`,
and all four responding judges selected it.
There was no structural send-back or outage fallback.
The group-name probe moved the false gloss claim from five supporting votes to a three-to-three split;
`tallyVotes` therefore changes `accepted` to `needs-human`,
so the claim no longer authorizes an edit.
The explicit-definition positive control remains enforced.
No glossary entry,
output-rejection gate or correction loop was added.

Reports and complete evidence are in
[Mio12 wording follow-up](../planning/translation-repair-mio12-wording-2026-09-10.md).
The remaining tasks are neutral archive-review/apparatus treatment and temporal source context.
No probe or full-entry pass is active.
The queue remains at Mio until those material follow-ups and a fresh page reading.

Historical state after the class-thirty repair:
`b5da9866b` was the verified code tip.
Generation fourteen persists each naturalness round's effective `quorumOver`,
uses it when recomputing the stored verdict,
and binds confirmation to the same basis.
The runtime quorum is not lowered.
The original four-of-six,
nine-seat-basis failure round-trips locally;
real Mio10 and Mio12 generation-thirteen artifacts remain readable.
Build,
types,
oxlint and the complete suite pass,
with `unit exit 0` in `~/temp/agent/class30-final-unit-20260910.out`.
Current `verify-published` still accepts Mio12.
The full diagnosis and guard history are in the OpenRouter planning log.

No full-entry pass is running.
The first name-form measurement completed as `proc_b0ce`
on frozen `b5da9866b` in 139 seconds.
Its report is `~/temp/agent/name-form-probe-20260910/report.json`.
Qwen's treatment now preserves both `澪` and `Mio`;
Mercury does so in both arms.
Both outputs compile.
Judging only partly improves:
three of six treatment judgments prefer the distinguishing wording,
versus two baseline judgments.
The remaining judges still prefer the normalized name,
sometimes using the new filler warning to justify that choice.
No judge chooses the untranslated-copy negative control.
Eight baseline requests reused disk payloads;
eight new calls logged 0.00059064 USD on Bedrock,
zero reported cost on OpenRouter and four unpriced Hyper calls.
The daily helper ran.
No probe is active.
Next test the form exception inside the actual faithfulness and name criteria,
not as another appended rule bundled with filler advice.
The group-name editor path and source-context change remain separate unmeasured work.

The wording trace is recorded in
[Mio12 wording follow-up](../planning/translation-repair-mio12-wording-2026-09-10.md).
Next work separates shared name authority and quoted-form preservation,
neutral archive-review framing and minimal copy-edit classification,
and a source-context boundary that reaches the dated reconnection paragraph.
For slice four,
`neighbouringSource` returns the childhood SRS paragraph and a heading,
but not slice six's April 2022 event.
Measure those proposed treatments before another full-entry launch.
Optional university phrasing and abbreviation preferences are not independent reasons for another paid full pass.
The corpus remains untouched.
Mio12 already provides published-page evidence for the verse remedy.
The queue remains at Mio for the material wording follow-up.

Historical terminal reading after 07:02 UTC on 2026-09-10:
Mio12 settled after an initial artifact-validation error and automatic reattempt.
Its complete page has been read beside source and archive,
with all seven reading steps and three checks recorded in the OpenRouter planning log.
`verify-published` passes for 17 wordings,
8726 characters,
zero silent or missing deliveries.
The published poem has five visible breaks and no trailing attribution break;
all screenshot transcripts and source destinations survive.
The once-only picture purchase check holds across the reattempt:
42 model readings,
no second purchase.

Class thirty is the blocker before another paid launch:
the first attempt's naturalness round recorded four acceptable voices from six asked seats as `quorum-not-met`,
but artifact validation recomputed `acceptable`.
The exact failure names `consolidation.slices[3].polish.review.rounds[0].verdict`.
Reproduce the real stage-to-artifact boundary and preserve the intended wider-bench quorum.
Do not fix this by lowering the runtime threshold.
No pass is running.

The full page still has wording concerns recorded separately:
loss of the `澪` versus `Mio` distinction in the opening,
the ambiguous primary-school coming-out bullet,
the university expression,
source `SRS` expansion,
the first chat's missing `Translation:` label,
and retained archive usage issues.
The queue remains at Mio pending that follow-up and class thirty.

Evidence:
`~/temp/agent/Mio12-survey-20260910.out`,
`~/temp/agent/Mio12-picture-reading-20260910.out`
and `~/temp/agent/Mio12-spend-20260910.out`.
Total logged OpenRouter spend is 0.970260010925 USD,
Bedrock 0.2758867675 USD;
Synthetic and Hyper calls have no per-call price.
Final observed meters:
OpenRouter 267.74 USD,
Bedrock 185.50 USD,
Synthetic weekly zero,
Hyper 246.

Historical launch at 03:45 UTC on 2026-09-10:
`Mio12` runs on frozen `ff6d288bc`,
carrying the measured source-break presentation and shared writer/judge contract.
Pass pid `1713424`,
runs `~/temp/agent/Mio12-20260910`,
log `~/temp/agent/Mio12-20260910.log`,
terminal-only supervisor `proc_6a7b` (`translation-repair-Mio12-20260910`).
Prelaunch and launch meters:
OpenRouter 268.73 USD,
Bedrock 185.78 USD,
Synthetic weekly 1.9636833484848484 percent with five-hour 2750/2750,
Hyper zero.
The launch confirms overlap 4,
built-in writer grace and no withheld seat.
The daily helper output is `~/temp/agent/Mio12-costs-before-20260910.out`.
No source changes are planned while it runs;
a necessary one requires killing pid `1713424` and relaunching.

Read the actual tally and full page at the terminal notification,
not the supervisor's exit status.
Verify `writer-source-break-display` activation,
the poem's rendered line grouping,
no unintended trailing `<br/>` after attribution,
both chat translations,
the Twitter transcript,
links,
front matter and the previously recorded wording concerns.
Complete all seven reading steps and three checks before advancing to `hulicaijia`.
The bounded probes are complete;
no further prelaunch measurement is pending.

Verified prelaunch state on 2026-09-10:
the upstream verse remedy is implemented and verified through `ff6d288bc`.
The first live probe found that instructions alone still left Mercury's initial output flat,
although new judging selected the preserving candidate with three of four judges.
A supporting source-spelling treatment changed only the five parser-confirmed breaks to `<br/>` in the existing
model-facing source block.
Both writers then returned five breaks,
without a trailing break,
and both outputs compiled.
The canonical source-file hash was unchanged.

`b3113164a` integrates that source-only display,
requiring explicit absent-incumbent provenance while retaining raw source for validation and judges.
Unknown presence,
nonempty archive text and front matter keep the original presentation.
Code,
comments,
JSX attributes and line-ending conventions are preserved by the shared parser.
`79e82a368` proves the composed stage forwards the fact on its first writer calls;
`89cac70f3` and `ff6d288bc` finish formatting and separate the authority checks.
The full suite ends `unit exit 0` in `~/temp/agent/source-display-verified-unit-20260910.out`;
build,
types and oxlint pass with zero warnings.
The production source view matches the measured treatment,
with only the recorded reference-wording cleanup in the system message.
No more prelaunch experiment is needed.
Relaunch Mio on a fresh frozen build next.
Read the complete page,
including the poem's actual break placement and any trailing `<br/>` after attribution,
before advancing the queue.

The completed probes and their costs are in the
[verse-remedy review](../planning/translation-repair-verse-remedy-review-2026-09-10.md).
The contract probe logged 0.010003172 USD on OpenRouter and 0.00114931 USD on Bedrock;
the source-spelling treatment logged 0.00049012 USD on OpenRouter.
No full-entry pass is running yet.

Historical contract implementation on 2026-09-10:
the owner delegated the best changes after the guard-first correction.
The shared upstream rendered-line contract is implemented at `1a6ebbf62`,
with integration coverage and formatting through `d2e102b12`.
Writers get parsed source-break facts before generation;
judges get counts keyed to their actual anonymous slate;
author repair,
lane comparison and consolidation carry the same contract.
Raw source and archive-backed layouts are untouched.
Ordinary-passage prompt identity was checked against frozen `dc51b02d9`.

The original evidence gap is closed:
rebuilding Mio10 with its recorded pairing produces the same 18 slices,
and its source-only poem really had effective `lineStructured: false`.
The recorded GLM-flash candidate at index 3 preserved five breaks;
Mercury's winning index 2 had zero.
Its voters preferred wording without addressing rendered structure.

Build,
types and oxlint pass with zero warnings.
Full-suite log `~/temp/agent/rendered-contract-verified-unit-20260910.out` ends `unit exit 0`.
No full-entry pass is running.
The bounded matched probe is active as `proc_f94d` (`translation-repair-rendered-verse-probe-r1`),
on frozen `d2e102b12`,
log `~/temp/agent/rendered-verse-probe-20260910-r1.log`,
report `~/temp/agent/rendered-verse-probe-20260910-r1/report.json`.
It compares old/new writer sheets and old/new judging on a fixed slate,
then new consolidation writing;
both arms use the same source-only window without pictures or neighboring text.
The whole probe has a 720000 ms deadline.
Read its actual outputs and costs before relaunching Mio.
No source changes are planned while it runs.
The first scratch attempt failed before generation on a missing meter-call argument;
only that script was corrected before the fresh probe directory was used.

Historical owner correction at 02:18 UTC on 2026-09-10:
red/green guards and a publication test do not establish the best fix for the verse defect.
The guard-first remedy claim is withdrawn.
`Mio11` was stopped by SIGTERM to verified pid `1653981`;
its supervisor has exited.
No corpus pass is running and no further source change followed the correction.
`7c0ce152f` remains committed but provisional,
not an accepted shipping remedy.
The next action is to resolve how generation and judging should receive rendered source structure,
not to launch another pass on the guard alone.
Evidence,
uncertainties and the proposed `TC2` instruction amendment are in
[`translation-repair-verse-remedy-review-2026-09-10.md`](../planning/translation-repair-verse-remedy-review-2026-09-10.md).
In particular,
the isolated poem fails the verse heuristic,
but its effective inherited production flag has not been recovered.
The artifact does show flat text before the final wrapper,
which reports `rewrapped: false`.
Logged stopped-pass costs:
OpenRouter 0.003006791 USD,
Bedrock 0.00038817 USD;
in-flight usage may not have been reported after cancellation.
The queue remains blocked at `Mio`.

Historical launch at 02:16 UTC on 2026-09-10:
`Mio11` runs on frozen `e0a0ae45c`,
with the source-only explicit-break guard.
Pass pid `1653981`,
runs `~/temp/agent/Mio11-20260910`,
log `~/temp/agent/Mio11-20260910.log`,
terminal-only supervisor `proc_1081` (`translation-repair-Mio11-20260910`).
Prelaunch and launch meters:
OpenRouter 268.74 USD,
Bedrock 185.78 USD,
Synthetic weekly 2 percent with five-hour 2750/2750,
Hyper zero.
The launch confirms overlap 4,
built-in writer grace and no withheld seat while Synthetic is wet.
The daily-cost helper output is `~/temp/agent/Mio11-costs-before-20260910.out`.
No source changes are planned while it runs;
a necessary one requires killing pid `1653981` and relaunching.
Read the complete page and all seven steps/three checks at its terminal notification,
including explicit breaks in the closing poem,
all screenshot translations and the recorded wording concerns.
Do not advance the queue on `SETTLED` alone.

Class twenty-nine is fixed locally in `7c0ce152f`,
with coverage and formatting through `e0a0ae45c`.
Guard `d813da8d5` failed four cases on the prior build.
The original reproducer now rejects the flattened quote,
and the real Mio10 poem is rejected for five owed breaks versus zero;
the same words with explicit breaks pass.
A publisher integration test reads the inserted verse from a disposable output tree and preserves its breaks.
The full suite ends `unit exit 0` in `~/temp/agent/class29-final-unit-20260910.out`;
build,
types and oxlint pass,
including zero warnings.
Relaunch `Mio` next on a fresh frozen build.

Terminal and reading update on 2026-09-10:
`Mio10` SETTLED at 01:36 UTC after 4,872,081 ms.
`verify-published` matched all 18 wordings with no missing text;
all four source destinations and all six `PhotoScroll` components survive.
Both chat translations and the Twitter transcript are exact archive substrings.
The picture reader opened once for ten assets:
three deterministic no-text results and seven pictures corroborated by four readers each,
with no second model-reading set.
Class twenty-five is therefore verified on a page;
class twenty-eight passes archive review without its prior quoted-revision mismatch.
Class twenty-seven was not exercised because no assembly withdrawal was needed.

The page is not clean:
class twenty-nine is the source-only closing poem losing all five explicit Markdown hard breaks.
It has twelve physical lines but zero rendered breaks;
slice 17 is `incumbentKind: "absent"`.
A cat fixture through the real built validator accepts the same flattening,
while the shared MDX grammar distinguishes one break in the source and positive control from zero in the candidate.
Reproducer:
`~/temp/agent/reproduce-Mio10-hard-breaks-20260910.mjs`,
red result `~/temp/agent/Mio10-hard-break-red-20260910.out`.
The independent review agrees that protecting a source-only passage follows the original-as-floor rule,
without deciding between archive and source layouts.
Fix only absent-incumbent passages,
compare explicit breaks per top-level block,
allow expansion and equivalent intrinsic lowercase `br`,
and leave archive-backed passages,
paragraph equivalence and author defense unchanged.
The installed MDX compiler emitted a `br` element for both two-space Markdown and `<br/>`,
and none for a soft newline.

Recorded wording defects remain distinct:
the inherited screenshot misspelling and coming-out bullet's timeline ambiguity,
the duplicated QQ-group naming,
and the new awkward university wording.
No readiness claim or queue advance is justified.
Detailed reading and diagnostic files are under `~/temp/agent/Mio10-*20260910.out`.
OpenRouter logged 0.618695602723 USD,
Bedrock 0.2738563435 USD;
last meters 268.75 and 185.78 USD respectively,
Synthetic weekly zero,
Hyper zero.
The daily-cost helper ran into `~/temp/agent/Mio10-costs-after-20260910.out`.
No corpus pass is running.

Launch record at 00:15 UTC on 2026-09-10:
`Mio10` runs on frozen `dc51b02d9`,
with classes twenty-five,
twenty-seven and twenty-eight.
Pass pid `1455521`,
runs `~/temp/agent/Mio10-20260910`,
log `~/temp/agent/Mio10-20260910.log`,
managed terminal-only supervisor `proc_abcf` (`translation-repair-Mio10-20260910`).
Prelaunch and launch balances:
OpenRouter 269.36 USD,
Bedrock 186.05 USD,
Synthetic weekly zero with five-hour 2750/2750,
Hyper zero.
Daily-cost output:
`~/temp/agent/Mio10-costs-before-20260910.out`.
No source change is planned while it runs;
a necessary source change requires killing pid `1455521` and relaunching.
The current full suite ends `unit exit 0` in `~/temp/agent/class28-unit-20260910.out`;
build,
types,
oxlint and edited markdown pass.
Read this page before `hulicaijia`,
including both screenshot translations,
the linked poem,
front matter and all seven-step/three-check requirements.
The remaining queue is unchanged.

Terminal update at 00:07 UTC on 2026-09-10:
`Mio9` stopped INCOMPLETE inside archive review after 1,075,657 ms,
before either lane.
No page or artifact was written.
The review heard four of ten seats;
MiniMax and Gemma returned valid JSON revisions with nonempty `sourceQuote`,
which the declared schema permits but `isArchiveBlockReviewWire` rejected.
Class twenty-eight is fixed in `dc51b02d9`:
`revise` may carry quoted source evidence without gaining retention authority.
Guard `1bc7623c3` failed `provider-unavailable` on the prior build,
then passed;
the full suite ends `unit exit 0` in `~/temp/agent/class28-unit-20260910.out`,
and build,
types and oxlint pass.
Relaunch `Mio` next.
Mercury's malformed JSON,
DeepSeek-flash truncation and Synthetic's transient 503 episode are separate losses,
not evidence for changing quorum or caps.
Last pass meters:
OpenRouter 269.36 USD,
Bedrock 186.05 USD,
Synthetic weekly zero,
Hyper zero.
The daily helper ran for both filename dates because this pass crossed midnight:
`~/temp/agent/Mio9-costs-after-20260910.out` and `~/temp/agent/Mio9-after-crossday-20260910.out`.
Do not advance to `hulicaijia` before a fresh `Mio` pass is read.

Launch record at 23:49 UTC on 2026-09-09:
the ninth `Mio` runs on frozen `5cb66ffaa`,
carrying class twenty-five and class twenty-seven.
Pass pid `1425902`,
runs `~/temp/agent/Mio9-20260909`,
log `~/temp/agent/Mio9-20260909.log`,
managed terminal-only supervisor `proc_5d73` (`translation-repair-Mio9-20260909`).
Prelaunch meters at 23:48 UTC and launch meters at 23:49 UTC:
OpenRouter 269.40 USD,
Bedrock 186.06 USD,
Synthetic weekly zero,
Hyper zero.
The required daily-cost output is `~/temp/agent/Mio9-costs-before-20260909.out`.
Read this pass before `hulicaijia`:
both screenshot translations,
the linked poem,
selective structural withdrawal if exercised,
and the complete seven-step and three-check reading.
The full suite ends `unit exit 0` in `~/temp/agent/class27-unit-20260909.out`;
types,
oxlint and edited markdown pass.
No source change is planned while it runs;
any necessary one requires killing pid `1425902` and relaunching.

Terminal update at 23:32 UTC on 2026-09-09:
the eighth `Mio` stopped INCOMPLETE after 5,673,650 ms at the publication guard:
`entry Mio would drop 1 source destination(s)`.
No page or settled artifact was written.
Diagnosed and fixed at 23:46 UTC as class twenty-seven:
a malformed `PhotoScroll` selected at slice 16 caused the assembly guard to withdraw all 15 translations,
including slice 17's valid poem with its Bilibili link.
`ad6d506a6` proves a single withdrawal by reparsing the whole document before falling back to blanket withdrawal.
The author-defense policy is unchanged.
Guard `3e1fec4be` failed first with both fixture replacements withdrawn;
the fixed full suite ends `unit exit 0` in `~/temp/agent/class27-unit-20260909.out`.
Build,
types and oxlint pass;
code and branch-coverage tip `5cb66ffaa`.
Relaunch `Mio` next,
not `hulicaijia`.
Final meters:
OpenRouter 269.41 USD,
Bedrock 186.06 USD,
Synthetic weekly 0.3868101893939394 percent,
Hyper zero.
The required daily helper output is `~/temp/agent/Mio8-costs-after-20260909.out`;
per-model spend and stage totals are in `~/temp/agent/Mio8-spend-20260909.out`.
The supervisor has exited and pid `1178354` is no longer running.

Launch record at 21:58 UTC on 2026-09-09:
class twenty-five is implemented in `f6cd6e5e7` and `07a99e23a`,
with verification complete and the eighth `Mio` running on frozen `5b228736b`.
Pass pid `1178354`,
runs `~/temp/agent/Mio8-20260909`,
log `~/temp/agent/Mio8-20260909.log`.
The managed supervisor is `translation-repair-Mio8-20260909` (`proc_8ef1`);
it watches that pid's lifetime and emits only its terminal state,
not progress.
Launch-time meters at 21:58 UTC match the 21:55 UTC prelaunch reading:
OpenRouter 270.03 USD,
Bedrock 186.24 USD,
Synthetic weekly zero,
Hyper zero.
The log confirms overlap 4,
built-in writer grace,
archive front-matter authority and Kimi withheld.
Read the page by the seven steps and three checks,
including both screenshot translations and no duplicate picture purchase,
before launching `hulicaijia`.
The preservation,
section-scope and no-repurchase guards each failed on the pre-fix build,
then passed in the full suite.
The real `settleEntry` wiring guard also failed against frozen `a5e0efc7f` because its review lacked picture text,
then passed on the current build (`edcc72b6e`,
fixture minimized in `9e7df9b40`).
Final full-suite log:
`~/temp/agent/class25-final-unit-20260909.out`,
last line `unit exit 0`.
Type checks pass;
oxlint reports zero warnings and errors.
`865859305` moved cache retirement into `pass-entry-caches.ts` to preserve the line budget;
`76d27dc31` applied the formatting findings.
The textless and unavailable prior-reading branches pass in `5b228736b`.
Red logs and the first full suite live under `~/temp/agent/translation-repair-class25-20260909/`.
The baseline markdown check passed on this handover,
the planning log and package README.
The proposed shared disk-cache object was not sufficient:
`openNamespacedCache.persist` writes disk without updating `resumed`.
The implemented reader retains completed evidence within one entry and reads only newly exposed references,
so a re-preparation or reader reseating cannot buy the same completed picture again.
Unavailable readings never enter that completed map.
The queue and owner decisions remain unchanged.
