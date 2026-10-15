# Design commitments

Part of [the package README](../README.md).

- **No single model output is a decision point.**
  Every decision is either deterministic code
  or an aggregate over independent model calls from different vendor families.
- **Issues carry verifiable evidence.**
  Spans and insertion anchors reference stable node IDs and offsets against a hashed base document;
  claims failing deterministic validation are discarded.
- **The source is not ground truth.**
  Suspected source transcription errors,
  interpretive ambiguity,
  and alignment failures are first-class issue states that can block correction and preserve safer translations.
- **Structure is detected per document,
  never assumed per class.**
  Footnote handling activates on detected markers (open convention set:
  `〔1〕`,
  `[^1]`,
  `[1]`);
  unrecognized conventions become findings for human confirmation,
  not silent misparses.
- **Refusals are handled reactively,
  never predicted.**
  Content is never pre-classified for sensitivity;
  refusals reroute across model families and feed a measured scorecard.
- **Detection and repair are graded by separate instruments.**
  `formatGradingSheet` asks only whether an accepted issue is a real defect and shows no correction,
  because seeing one makes an alleged defect look more real and would move that answer.
  `formatRepairSheet` asks,
  on its own sheet and after the first is done,
  whether the returned wording fixes it.
  Keeping them apart is what lets one round's precision be compared with
  another's rather than with a changed instrument.
  Model and corpus text reaches those sheets fenced (`fenceForMarkdown`),
  since a replacement is arbitrary text crossing into
  Markdown grammar and can otherwise invent a heading or a grade box.
  A sheet is **read** before it is handed to anyone,
  item by item,
  including the reasoning it shows the grader.
  A sheet whose generator ran is not a sheet that asks a sensible question:
  the first introduced-defect verification sheet reached the user with all
  eight of its reviewer claims argued against the pre-edit translation rather than the original,
  one of them reporting a corrected mistranslation as damage,
  and nothing in the pipeline could have caught that because every stage had succeeded.
- **A grade is bound to the draw it was written on.**
  Sheets print no issue ids,
  deliberately,
  because a hash is noise a human has to read past,
  so grades are joined back to machine verdicts **by position**.
  Seed and corpus pin cannot carry that join alone:
  the draw is deterministic in its seed but not in its **pool**,
  and the pool grows with every entry that settles,
  so one seed at one commit names different items at different times.
  Two draws can then agree on seed,
  pin and item count while describing different issues,
  and a positional join would mislabel every verdict without erroring anywhere.
  `computeDrawDigest` fingerprints the ordered item identities,
  both sheets and the manifest carry it from one computation,
  and `parseSampleManifest` recomputes it rather than trusting the stored string,
  since a digest never checked against its own contents proves only that two files share characters.
  A draw taken before the binding existed is scoreable and says so;
  a pair where only one side carries a digest is refused,
  because one draw writes both in the same instant.
- **Text entering a prompt is fenced against its own content.**
  `selectFence` chooses a delimiter strictly longer than any run inside every string a prompt encloses.
  A fixed delimiter would let a translation containing a setext heading
  underline close its own block and have the rest of its text read as instructions.
- **A new measurement records before it decides.**
  `runIntroducedDefectProbe` asks whether a repair broke something nobody raised,
  which `regressedKnownIssues` cannot see because it reads verdicts keyed by issues a critic already filed.
  It ships in shadow mode:
  the report reaches the outcome and the artifacts,
  and candidate selection does not read it.
  It was built expecting the opposite failure.
  Every region it inspects contains a defect by construction,
  that being why the region was edited,
  so a model asked whether anything is wrong was expected to find something,
  and gating on an over-eager probe would have discarded correct fixes.
  Measured on 2026-08-12 over all 857 probed regions of the settled artifacts,
  the probe was nearly silent instead:
  2438 of 2571 prober verdicts found nothing,
  and the raise rate barely moved with how much text the edit removed.
  **Read that as history,
  not as the probe's behaviour.**
  Those verdicts were produced under a question that made the pre-edit **translation** the standard of accuracy,
  asking whether the replacement introduced a defect the **before** text did not have.
  Read back,
  every claim it produced argued from that text,
  and one reported a corrected mistranslation as damage,
  so the figure measures whether an edit **changed** anything rather than whether it damaged anything.
  The question is now anchored on the **original**,
  and every probe figure taken before that change is withdrawn.
  Under the new question,
  on a twenty-region draw read against the Chinese,
  the probe flagged three of three damaged regions with one false positive and no misses,
  which is the first version of this instrument that discriminated at all.
  That reading is one agent's and one draw's,
  so it sizes nothing.
  A second reading on 2026-09-03,
  every region with a corroborated claim across the four probed landings,
  found six of ten true (three of them the house tense rule),
  three false (two misparse 我方才知道 as "our side") and one borderline.
  Shadow mode stands until a human grades a sample.
  What changed on that reading:
  the lane contest is shown the corroborated
  claims against the repair candidate as evidence lines after both candidates,
  with the four-in-ten error rate stated,
  and its cache key folds them in;
  nothing acts on a claim (`repair-damage-evidence.ts`).
  The claims come from both probes the lane runs,
  the accuracy repair's and the naturalness rewrite's,
  each line naming its edit:
  a keyword233 draw the same day had the rewrite move a paragraph into the present tense,
  three probers corroborated it,
  and the contest was shown nothing while only the accuracy probe was read.
  The contest driver logs how many claims a slice's judges were shown.
