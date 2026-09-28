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
  A sheet is READ before it is handed to anyone,
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
  so grades are joined back to machine verdicts BY POSITION.
  Seed and corpus pin cannot carry that join alone:
  the draw is deterministic in its seed but not in its POOL,
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
  READ THAT AS HISTORY,
  NOT AS THE PROBE'S BEHAVIOUR.
  Those verdicts were produced under a question that made the pre-edit TRANSLATION the standard of accuracy,
  asking whether the replacement introduced a defect the BEFORE text did not have.
  Read back,
  every claim it produced argued from that text,
  and one reported a corrected mistranslation as damage,
  so the figure measures whether an edit CHANGED anything rather than whether it damaged anything.
  The question is now anchored on the ORIGINAL,
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
  Shadow mode stands until a human grades a sample:
  `#66`.
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
  Owner, 2026-09-27:
  "There is no need to eliminate extra newlines, because markdown doesn't care."
  A run of blank lines where the archive has one,
  or a wording whose edge newlines differ from its archive span's,
  renders as the archive does,
  so no pass, floor or finding acts on it.
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
  Owner, 2026-09-27,
  rejecting a `verify-published` that would refuse a run over a page no artifact records:
  "One of the rules is no matter what, we must ship."
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
  Judged by the build of 2026-09-27, 77 of the 214 stored pages disagree,
  every one written after the publish-time agreement check existed and so agreeing with its own build:
  the would-ship reader applies `restoreTypography` when it reads,
  and two later fixes there (class 181, punctuation inside a closing quote;
  class 147, a nested quotation curled as a pair) account for 69 of them.
  Told this, the owner chose again, the same day,
  that a pass rewrites such pages to the running build's reading:
  a page that does not parse stays as it was and is reported.
  A pass meets an older build's pages only on a resume the operator opted into,
  since the build-generation guard refuses one otherwise.
- **A settled page ships with its defects reported.**
  Owner, 2026-09-27, asked whether the publish-time checks keep refusing a settled entry
  (front matter, sealed English originals, contributor names, link destinations, merged headings,
  and whether the page parses), with the archive's page shipping in its place:
  "Ship with the defect".
  The page ships and each failed check is reported, in the run log and on a line a grep over a pass totals;
  a page that does not parse still refuses, since it would break the site build.
  Measured before the ruling: seven real entries were refused for one dropped link destination each,
  about 10.3 hours of settling discarded (ledger E1).
  The check that a page carries what its artifact says ships joined them by a second answer:
  asked the same day whether a page failing it, which is a defect in the assembly code rather than in the text,
  should still refuse with the archive's page shipping in its place,
  the owner chose "Ship with defect reported".
  It had fired in no real run (the 8 run logs naming it were all test suites).
