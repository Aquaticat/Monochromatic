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
  and `OPENROUTER_CHECKER_SUBSTITUTE` (gemma-4-26b-a4b-it,
  disinterested and
  provisional) takes the vacated checker seat so the roster keeps the floor the checker contract holds;
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