- **A placeholder in the archive is not content the pipeline preserves.**
  `passArchiveText` (`corpus-run/pass-archive.ts`,
  run inside `preparePassEntry`) folds invisible variants and then strips any paragraph
  that is nothing but a stub token (`(To-Do)`,
  `TODO`,
  `TBD`,
  `WIP`,
  one layer of brackets,
  any case) outside front matter,
  HTML comments and code fences,
  logging `archive: stripped stub marker ... at line N`.
  Measured against the 92 English pages of the pinned corpus:
  one such marker,
  XIEPT2's,
  which the pipeline had published over a finished translation.
  HTML comments stay:
  `entry-notes.ts` reads them as editor comments and a reader never sees them.
  Decision:
  `doc/decision/translation-repair-good-result-over-bad-original.md`.
- **Judge seats follow the provider that would serve them.**
  `readJudgeSeats` reads the router's own dryness view (every provider's meter,
  holds folded in) before each phase of an entry (lanes,
  lane contest,
  consolidation;
  once per entry until 2026-09-03,
  when XIEPT2 ran Synthetic dry seven minutes into 219) and asks,
  per seat,
  which provider would take its calls:
  the first in `PROVIDER_ORDER` that serves the model and reads wet (`providerServing`).
  Where that is Hyper,
  the judges Hyper serves too slowly for the round window are withheld (`HYPER_SLOW_JUDGES`,
  Qwen3.8-27B:
  cut in 30 of 34 translate-lane select rounds with Hyper alone,
  answering 25 of 28 when Synthetic served it),
  and `HYPER_SLOW_SELECT_JUDGES` (Kimi-K3:
  cut in 0 of 69 select rounds on Synthetic,
  43 of 83 and 38 of 101 with Hyper serving most or all of them,
  almost never in any other judge role) leaves both
  lanes' slate select seats and the consolidation slate while keeping every other seat.
  Where that is OpenRouter,
  `OPENROUTER_WITHHELD` (Kimi-K3,
  by the owner's cost decision of 2026-09-03:
  3 and 15 USD per million tokens,
  52 to 61 percent of an entry's all-OpenRouter cost) leaves every seat,
  the translator and picture-reader seats and every roster-wide stage (block pairing,
  archive review,
  insertion admission,
  consolidation writing) included:
  the first OpenRouter-only pass,
  keyword233 on 2026-09-03 at 18:15 UTC,
  bought six translations from it while every judge bench had it out,
  a quarter of that pass's bill,
  and the next one bought its first call from the pairing round before any bench was read.
  Each stage reads its own `JUDGE SEATS` line (`phase=preparation`,
  `pictures`,
  `lanes`,
  `lane contest`,
  `consolidation`),
  and the checker bench is the first three of `RUN_CHECKER_ORDER` (`src/corpus-run/run-config.ts`,
  ranked by the checker benchmark of 2026-09-27)
  that a wet provider serves,
  padded with ranked seats no provider serves only while fewer than three are served,
  so the bench keeps the floor the checker contract holds;
  both checker assertions run on the derived roster before each phase.
  An unreadable view seats the full bench.
  The static benches in `run-config.ts` are the Synthetic-wet ones,
  seven wide seats and eight late judges;
  the `JUDGE SEATS` line names every provider's state,
  every bench size,
  the translator,
  reader and roster counts,
  and every withheld model.
  Decisions:
  `doc/decision/translation-repair-provider-aware-judge-seat.md`,
  `doc/decision/translation-repair-openrouter-fallback.md`.
  Shadow mode is a recorded decision rather than an unfinished edge,
  with the
  rejected gating designs and the condition that reopens it in `doc/decision/introduced-defect-probe-gating.md`.
  Claims are screened deterministically rather than believed:
  a quote must be new in the replacement,
  or gone from it for dropped content,
  and `screenNonTranslationVotes` is the precedent for evidence that dismisses
  an impossible claim without having to prove a possible one.
- **Every stage that changes shipped text is audited,
  including the last one.**
  The naturalness lane runs after the accuracy stage and rewrites whole slices,
  so the accuracy probe's verdict describes text the lane may have replaced.
  `retainsResolvedIssues` guards only the opposite direction,
  that a rewrite did not undo a confirmed repair,
  and a rewrite can leave every confirmed repair standing while damaging the wording around them.
  An accepted refinement therefore runs the same probe against its own pair,
  the repaired text against the refined text,
  recorded as `refinementDefects`
  and reported apart from the accuracy figures because the two audit different edits against different baselines.
  Its prompt gets a second framing:
  telling a prober that an editor was fixing defects,
  when it was rewriting already-correct text for fluency,
  invites reading every rephrasing as a failed repair.
  `probe-sensitivity` checks that framing against injected damage,
  and its control is the case that matters,
  since a probe that reads rephrasing as
  damage would flag every refinement the lane ships and would look identical to a clean run while doing it.
- **Whitespace Markdown renders the same is not a defect.**
  Owner,
  2026-09-27:
  "There is no need to eliminate extra newlines,
  because markdown doesn't care."
  A run of blank lines where the archive has one,
  or a wording whose edge newlines differ from its archive span's,
  renders as the archive does,
  so no pass,
  floor or finding acts on it.
  Spacing that changes rendering is another matter:
  a list's items loose or tight (`list-spread-restore.ts`),
  or two paragraphs joined by a single newline.
  Carriage returns are kept apart by a second ruling:
  asked whether this one retires `corpus-run/line-ending-fold.ts`,
  which folds a model's CRLF to LF at page assembly (ledger A3),
  the owner kept the fold on 2026-09-27.
  The corpus reader already folds the archive to LF,
  so the fold keeps each published page on one line-ending convention,
  and a stray CR shows in diffs and tools even where Markdown renders it alike.
- **A run always ships.**
  Owner,
  2026-09-27,
  rejecting a `verify-published` that would refuse a run over a page no artifact records:
  "One of the rules is no matter what,
  we must ship."
  A check reports what it finds and repairs what it can;
  it never withholds a run's pages.
  A page whose artifact a crash lost between the two writes (`publish-fixed.ts`) therefore ships,
  reported as `PUBLISHED AND NOT SETTLED`;
  measured on 2026-09-27,
  no such page exists among the 214 pages in 372 run directories.
  Asked the same day how the rule reaches the two findings that then still exited 1,
  the owner chose repair and a clean exit:
  a pass starting in a runs directory rewrites from its artifact any page that is missing
  or that differs from what the artifact says ships,
  and `verify-published` prints every finding and exits 0,
  keeping its separate exit 2 for a run it could not read at all.
  Following from the same two rules rather than from an answer,
  a decline removes a page an earlier crash left for the entry,
  so the archive ships as the archive's note says it must.
  That question told the owner no page had ever disagreed with its artifact,
  a count that had only checked pages exist (ledger M18).
  Judged by the build of 2026-09-27,
  77 of the 214 stored pages disagree,
  every one written after the publish-time agreement check existed and so agreeing with its own build:
  the would-ship reader applies `restoreTypography` when it reads,
  and two later fixes there (class 181,
  punctuation inside a closing quote;
  class 147,
  a nested quotation curled as a pair) account for 69 of them.
  Told this,
  the owner chose again,
  the same day,
  that a pass rewrites such pages to the running build's reading:
  a page that does not parse stays as it was and is reported.
  A pass meets an older build's pages only on a resume the operator opted into,
  since the build-generation guard refuses one otherwise.
- **A settled page ships with its defects reported.**
  Owner,
  2026-09-27,
  asked whether the publish-time checks keep refusing a settled entry
  (front matter,
  sealed English originals,
  contributor names,
  link destinations,
  merged headings,
  and whether the page parses),
  with the archive's page shipping in its place:
  "Ship with the defect".
  The page ships and each failed check is reported,
  in the run log and on a line a grep over a pass totals;
  a page that does not parse still refuses,
  since it would break the site build.
  Measured before the ruling:
  seven real entries were refused for one dropped link destination each,
  about 10.3 hours of settling discarded (ledger E1).
  The check that a page carries what its artifact says ships joined them by a second answer:
  asked the same day whether a page failing it,
  which is a defect in the assembly code rather than in the text,
  should still refuse with the archive's page shipping in its place,
  the owner chose "Ship with defect reported".
  It had fired in no real run (the 8 run logs naming it were all test suites).
- **A slice with no valid wording keeps the archive's,
  and the page ships.**
  Owner,
  2026-09-27,
  asked whether an entry keeps stopping at once
  when no wording for a slice passes the deterministic rule
  (the lanes',
  the consolidations' and the archive's,
  or the archive has nothing there),
  given that a stopped entry leaves the archive's whole page live,
  that slice included:
  "Keep archive,
  ship".
  The slice keeps exactly what the archive has there,
  nothing where the archive is silent,
  the page ships with every other repair,
  and the slice is reported on the `DEFECTS` line.
  This replaces the "else fail the slice at once" half of the rule of 2026-09-04;
  its first half stands,
  so a valid proposal is still preferred wherever one exists.
  Measured before the ruling:
  18 real entries stopped on this refusal from 2026-09-04 to 2026-09-27,
  about 34.3 hours in all,
  most on terminals later rulings already turned into shipping the slate's choice;
  on the build of the ruling,
  one real stop was of the kind still reachable (yulianNyanner,
  `incumbent-only`,
  0.48 hours).
- **A confirmation sizes its quorum on the seats it could ask and reach.**
  Owner,
  2026-09-27,
  asked whether the bench seats a naturalness confirmation may not ask
  (it asks only its discovery's seats) count as out of reach when its quorum is sized,
  as a seat the router refuses does under the 2026-09-09 short-bench rule:
  "Count as out of reach".
  With nothing refused,
  or with asked seats able to meet the bench quorum,
  nothing changes;
  in XingZ624's shape (5 of 8 asked,
  2 refused) the confirmation decides on 2 of its 3 reachable voices
  rather than closing `quorum-not-met` (ledger E3).
- **A panel verdict gives its reason before its vote.**
  Owner,
  2026-09-27,
  asked whether each issue-panel verdict carries a reason,
  and if so before or after the vote,
  told that no panel bench exists
  and that the last panel-sheet change moved support from 72% to 65% on one run per arm:
  "Reason before vote".
  Measured before the ruling over 265 stored artifacts:
  about 783 panel verdicts per entry,
  and 167 characters on average for the reasons other stages' ballots carry.
  The reason is stored with the ballot and logged beside the issue's decision (ledger E5).
  Its effect on votes is measured at the next run,
  TianqiChen666,
  as the share of panel ballots voting supported against TianqiChen66620's,
  one run per arm (`doc/status.md`,
  the 2026-09-27 section).
- **A winning patch sheds the edits a checker voted worse,
  and the rest is rechecked.**
  Owner,
  2026-09-28,
  asked what happens to edits inside a selected repair patch whose issues the checkers did not confirm
  (345 of 2,148 patches over every run,
  18 of 51 on TianqiChen666;
  691 such issues:
  651 not fixed,
  39 on a fixed and worse tie,
  1 on a worse majority):
  "Revert worse-voted,
  recheck".
  An edit whose issue drew at least one worse ballot is stripped from the patch,
  and the reduced patch faces one more checker round before it ships;
  a not-fixed edit with no worse ballot stays (ledger L3).
  Corrected after the ruling:
  the question put the stripped share at 40 of the 691 issues,
  counting only the ties and the worse majority;
  at least one worse ballot is 58 issues in 31 patches over every run,
  and 15 issues in 6 of 51 patches on TianqiChen666 (`ride-along-split.mjs`,
  recounted 2026-09-28).
- **A rewrite after a lost patch is rechecked before it ships.**
  Owner,
  2026-09-28,
  asked what happens when the naturalness stage rewrites the archive
  after the accuracy patch lost,
  which shipped with no checker round
  (1,218 of 2,144 refined slices over every run;
  106 of 125 on TianqiChen666,
  75 over accepted issues):
  "Recheck the rewrite".
  The rewrite faces a checker round against the slice's accepted issues and the regression probe,
  and a rewrite the checkers find worse keeps the text before it (ledger L11).
  Decided for quality,
  2026-09-28,
  under the owner's standing directive that the quality of the end result decides:
  a rewrite the regression probe admits a claim against keeps the text before it too;
  175 of 2,144 kept rewrites carried one,
  and a graded reading of flagged regions found six of ten true.
- **Inside a licensed quote,
  an edit keeps the markup atoms its issue does not license it to remove.**
  Owner,
  2026-09-28,
  asked what the editor's preservation gate should protect inside a quote an edit may change,
  where it could never reject anything:
  "Markup atoms".
  Footnote references,
  link destinations,
  MDX expressions,
  inline code and tags survive every edit
  except a removal an addition issue names;
  prose damage inside the quote stays with the checkers (ledger L4).
  Refined for quality,
  2026-09-28,
  under the owner's standing directive that the quality of the end result decides:
  a replay of the ruling's wording refused 24 recorded edits,
  17 of which re-marked markup or moved it rather than lost it.
  Markup the source carries survives;
  an atom one edit drops and another edit of the same patch writes has survived;
  an MDX expression,
  inline code or tag the translation authored may be re-marked (same kind,
  or into markup the source carries)
  but never dropped;
  a footnote reference or link destination has no such excuse,
  since a label or address is an identifier
  no checker judges.
  The addition removal stays the one licensed loss.
- **A reply no one could read is re-asked on another provider,
  nudged.**
  Owner,
  2026-09-28,
  asked what becomes of the router's cross-provider re-ask,
  which never ran because the prompt-uniqueness wrapper bypasses it:
  "Enable with the nudge".
  The re-ask carries the recovery nudge,
  so its prompt digest differs from the first ask's
  and prompt uniqueness holds (ledger P9).
  Refined for quality,
  2026-09-28,
  under the owner's standing directive that the quality of the end result decides:
  the re-ask's nudge is worded apart from the stage recovery round's,
  since the round re-asks every seat still unreadable and a shared wording would make its prompt
  this re-ask's digest,
  answered from the claims with the reply that already failed;
  and a refusal-shaped reply is re-asked elsewhere too,
  with a nudge neutral on why the reply could not be used.
- **A reply the length limit cut is re-asked as cut,
  not as off the shape.**
  Decided for quality,
  2026-09-28,
  under the owner's standing directive that the quality of the end result decides (ledger P10):
  the recovery round told every unreadable seat its reply "did not match the required response shape",
  while 74 of the 75 cap-cut deepseek-v4.1-flash replies on Hyper had streamed no content at all.
  Each cause now has its own wording (`src/recovery-nudge.ts`);
  the cut one names the length limit and asks for the answer within it,
  keeping any working brief,
  which is prose in the prompt and never a reasoning parameter on the wire.
- **A claim the panel settles at neutral asks for no edit;
  the sheets define every severity.**
  Decided for quality,
  2026-09-28,
  under the owner's standing directive that the quality of the end result decides (ledger L5):
  neutral asserts no defect,
  yet 28 accepted neutral issues shipped an edit,
  8 of them claims calling the rendering correct.
  The tally holds such an acceptance for a human;
  the critic and panel sheets define minor,
  major and critical after MQM
  and neutral as a finding a human should see that names no defect in the translation;
  the panel votes down a claim naming nothing wrong and lifts a real defect filed neutral to minor.
  This refines the 2026-09-27 ruling "Major+ accuracy" without contradicting it:
  that ruling concerned accuracy claims other than additions,
  and kept additions disputing "at any severity"
  as the option's wording said;
  an accepted addition can no longer settle at neutral,
  so in effect an addition disputes the archive from minor up,
  and one no supporter finds a defect in disputes nothing.
- **The quality of the end result decides;
  a choice made for it is not a design decision.**
  Owner,
  2026-09-28,
  standing directive,
  answering two questions put as design choices
  (which fix-shaped refusals the L4 markup gate should let through,
  and whether the L11 probe stays in shadow):
  "Do not try to save effort and just do the option that would result in best quality of the end result",
  and "I want to make 'prefer quality of the end result' a standing directive
  and decisions that are made for quality and don't conflict with other decisions aren't design decisions."
  A choice whose options differ in the quality of what ships is decided for quality,
  recorded,
  and built,
  never asked;
  effort,
  code size and wall clock are not reasons to take the lesser option.
  A question goes to the owner only when a quality choice conflicts with an earlier ruling
  or the options differ in something other than quality.
- **A slate over an archive most of the contest condemned is run off.**
  Owner,
  2026-10-11,
  answering what should trigger the run-off after TianqiChen66622 slice 4 shipped the archive's present-tense
  sentence over a contest whose ballots called it flawed 4 to 1:
  "Majority flawed yes".
  This replaces the 2026-09-24 rule ("Run-off only when every contest ballot called the archive flawed")
  for the run-off only;
  the forfeit of an undecided gate
  (2026-09-27,
  "Slate's choice")
  moves to majority too
  (owner,
  2026-10-11:
  "Majority,
  like the run-off").
- **A tie the standing drew no ballot in is run off among the tied.**
  Owner,
  2026-10-11,
  same slice,
  where the slate tied three ways at weight 1 and no judge chose the archive:
  "Run off the tied finalists".
  The standing still ships if that run-off ties again.
- **Repeated source lines are rendered one way on a page.**
  Owner,
  2026-10-11,
  after the refrain 所以她是个……女孩吧 rendered four ways on TianqiChen666 twice:
  "Page-level consistency pass",
  the option reading:
  after assembly,
  find source sentences or refrains that repeat,
  and if their renderings differ,
  have the judges pick one rendering
  (or a refrain pattern)
  and apply it to all,
  respecting slices where context calls for different wording.
  An occurrence in a slice where the archive stands is replaced too,
  when the judged rendering passes every floor there
  (owner,
  2026-10-11:
  "Yes,
  replace it").
  A repeat with a quoted occurrence stays out of the groups
  (owner,
  2026-10-11:
  "Leave quoted repeats out").
  The repeats are located by ledger B423,
  with a repeat that touches quoted speech anywhere left out (B434)
  and no two groups claiming one span (B435);
  the pass that judges them and carries the choice to every place is ledger B431.
- **The consistency pass carries words and leaves every mark where it was.**
  Rules of the lead on 2026-10-13,
  2026-10-14 and 2026-10-15 after the independent reviews of the pass,
  and of the owner's question of 2026-10-13,
  "Can't we pre-fix the apostrophe things deterministically?"
  Recorded in ledger B463 to B626 and B628.
  Landed on 2026-10-15:
  the rules of the earlier rounds with the tests `7ae9914d3d` and the code `1fb06389e1` (by the lead's notes),
  and the shown words at a span edge,
  the pairing of typography on shown text,
  the page's definitions for every reader of a slice,
  the tie rule for `'the '90s'` and the smaller findings (B597,
  B598,
  B604,
  B605 and B609 to B615),
  with the corrections of the review that followed (B616 to B618,
  B621 and B622) and the group line's reason (B628),
  with the tests `5fe3173cc5` and the code `277145a862`.
  Open:
  the definitions inside containers (B620).
  The rows of B619 are fixed by n166,
  n168 and n169,
  which are green and not landed,
  with the rows left to them taken by n173.
  The words rule:
  the span the pass replaces is the words alone.
  The single marks that touch each edge of the span are read at the chosen place and at the receiving place.
  Eight single marks count when a splice is judged:
  `'`,
  `‘`,
  `’`,
  U+02BC,
  `‚`,
  `‛`,
  `‹` and `›`.
  The straight mark,
  `’` and U+02BC are one mark,
  and `‘` equals only itself.
  From artifact generation 17 the record of a located place stores four of them
  (`'`,
  `‘`,
  `’` and U+02BC).
  A splice is unavailable in each of these cases.
  The two places differ in a touching mark.
  The loose marks inside the two sets of words differ in sequence.
  A mark stands beside the receiving words and the edge character of the incoming words is of another class
  (a letter or digit,
  any other character,
  or nothing).
  Or the two sets of words differ in block breaks,
  since no splice of one set into the other can pass the floor that holds the page's block count.
  A loose mark is a single mark with no letter or digit directly on both sides of it.
  When a splice goes ahead each loose mark of the incoming words is written in the receiving place's form,
  so a straight mark carried onto a curly page arrives curly.
  A place the splice cannot carry is carried by a writer's paragraph when a writer was asked and the bench chooses it,
  and otherwise keeps its words.
  A writer's paragraph is withheld when it no longer holds,
  at the block's edge,
  the words of any place of the group that runs over that edge and must stay:
  a receiving place the splice cannot carry,
  the chosen place,
  a place kept for its context,
  and a place that already reads as the chosen one.
  Two groups that share a block are settled together over the English as it stood when the pass began,
  and the group that gives way keeps its places' words.
  A gain is a splice whose incoming words bring an edge mark that the receiving words lack:
  an apostrophe at the start or the end of the span.
  A gain is carried only when the apostrophe is proven.
  An edge single mark is an apostrophe only when nothing in the whole page's prose can pair with it.
  The proof reads the prose of the English:
  code,
  markup and its attributes,
  comments,
  link destinations,
  addresses and emphasis marks are blanked first.
  Every single quotation character is a possible partner.
  The backtick and `‘`,
  `‚`,
  `‛`,
  `‹` and `›` count as an opener and a closer wherever they stand,
  and `'`,
  `’` and U+02BC count by kind:
  an attached mark is inert,
  a trailing mark is a closer,
  a leading mark of any apostrophe-like form is an opener,
  and a free mark both.
  A mark reads attached,
  trailing,
  leading or free by what stands beside it:
  a trailing mark is followed by white space,
  punctuation other than a single mark,
  or the end of the text,
  a leading mark is preceded the same way,
  a letter or digit of another script,
  a symbol or a pictograph beside it makes it free,
  and so does another single mark directly beside it.
  Closing emphasis,
  strong or strikethrough delimiters from the parse and a link's closing tail
  can stand between a word and its trailing mark;
  a closing double quotation mark or a closing parenthesis cannot.
  A trailing mark is proven when no possible opener stands before it,
  and a leading mark when no possible closer stands after it.
  A proven apostrophe belongs to its word,
  is inside the span and travels with it.
  The proof is decided on the page with every edit of the pass applied:
  an edit is left out,
  with a finding,
  when the apostrophe it carries in is not proven there,
  and the check repeats until no edit drops.
  A splice that adds or removes a mark that is a quotation mark on the page,
  free or partnered,
  is refused.
  The refusal run.
  A gain is also refused when a kept mark would stand next to the arriving one for the eye.
  The pass looks across the run between the receiving words and the kept mark on the gain side,
  or one wide run away,
  and refuses when it reaches a mark.
  The run is stated by what the page shows between the two marks,
  and never by a list of characters.
  It steps over white space of every kind,
  a single line break inside a paragraph or a setext heading
  (a soft break,
  two spaces and a break,
  a backslash and a break)
  together with the container markers and the indentation that open the next line inside the same paragraph,
  a line made only of invisible or non-ASCII space characters,
  every character that shows nothing or a blank gap
  (the default-ignorable characters,
  the C0 and C1 controls other than the breaks and U+0000,
  and U+2800),
  U+0085,
  U+2028 and U+2029 as line breaks,
  the characters of emphasis,
  strikethrough and code markup (`*`,
  `_`,
  `~` and the backtick),
  literal or not,
  tags,
  footnote references and links,
  a backslash escape read as the character it shows
  (an escaped `*` steps,
  an escaped `&` is a visible character),
  and a character reference that is not itself a mark.
  It ends at a character that shows,
  a visible backslash (`\’` is no escape),
  a blank line,
  and any other block.
  Whether two marks share a paragraph is read from the page's own parse,
  with a line of invisible characters taken as inside the paragraph.
  The page-wide reference refusal:
  a character reference that decodes to a quotation-like character
  (23 named references,
  decimal ones of up to 7 digits and hexadecimal ones of up to 6)
  makes every splice of that page unavailable,
  wherever the reference stands,
  with the kept reason `edge-reference-mark`.
  It counts only where the page shows the reference as text:
  not in code,
  a tag attribute,
  a link destination or title,
  a comment,
  or behind a backslash.
  The English of every slice of the page is read,
  slices read alone included.
  Span edges are whole units on shown words.
  A backslash escape of ASCII punctuation and a character reference that the parser decodes are each one unit,
  shown as the character they stand for.
  An edge cuts or keeps a unit exactly as it would that character,
  and never splits it;
  a quote whose edge falls inside a unit is widened to the whole unit.
  Text that only looks like a reference (`Q&A;`) is no unit at an edge.
  The word test at an edge reads shown text,
  and runs on the final,
  widened edges:
  a unit counts as its shown character,
  default-ignorable characters are transparent,
  and `&` between two word characters joins them.
  A word character is a letter,
  a mark or a decimal digit of a script that sets its words apart by spaces,
  so Han,
  Hiragana,
  Katakana and U+02BC are not word characters here,
  and `_` between two word characters joins them.
  What a reader sees decides what is transparent.
  Emphasis,
  strike and code delimiters,
  link brackets with their destination and title,
  tags that wrap text,
  comments and expressions show nothing between the pieces of a word,
  so a span edge beside them is read as beside the word.
  A hidden stretch (a link destination or title,
  a tag attribute,
  a comment) hides every unit in it,
  whatever the width of the unit,
  so a reference,
  an escape or an astral character inside it is hidden whole.
  Markup that separates or annotates ends a word:
  a line break with or without a slash,
  a block tag,
  a table cell,
  an image,
  and the `rt` and `rp` of a ruby annotation.
  Inline wrappers (`b`,
  `i`,
  `em`,
  `strong`,
  `span`,
  `a`,
  `u`,
  `s`,
  `sub`,
  `sup`,
  `ruby`,
  `mark`,
  `small` and `code`) stay transparent.
  The content of an inline code span is a shown word,
  so a text place beside it is refused.
  An edge that would cut a shown word leaves the receiving place as it was,
  and refuses a chosen place.
  Detail:
  ledger B597,
  B598 and B616 to B618.
  Typography acts only on prose that the page parse shows.
  Curling a mark,
  the ellipsis,
  the guillemets and the unification of quote style of a page read one mask built from the parse.
  Front matter,
  comments,
  code of any kind,
  math,
  expressions,
  tags and their attributes,
  link destinations and titles,
  and bare addresses are no prose;
  an indented line is prose,
  since the MDX grammar has no indented code.
  A text that the grammar refuses has no prose,
  and a reader that gets such a mask logs a finding that names the slice.
  Every reader that parses a slice reads it with the page's definitions,
  so a reference label that holds a mark is no prose where its definition stands in another slice,
  and a shortcut reference is read the same way.
  An edit-region fragment is read where it lands in its slice,
  and a landing outside the slice throws `FragmentLandingError`.
  The text of a link whose label is an address is no prose.
  The pairing context of typography reads the same shown text as the word test,
  so `<b>'hi'</b>` curls and `rock *'n'* roll` takes `’n’`.
  Detail:
  ledger B605 and B609 to B615,
  B621 and B622;
  the definitions inside containers are an open item (B620).
  The elision and quoted-number readings of a straight mark on a curly page:
  a listed elision (`'tis`,
  `'twas`,
  `'til`,
  `'em`,
  `'cause`,
  `'round`,
  `'n'` between two words,
  and a decade or a year of two digits and no third such as `'90s` and `'99`)
  curls to `’` when it is unpaired,
  and when it begins a quotation the pair curls as a quotation.
  An elision inside a quotation curls to `’` and never takes the place of the opener that waits.
  A two-digit number directly followed by a closing straight mark (`'42'`) is a quoted number and pairs.
  Pairing is nested,
  emphasis and link delimiters are opening and closing context,
  and an opener followed by markup is an opener.
  A replacement whose marks still cannot all pair keeps them straight,
  with no guessed glyph.
  Between the elision and the quoted-number readings of `'NN`,
  the one that leaves fewer marks unpaired wins,
  and a tie keeps the elision,
  so `'the '90s'` curls to `‘the ’90s’`.
  The log line of a consistency group counts all nine outcomes of its places,
  and when a place was left as it stood,
  or the bench was not asked,
  failed or named no winner,
  it ends with `because=` and each distinct reason,
  each the code's own decision read from the record (ledger B628).
  Detail for each rule is in the ledger:
  the marks and the proof in B463 to B555,
  the refusal run in B557,
  B564 to B567,
  B574 and B575 to B589,
  the page-wide reference refusal in B564 and B575,
  span edges in B590 to B598,
  what the word test reads as shown in B616 to B619,
  elisions and pairing in B563,
  B568 and B599 to B605,
  the prose mask and the readers of a slice in B606 to B615 and B620 to B622,
  the cache versions in B607,
  B608 and B623,
  and the group line in B628.
  Corpus counts (the 92 English pages `people/<id>/page.en.md` of the pinned corpus,
  2,799 prose blocks,
  counted with the package's own parser):
  - The production function proves 27 trailing and 1 leading marks,
    and the pass ships 25 and 1.
  - The run finds a kept mark beyond the receiving words at 50 sites in 24 pages.
  - No page holds a reference that is a mark (0 pages).
  - The prose mask changes no character outside prose on the 92 pages
    (the 1,237 slices;
    ledger B606).
  - Typography changes 0 characters on the 92 pages under the shown-text rules and the page's definitions.
    The word test changes 21 decisions on 8 pages
    (13 from the `_` joiner and 8 from markup in a shown word),
    and the 21 pages that hold definitions change no prose flag
    (ledger B597,
    B598,
    B617).
  What a reader of a page sees as a result of the accepted limits:
  - A place whose edge mark differs from the chosen place's keeps its own wording or takes a writer's paragraph.
    So does a place whose words stand beside a mark and end in another class of character than the incoming words,
    and a place whose words differ from the chosen words in block breaks.
  - A place whose words end in emphasis,
    a closing double mark,
    a closing bracket or a link before a possessive `'s` is never located and keeps its words.
  - Carrying `the parents’` onto `the family`,
    which has no mark,
    keeps the place's words,
    with a finding,
    when another quotation mark of the page's prose could pair with the carried apostrophe.
    Where none can,
    the apostrophe arrives and stays an apostrophe.
  - A decade written `1990's` holds no stand for `1990`.
    A frame whose slot is a bare year written that way gets no slot,
    and both places keep their words.
  - A web or mail address holds no stand.
    A relative link destination is not an address and is still located.
  - A slot that stands twice inside its span leaves the place without a slot.
  - Equal words with different marks go through the writers and the bench,
    which costs model calls.
  - A page whose own apostrophes mix straight and curly keeps the form of the chosen place for an arriving apostrophe,
    since the page offers no one form to follow.
  - Quote-like characters that are none of the eight marks
    (the backtick,
    U+00B4 and U+2032)
    stay inside a span at a quote's edge,
    and a replacement replaces them.
  - A corner bracket directly beside a span is not recorded and stays where it is.
  - A block carried in part leaves the place code could not move as it was,
    with the finding `consistency-partly-carried`.
  - A quoted letter such as `the letter 'n' is` keeps the reading of `rock 'n' roll`,
    since no context separates them.
  - `<!-->` and `<!--->` are read as comments that never end,
    where CommonMark calls them complete.
  - A word in Han,
    Hiragana or Katakana has no word edge for a span to cut,
    so an edge beside such a letter is not refused,
    and U+02BC stays a mark and not a word character.
  - A definition inside a list item,
    a blockquote or an HTML block is not part of the page's definitions,
    and a link definition directly after a footnote definition is read as part of the footnote (ledger B620).
  - The names of the block tags that end a word are typed by hand,
    under a test that reads the installed parser's list and fails when a name it holds is missing (ledger B617).
  - The generation 17 reader holds no English,
    so it cannot check a recorded mark or that an edge apostrophe was proven.
    A forged record that the pass never writes
    (a byte-equal copy of another block's record,
    a mark that folds equal)
    is accepted and changes no page.
  - No property check tells an apostrophe from a quotation mark,
    since that is a judgment about the English.
    Hand fixtures cover the shapes known to matter,
    and a shape no fixture holds can still lose a quotation mark.
  Open:
  - `blockStandingOf` throws on 80,000 inline siblings (ledger B486).
  - A logger line,
    `sink verification failed for entry 3`,
    prints from three test files,
    and no test fails (ledger B486).
- **The past-tense rule gets a deterministic aid,
  never a deterministic verdict.**
  Owner,
  2026-10-11:
  "as for tense I suppose some deterministic code can mitigate the problem to some extent."
  Measured over 92 archive pages and 274 settled pages,
  a line-level detector was right about two in three when traits of the person count
  (they do:
  a trait of someone who has died is not still true as the page is read),
  and one in four when only narrated acts count,
  so its hits are shown to judges as labelled candidates on the texts they choose among,
  never used to refuse a wording or to call a text flawed;
  pages that record no death are skipped.
  Decided for quality,
  and confirmed by the owner the same day:
  "Candidates to judges,
  as described".
  The owner's answers later that day,
  each the recommended option:
  every model sees the recorded death date in the identity block
  ("Every model sees it");
  the artifact records the candidates on contest and consolidation slices
  ("Contest and consolidation");
  the subject is the front matter `name` and every declared alias
  ("Name and declared aliases").
  Built as ledger B419.
  The rule has one exception,
  decided by the lead on 2026-10-15 after the read of `TianqiChen66624`:
  words quoted as someone wrote or said them keep the speaker's tense,
  because they are the speaker's own voice and the past belongs to the narration around them.
  A quotation moved into the past is a defect,
  and keeping its present is never a tense inconsistency.
  Every sheet that states the tense rule carries the exception (ledger B627,
  M220).
- **A dictionary entry for 扑面而来.**
  Owner,
  2026-10-11:
  "Add a dictionary entry".
  The entry says the target is whoever faces it and refuses no form,
  since three of the idiom's four occurrences in the corpus wash over the person herself (ledger M148);
  told of the corrected sense,
  the owner kept it so ("Keep the entry as written").