- **A slice with no valid wording keeps the archive's, and the page ships.**
  Owner, 2026-09-27, asked whether an entry keeps stopping at once
  when no wording for a slice passes the deterministic rule
  (the lanes', the consolidations' and the archive's, or the archive has nothing there),
  given that a stopped entry leaves the archive's whole page live, that slice included:
  "Keep archive, ship".
  The slice keeps exactly what the archive has there, nothing where the archive is silent,
  the page ships with every other repair,
  and the slice is reported on the `DEFECTS` line.
  This replaces the "else fail the slice at once" half of the rule of 2026-09-04;
  its first half stands, so a valid proposal is still preferred wherever one exists.
  Measured before the ruling: 18 real entries stopped on this refusal from 2026-09-04 to 2026-09-27,
  about 34.3 hours in all, most on terminals later rulings already turned into shipping the slate's choice;
  on the build of the ruling, one real stop was of the kind still reachable (yulianNyanner, `incumbent-only`, 0.48 hours).
- **A confirmation sizes its quorum on the seats it could ask and reach.**
  Owner, 2026-09-27, asked whether the bench seats a naturalness confirmation may not ask
  (it asks only its discovery's seats) count as out of reach when its quorum is sized,
  as a seat the router refuses does under the 2026-09-09 short-bench rule:
  "Count as out of reach".
  With nothing refused, or with asked seats able to meet the bench quorum, nothing changes;
  in XingZ624's shape (5 of 8 asked, 2 refused) the confirmation decides on 2 of its 3 reachable voices
  rather than closing `quorum-not-met` (ledger E3).
- **A panel verdict gives its reason before its vote.**
  Owner, 2026-09-27, asked whether each issue-panel verdict carries a reason,
  and if so before or after the vote, told that no panel bench exists
  and that the last panel-sheet change moved support from 72% to 65% on one run per arm:
  "Reason before vote".
  Measured before the ruling over 265 stored artifacts:
  about 783 panel verdicts per entry, and 167 characters on average for the reasons other stages' ballots carry.
  The reason is stored with the ballot and logged beside the issue's decision (ledger E5).
  Its effect on votes is measured at the next run, TianqiChen666,
  as the share of panel ballots voting supported against TianqiChen66620's,
  one run per arm (`doc/status.md`, the 2026-09-27 section).
- **A winning patch sheds the edits a checker voted worse, and the rest is rechecked.**
  Owner, 2026-09-28, asked what happens to edits inside a selected repair patch whose issues the checkers did not confirm
  (345 of 2,148 patches over every run, 18 of 51 on TianqiChen666;
  691 such issues: 651 not fixed, 39 on a fixed and worse tie, 1 on a worse majority):
  "Revert worse-voted, recheck".
  An edit whose issue drew at least one worse ballot is stripped from the patch,
  and the reduced patch faces one more checker round before it ships;
  a not-fixed edit with no worse ballot stays (ledger L3).
  CORRECTED AFTER THE RULING: the question put the stripped share at 40 of the 691 issues,
  counting only the ties and the worse majority;
  at least one worse ballot is 58 issues in 31 patches over every run,
  and 15 issues in 6 of 51 patches on TianqiChen666 (`ride-along-split.mjs`, recounted 2026-09-28).
- **A rewrite after a lost patch is rechecked before it ships.**
  Owner, 2026-09-28, asked what happens when the naturalness stage rewrites the archive
  after the accuracy patch lost, which shipped with no checker round
  (1,218 of 2,144 refined slices over every run; 106 of 125 on TianqiChen666, 75 over accepted issues):
  "Recheck the rewrite".
  The rewrite faces a checker round against the slice's accepted issues and the regression probe,
  and a rewrite the checkers find worse keeps the text before it (ledger L11).
  DECIDED FOR QUALITY, 2026-09-28, under the standing directive below:
  a rewrite the regression probe admits a claim against keeps the text before it too;
  175 of 2,144 kept rewrites carried one, and a graded reading of flagged regions found six of ten true.
- **Inside a licensed quote, an edit keeps the markup atoms its issue does not license it to remove.**
  Owner, 2026-09-28, asked what the editor's preservation gate should protect inside a quote an edit may change,
  where it could never reject anything:
  "Markup atoms".
  Footnote references, link destinations, MDX expressions, inline code and tags survive every edit
  except a removal an addition issue names; prose damage inside the quote stays with the checkers (ledger L4).
  REFINED FOR QUALITY, 2026-09-28, under the standing directive below:
  a replay of the ruling's wording refused 24 recorded edits, 17 of which re-marked markup or moved it rather than lost it.
  Markup the source carries survives; an atom one edit drops and another edit of the same patch writes has survived;
  an MDX expression, inline code or tag the translation authored may be re-marked (same kind, or into markup the source carries)
  but never dropped; a footnote reference or link destination has no such excuse, since a label or address is an identifier
  no checker judges. The addition removal stays the one licensed loss.
- **A reply no one could read is re-asked on another provider, nudged.**
  Owner, 2026-09-28, asked what becomes of the router's cross-provider re-ask,
  which never ran because the prompt-uniqueness wrapper bypasses it:
  "Enable with the nudge".
  The re-ask carries the recovery nudge, so its prompt digest differs from the first ask's
  and prompt uniqueness holds (ledger P9).
  REFINED FOR QUALITY, 2026-09-28, under the standing directive below:
  the re-ask's nudge is worded apart from the stage recovery round's,
  since the round re-asks every seat still unreadable and a shared wording would make its prompt
  this re-ask's digest, answered from the claims with the reply that already failed;
  and a refusal-shaped reply is re-asked elsewhere too, with a nudge neutral on why the reply could not be used.
- **A claim the panel settles at neutral asks for no edit; the sheets define every severity.**
  DECIDED FOR QUALITY, 2026-09-28, under the standing directive below (ledger L5):
  neutral asserts no defect, yet 28 accepted neutral issues shipped an edit, 8 of them claims calling the rendering correct.
  The tally holds such an acceptance for a human; the critic and panel sheets define minor, major and critical after MQM
  and neutral as a finding a human should see that names no defect in the translation;
  the panel votes down a claim naming nothing wrong and lifts a real defect filed neutral to minor.
  This refines the 2026-09-26 ruling "Major+ accuracy" without contradicting it:
  that ruling concerned accuracy claims other than additions, and kept additions disputing "at any severity"
  as the option's wording said; an accepted addition can no longer settle at neutral,
  so in effect an addition disputes the archive from minor up, and one no supporter finds a defect in disputes nothing.
- **The quality of the end result decides; a choice made for it is not a design decision.**
  Owner, 2026-09-28, standing directive, answering two questions put as design choices
  (which fix-shaped refusals the L4 markup gate should let through, and whether the L11 probe stays in shadow):
  "Do not try to save effort and just do the option that would result in best quality of the end result",
  and "I want to make 'prefer quality of the end result' a standing directive
  and decisions that are made for quality and don't conflict with other decisions aren't design decisions."
  A choice whose options differ in the quality of what ships is decided for quality, recorded, and built, never asked;
  effort, code size and wall clock are not reasons to take the lesser option.
  A question goes to the owner only when a quality choice conflicts with an earlier ruling
  or the options differ in something other than quality.
