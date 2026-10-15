# Audit ledger

Every finding of the whole-package audit the owner asked for on 2026-09-27
("audit the whole translation-repair pkg for all the mistakes we've made and fix all of them",
"Mistakes made,
ever,
for this pkg,
not just today").
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

## Contents

This record is kept as one file per subject or span,
each of at most 1,000 lines and named for what it holds.
New text goes into the file whose subject it belongs to;
a file that would pass the limit gives up a subject to a new file,
named for that subject and listed here.

- [Audit ledger: glossaries and Canadian forms](audit-ledger-glossaries-and-canadian-forms.md):
  Every glossary entry and Canadian-forms pass measured against the corpus,
  with the mutation check and the re-probe of the glossaries.
- [Audit ledger: rule text, the consolidation gate and the floor replay](audit-ledger-rule-text-gate-and-floor-replay.md):
  Contradictions and gaps in the rule text every sheet carries,
  the consolidation gate finding,
  and the replay of every floor over the archives and settled pages.
- [Audit ledger: history of the numbered defect classes](audit-ledger-defect-class-history.md):
  The defect classes found run by run before the audit,
  classes 1 to 185 and the ones before numbering.
- [Audit ledger: defects in the tests themselves](audit-ledger-test-suite-defects-in-the-tests-themselves.md):
  The test-suite findings T1 to T7 and T9,
  covering an assertion that never runs,
  vacuous checks,
  tests pinning wrong or retired behaviour,
  corpus text and real personal data in fixtures,
  flaky timing,
  names claiming more than they check,
  magic numbers,
  and the log every test run writes into `node_modules/.monochromatic/`.
- [Audit ledger: code no unit test runs, method, first censuses and early batches](audit-ledger-test-suite-unrun-code-method-first-censuses-and-early-batches.md):
  How the coverage of code no unit test runs was first measured on 2026-09-28 and 2026-09-29,
  the rule for when T8 closes and the census task that proves reach,
  the first whole-suite censuses,
  and the first eight batches of cases written against them,
  ending with the page-assembly rounds error that was decided rather than tested.
- [Audit ledger: code no unit test runs, stretch queue batches one to ten](audit-ledger-test-suite-unrun-code-stretch-queue-batches-one-to-ten.md):
  The stretch queue,
  batches one to ten,
  each read against a whole-suite census,
  from the census placement module to the `corpus-run` title modules,
  including the triage of the queue and the finding that the compressed build hid guards.
- [Audit ledger: code no unit test runs, stretch queue batches eleven to sixteen](audit-ledger-test-suite-unrun-code-stretch-queue-batches-eleven-to-sixteen.md):
  The stretch queue,
  batches eleven to sixteen,
  each read against a whole-suite census,
  from the alignment modules to the pairing modules.
- [Audit ledger: code no unit test runs, stretch queue batches seventeen to twenty-four](audit-ledger-test-suite-unrun-code-stretch-queue-batches-seventeen-to-twenty-four.md):
  The stretch queue,
  batches seventeen to twenty-four,
  each read against a whole-suite census,
  from the slice modules to the page modules.
- [Audit ledger: code no unit test runs, agent clusters and bundles before the trial](audit-ledger-test-suite-unrun-code-agent-clusters-and-bundles-before-the-trial.md):
  The clusters of the census cut and given to agents reading one commit,
  what review changed in each patch,
  and the nineteen bundles whose agents stopped at a usage limit,
  up to the hand-over to the trial model.
- [Audit ledger: code no unit test runs, trial model clusters from `group` to `coverage`](audit-ledger-test-suite-unrun-code-trial-clusters-group-through-coverage.md):
  The trial model's first thirteen clusters of the fresh whole-suite census,
  from `group` to `coverage`,
  each of eight to ten stretches.
- [Audit ledger: code no unit test runs, trial model clusters from `markup` to `corpus-run/editor`](audit-ledger-test-suite-unrun-code-trial-clusters-markup-through-editor.md):
  The trial model's clusters fourteen to forty of the fresh whole-suite census,
  from `markup` to `corpus-run/editor`,
  each of five to seven stretches except the last.
- [Audit ledger: code no unit test runs, trial model clusters from `corpus-run/roster` to `corpus-run/publish`](audit-ledger-test-suite-unrun-code-trial-clusters-roster-through-publish.md):
  The trial model's clusters forty-one to sixty-nine of the fresh whole-suite census,
  from `corpus-run/roster` to `corpus-run/publish`,
  each of three or four stretches.
- [Audit ledger: code no unit test runs, re-verification of 2026-10-05](audit-ledger-test-suite-unrun-code-reverification-of-2026-10-05.md):
  The correction of 2026-10-05 of eight groups the trial model had blamed on the census,
  the verified facts about the census tools,
  the method adopted from then on,
  and the re-verification of the sites left open.
- [Audit ledger: code no unit test runs, census at `65bd3a645` and the runner entry files](audit-ledger-test-suite-unrun-code-census-at-65bd3a645-and-runner-entry-files.md):
  The whole-suite census of 2026-10-06 and the library clusters cut from it,
  the quote-loss refusal kept cold on purpose,
  and the runner entry files moved into modules,
  with what stayed open at the close of that passage.
- [Audit ledger: code no unit test runs, final census and what stays cold](audit-ledger-test-suite-unrun-code-final-census-and-what-stays-cold.md):
  The final whole-suite census of 2026-10-10,
  the two clusters cut from it,
  the entry tails round,
  the last census,
  and the stretches that stay cold with the reason for each.
- [Audit ledger: page assembly and the corpus-run driver](audit-ledger-page-assembly-and-corpus-run-driver.md):
  Findings in the page-assembly passes and the driver that runs a corpus pass.
- [Audit ledger: providers, routing and seating](audit-ledger-providers-routing-and-seating.md):
  Findings in the provider clients,
  the router and the seating of models.
- [Audit ledger: the repair lane](audit-ledger-repair-lane.md):
  Findings in the repair lane,
  L1 to L13 and L15.
- [Audit ledger: the repair lane's smaller items](audit-ledger-repair-lane-smaller-items.md):
  The smaller repair-lane findings collected as L14,
  each under its own letter.
- [Audit ledger: docs and comments that disagreed with the code](audit-ledger-docs-against-code.md):
  Statements in the docs,
  comments and examples that the code or the record contradicted.
- [Audit ledger: doc conventions and their guards](audit-ledger-doc-conventions-and-their-guards.md):
  Conventions the docs broke across many files and the guards written for each:
  clock times with no zone,
  task-list numbers,
  the Markdown linter,
  links that lead nowhere,
  and references by position.
- [Audit ledger: found while fixing, stages, seats and pairing keys](audit-ledger-found-while-fixing-stages-seats-and-pairing-keys.md):
  Defects met while fixing another finding,
  in how the stages stop,
  seat and re-seat,
  and in what the slice and pairing keys carry.
- [Audit ledger: found while fixing, tests, source text and live defaults](audit-ledger-found-while-fixing-tests-source-text-and-live-defaults.md):
  Defects met while fixing another finding,
  in the tests and fixtures,
  in what source files say,
  and in parameters that fell back to the live transport or the corpus clone.
- [Audit ledger: found while fixing, names, headings and math on the page](audit-ledger-found-while-fixing-page-names-headings-and-math.md):
  Defects met while fixing another finding,
  in how a page's names,
  HTML headings and math are read.
- [Audit ledger: copies of shared code in production](audit-ledger-copies-in-production-code.md):
  Readers,
  predicates and helpers the production code kept in more than one copy,
  each copy free to drift from the others.
- [Audit ledger: copies of shared code in tests and scans](audit-ledger-copies-in-tests-and-scans.md):
  Helper bodies the test files and the source scans kept in copies,
  and the scans that could not see a copy.
- [Audit ledger: code nothing reaches](audit-ledger-unreferenced-code.md):
  Imports,
  functions,
  values,
  modes and exits that no production path reaches,
  and the checks that did not report them.
- [Audit ledger: comments, TSDoc and source text](audit-ledger-comments-tsdoc-and-source-text.md):
  Defects in what the source says about itself:
  TSDoc that documents nothing or the wrong thing,
  comments citing what does not exist,
  and characters in the source a reader cannot see.
- [Audit ledger: text by code point, and words inside words](audit-ledger-code-points-and-word-boundaries.md):
  Text read by UTF-16 unit or ordered by locale where code points were meant,
  and fixed words found inside longer words.
- [Audit ledger: folds and quote forms](audit-ledger-folds-and-quote-forms.md):
  Comparisons that used the wrong fold for their question:
  straight against curly quotes,
  layout-only differences,
  case folds,
  and answers checked before they were folded.
- [Audit ledger: text that shows nothing](audit-ledger-text-that-shows-nothing.md):
  Text a reader sees as blank that passed for wording,
  because the check asked `trim()` or asked nothing.
- [Audit ledger: defaults that stand in for an input](audit-ledger-defaults-standing-in-for-an-input.md):
  Places where a missing,
  malformed or unreadable input was replaced by a default,
  and the run went on as though the input had said so.
- [Audit ledger: labels and counts in messages](audit-ledger-labels-and-counts-in-messages.md):
  Messages that named the wrong thing or stated a count wrongly:
  labels that did not fit,
  counts before a fixed plural,
  and one field carrying two kinds of text.
- [Audit ledger: values read back from text](audit-ledger-values-read-back-from-text.md):
  Numbers,
  fields and keys the code wrote into text and then read back more leniently,
  or by a rule the writer does not keep.
- [Audit ledger: runner reports and probes](audit-ledger-runner-reports-and-probes.md):
  Report and probe commands that printed a claim their own figures deny,
  or bought work nothing could use.
- [Audit ledger: footnote markers and link destinations](audit-ledger-footnote-markers-and-link-destinations.md):
  Scans for footnote markers and link destinations that disagreed with the parse,
  about where a marker is a reference or where an address ends.
- [Audit ledger: tags, nesting and paired marks](audit-ledger-tags-nesting-and-marks.md):
  Readers of tags,
  attributes,
  paired marks,
  front matter and nesting depth,
  each reading the structure its own way.
- [Audit ledger: outcome rules and stage records](audit-ledger-outcome-rules-and-stage-records.md):
  Rules that decide what a slice ships and what a stage records:
  exits an outcome rule could not reach,
  records that dropped a round,
  and work no floor could check.
- [Audit ledger: composed operations and checks on a part](audit-ledger-composed-operations-and-partial-checks.md):
  One refusal inside a composed operation that stopped the whole,
  or left no finding,
  and checks that vouched for a whole text on one part of it.
- [Audit ledger: test cases that cannot fail](audit-ledger-test-cases-that-cannot-fail.md):
  Cases and guards that would pass with the behaviour they name removed.
- [Audit ledger: files a later run reads back](audit-ledger-files-a-later-run-reads-back.md):
  Caches,
  ledgers,
  locks and stored stage results that a later run read back,
  torn,
  stale or holding what no writer writes.
- [Audit ledger: tests touching the real world](audit-ledger-tests-touching-the-real-world.md):
  Tests that reached the real corpus,
  real keys,
  the file system,
  child processes or process globals.
- [Audit ledger: clocks and durations](audit-ledger-clocks-and-durations.md):
  Durations measured on the system clock,
  and test bounds on the real clock a loaded machine could outrun.
- [Audit ledger: output decided by arrival order](audit-ledger-output-decided-by-arrival-order.md):
  Findings,
  refusals and log lines whose content or order depended on which concurrent work ended first,
  and the scan that looks for it.
- [Audit ledger: failures under a caller's stop](audit-ledger-failures-under-a-callers-stop.md):
  Fan-outs that dropped,
  mislabelled or doubled a member's own failure once the caller had stopped the work.
- [Audit ledger: loops that copy what they built](audit-ledger-loops-that-copy-what-they-built.md):
  Folds,
  maps and scans that copied or re-read everything built so far at every step.
- [Audit ledger: building the tense check](audit-ledger-tense-check.md):
  The record of building the tense candidates:
  what the review of the tense records and sheets found loose,
  and what was fixed.
- [Audit ledger: building the consistency pass, repeat groups and the carry](audit-ledger-consistency-pass-repeat-groups-and-the-carry.md):
  The record of building the page-level consistency pass up to the independent review of its rebuild:
  how the repeated wording is located,
  how the bench chooses and the pass carries the choice to every place,
  and what the first reviews found.
- [Audit ledger: the consistency pass, the span and the marks beside it](audit-ledger-consistency-pass-span-and-marks-beside-it.md):
  The fourth and fifth independent reviews of the pass:
  what the located span covers,
  which single marks beside it travel with it or refuse a splice,
  and the joint rules that keep a stand from sitting inside a word.
- [Audit ledger: the consistency pass, apostrophes and block floors](audit-ledger-consistency-pass-apostrophes-and-block-floors.md):
  The sixth independent review and the apostrophe round that followed it:
  which apostrophes are attached to a word,
  the apostrophes that need no guess and travel with their word,
  and the blocks a splice carries in part.
- [Audit ledger: the consistency pass, the page-wide proof, forms, floors and limits](audit-ledger-consistency-pass-page-wide-proof-forms-floors-and-limits.md):
  The seventh independent review and the fixes that answered it:
  the proof that an edge mark is an apostrophe,
  read over the whole page,
  the joints after closing marks,
  the form of an arriving apostrophe,
  the floors that keep a writer from changing words that must stay,
  and the limits the lead accepted.
- [Audit ledger: the consistency pass, stack depth, the floors fixed point and the page form](audit-ledger-consistency-pass-stack-depth-floors-fixed-point-and-page-form.md):
  The rounds that built the whole-page reading:
  the parser's refusal at the edge of the stack,
  the floors and the gain check settled together,
  and the page that an arriving apostrophe takes its form from.
- [Audit ledger: the consistency pass, one reading of every mark](audit-ledger-consistency-pass-one-reading-of-every-mark.md):
  The independent grid check and the eighth review's findings that the first fix round closed:
  one meaning for a mark in the counter,
  the locator,
  the proof and the readers of form and of marks inside words,
  and the two limits that round left accepted.
- [Audit ledger: the consistency pass, the fixes of the eighth review and the oracle residue](audit-ledger-consistency-pass-fixes-of-the-eighth-review-and-the-oracle-residue.md):
  The findings of the eighth review that the second fix round took in hand,
  the flags of the first that the lead decided to fix after the merge,
  and the residue of the oracle's rerun that the next round fixed,
  each with the outcome of its fix.
- [Audit ledger: the consistency pass, parse boundaries, the letter test and the proof's page](audit-ledger-consistency-pass-parse-boundaries-letter-test-and-proof-page.md):
  The defects of the second fix round and the rounds after it:
  the stack exhaustion read as a refusal wherever it came from,
  the letter test widened for every caller,
  the reason a left-out gain states,
  and the proof's page that was a reconstruction.
- [Audit ledger: the consistency pass, the ninth review](audit-ledger-consistency-pass-ninth-review.md):
  The ninth independent review and its fixes:
  the glyphs that ship,
  the stack edge,
  the largest set of re-admitted gains,
  the double marks `„` and `‟`,
  the mark after closing emphasis,
  the cost,
  and the comments.
- [Audit ledger: the consistency pass, the independent oracle and the rules for marks](audit-ledger-consistency-pass-independent-oracle-and-mark-rules.md):
  What an oracle written from the rule text found after the fixes,
  the nine rules for marks the lead decided in answer,
  and the limits accepted with them.
- [Audit ledger: the consistency pass, the tenth review](audit-ledger-consistency-pass-tenth-review.md):
  The tenth independent review and the fixes that answered it:
  the gain blocked by a mark that reads free,
  the second mark carried past a footnote reference,
  a tag,
  a link or a space,
  the readers that knew four marks and eight,
  and the leading elisions.
- [Audit ledger: the consistency pass, the re-review and the refusal run](audit-ledger-consistency-pass-re-review-and-the-refusal-run.md):
  The independent re-review of those fixes and the round that answered it:
  the refusal run stated by what renders between two marks,
  with references,
  escapes,
  spaces and line breaks,
  the elisions that open a quotation,
  the limits accepted,
  and the container markers still to build.
- [Audit ledger: what each sheet shows](audit-ledger-what-each-sheet-shows.md):
  Sheets that lacked a block their role needs to judge or write.
- [Audit ledger: readers that accept what no writer writes](audit-ledger-readers-accept-shapes-writers-never-write.md):
  Readers of stored records and directories that accepted a shape,
  a name or a value their own writer never produces.
- [Audit ledger: references to titles](audit-ledger-title-references.md):
  How a title named in running text is recognized,
  glossed and rewritten.
- [Audit ledger: lists that must name every member of a type](audit-ledger-lists-that-must-name-every-member-of-a-type.md):
  Lists and switches meant to cover every member of a type that could silently miss one.
- [Audit ledger: block pairings that do not fit their text](audit-ledger-block-pairings-that-do-not-fit-their-text.md):
  Pairings of source and target blocks that a later step applied to text they did not fit.
- [Audit ledger: the environment handed to child processes](audit-ledger-child-process-environment.md):
  What a child process inherits:
  keys,
  settings and git's own variables,
  in production code and in tests.
- [Audit ledger: credentials masked at the transport](audit-ledger-credentials-masked-at-the-transport.md):
  Credential spellings that could reach a log line,
  a refusal or a listing unmasked.
- [Audit ledger: provider streams, usage counts and retries](audit-ledger-provider-streams-usage-and-retries.md):
  Provider fields read otherwise than the provider documents them:
  stream events,
  usage counts,
  and the refusals a retry decision reads.
- [Audit ledger: branches no input reaches, kept as quiet answers](audit-ledger-unreachable-branches-kept-as-quiet-answers.md):
  Branches no input reaches that answered quietly where a loud refusal belongs,
  most met when a coverage census asked for them to be removed.
- [Audit ledger: the source scans and the coverage census](audit-ledger-source-scans-and-coverage-census.md):
  What the source scans and the coverage census counted wrongly,
  could not see,
  or printed too little of when they failed,
  and modules tested only through their callers.
- [Audit ledger: ambient state touched by library code](audit-ledger-ambient-state-touched-by-library-code.md):
  Library code that read or wrote the process environment,
  the exit code or a module-load default,
  where a caller could not supply or see it.
- [Audit ledger: work merged from parallel briefs](audit-ledger-work-merged-from-parallel-briefs.md):
  What went wrong when two pieces of work written apart met in the same files.
- [Audit ledger: which seats a quorum counts](audit-ledger-which-seats-a-quorum-counts.md):
  Quorums that counted seats which never answered,
  could not answer,
  or were withheld.
- [Audit ledger: blocks and quotes read off the parse](audit-ledger-blocks-and-quotes-read-off-the-parse.md):
  Blocks,
  quotes and code spans counted by a blank-line split or a scan of their own,
  where the parse was meant.
- [Audit ledger: positions compared across texts](audit-ledger-positions-compared-across-texts.md):
  Offsets,
  headings and slices of one text applied to another that does not line up with it,
  a leading byte order mark among the causes.
- [Audit ledger: repeated wording and ids on a page](audit-ledger-repeated-wording-and-ids-within-one-text.md):
  Titles,
  links,
  ids and wordings that stand more than once on a page,
  settled by their first or last occurrence without saying so.
- [Audit ledger: repeated keys in stored records and rows](audit-ledger-repeated-keys-in-stored-records-and-rows.md):
  Stored records,
  rosters,
  ledger rows and log lines that name one key more than once,
  read by the first or the last without saying so.
- [Audit ledger: command lines read by each runner](audit-ledger-command-lines-read-by-each-runner.md):
  How the runners read their command lines,
  and ids a line names that its runner cannot reach.
- [Audit ledger: operator refusals printed as faults](audit-ledger-operator-refusals-printed-as-faults.md):
  Refusals of an operator's own mistake that printed as faults of the command,
  and refusals that came after work an operator could not be told about.
- [Audit ledger: caught text carried into messages](audit-ledger-caught-text-carried-into-messages.md):
  Refusals,
  log lines and stored details that carried a caught error's own text,
  which can quote a provider body or a document.
- [Audit ledger: refusals that name too little](audit-ledger-refusals-that-name-too-little.md):
  Refusals and failure lines that named too little to act on,
  or named the wrong cause.
- [Audit ledger: process mistakes, shell commands and tasks](audit-ledger-process-shell-commands-and-tasks.md):
  Slips against the repository's shell and task rules:
  chained commands,
  commands batched with the write they read,
  tasks run from the wrong place,
  and scratch output without bound.
- [Audit ledger: process mistakes, launch checks and cache versions](audit-ledger-process-launch-checks-and-cache-versions.md):
  What went unchecked before a run launched:
  the full suite,
  the lint,
  the cache versions,
  the handover,
  and the log's two streams.
- [Audit ledger: process mistakes, guards and red cases](audit-ledger-process-guards-and-red-cases.md):
  Guards and failing-first cases that could not fail,
  never reached what they guarded,
  or were removed to please a census.
- [Audit ledger: process mistakes, searches and censuses](audit-ledger-process-searches-and-censuses.md):
  Searches and censuses that missed what they looked for,
  or were read as complete when they were not.
- [Audit ledger: process mistakes, claims and commit messages](audit-ledger-process-claims-and-commit-messages.md):
  Claims written without their evidence,
  in commit messages,
  the ledger and notes.
- [Audit ledger: process mistakes, lint, edits and tests](audit-ledger-process-lint-edits-and-tests.md):
  Slips in editing and checking code:
  lint left unread,
  edits aimed by a stale line number,
  tests that touched the real world,
  and seams added the wrong way.
- [Audit ledger: process mistakes, questions and handoffs to the owner](audit-ledger-process-questions-to-the-owner.md):
  What was put to the owner wrongly:
  measurable questions,
  options the evidence contradicts,
  and requests the owner had ruled out.
- [Audit ledger: process mistakes, agents and briefs](audit-ledger-process-agents-and-briefs.md):
  What went wrong in delegating work:
  briefs that left something out,
  agents that broke their rules,
  and work merged from parallel briefs.
- [Audit ledger: process mistakes, agents and briefs in the consistency fix rounds](audit-ledger-process-agents-and-briefs-consistency-fix-rounds.md):
  The same,
  for the rounds that fixed the eighth,
  ninth and tenth reviews of the consistency pass and the re-review:
  the rule breaches of each round,
  and the six mistakes of the lead's briefs and rulings in them.
- [Audit ledger: process mistakes, the lead's slips by batch of work](audit-ledger-process-the-leads-slips-by-batch.md):
  The lead's own slips as they were collected at the close of each batch of work.
- [Audit ledger: process mistakes, checks run before a commit](audit-ledger-process-commit-gates.md):
  Commits made without the suite,
  the lint,
  the scans or the type check that would have refused them.
- [Audit ledger: process mistakes, stopping and waiting](audit-ledger-process-stopping-and-waiting.md):
  Turns that ended with work still listed,
  and waits spent polling.
- [Audit ledger: process mistakes, docs that grow or go stale](audit-ledger-process-docs-that-grow-or-go-stale.md):
  Docs left stale after the state they describe moved,
  docs that grew past reading,
  and the first split of them,
  cut by size and named by number.
- [Audit ledger: where each numbered entry is filed](audit-ledger-entries-by-id.md):
  Every numbered entry of the recurring code families,
  the process mistakes and the other numbered findings,
  by id,
  with the file that holds it.

## Runs

TianqiChen66620 (`.frozen-dist-2f26f440d`) was stopped by this session at 17 min,
on the owner's 2026-09-27 instruction to launch only once no further fix is due;
slice 9 was not reached.

## Test suite

Probes:
`~/temp/agent/audit-tests/`
(a runtime harness logging every `expect` that runs,
`scan-corpus.mjs` and `classify-hits.mjs` for corpus text,
`run-container.mjs` for load runs,
`magic-*.tsv`,
`untested-dist-functions.tsv`,
`coverage-holes.txt`).

Filed in:

- [Audit ledger: defects in the tests themselves](audit-ledger-test-suite-defects-in-the-tests-themselves.md)
- [Audit ledger: code no unit test runs, method, first censuses and early batches](audit-ledger-test-suite-unrun-code-method-first-censuses-and-early-batches.md)
- [Audit ledger: code no unit test runs, stretch queue batches one to ten](audit-ledger-test-suite-unrun-code-stretch-queue-batches-one-to-ten.md)
- [Audit ledger: code no unit test runs, stretch queue batches eleven to sixteen](audit-ledger-test-suite-unrun-code-stretch-queue-batches-eleven-to-sixteen.md)
- [Audit ledger: code no unit test runs, stretch queue batches seventeen to twenty-four](audit-ledger-test-suite-unrun-code-stretch-queue-batches-seventeen-to-twenty-four.md)
- [Audit ledger: code no unit test runs, agent clusters and bundles before the trial](audit-ledger-test-suite-unrun-code-agent-clusters-and-bundles-before-the-trial.md)
- [Audit ledger: code no unit test runs, trial model clusters from `group` to `coverage`](audit-ledger-test-suite-unrun-code-trial-clusters-group-through-coverage.md)
- [Audit ledger: code no unit test runs, trial model clusters from `markup` to `corpus-run/editor`](audit-ledger-test-suite-unrun-code-trial-clusters-markup-through-editor.md)
- [Audit ledger: code no unit test runs, trial model clusters from `corpus-run/roster` to `corpus-run/publish`](audit-ledger-test-suite-unrun-code-trial-clusters-roster-through-publish.md)
- [Audit ledger: code no unit test runs, re-verification of 2026-10-05](audit-ledger-test-suite-unrun-code-reverification-of-2026-10-05.md)
- [Audit ledger: code no unit test runs, census at `65bd3a645` and the runner entry files](audit-ledger-test-suite-unrun-code-census-at-65bd3a645-and-runner-entry-files.md)
- [Audit ledger: code no unit test runs, final census and what stays cold](audit-ledger-test-suite-unrun-code-final-census-and-what-stays-cold.md)

### T8: code no unit test runs

Status:
open,
and the next launch waits for it:
under the owner's standing directive of 2026-09-28 to prefer the quality of the end result,
the launch follows the tests this entry asks for,
and the owner may veto that order and launch first.
Remeasured 2026-09-29 by block coverage mapped to source lines,
which supersedes the 2026-09-28 figures;
first recounted 2026-09-27 at 79 of 1,178 barrel-exported functions
(`~/temp/agent/audit-repair/untested-exports.mjs`,
list in `untested-exports.json`),
queued after the findings that change a run's output.
76 public functions named by no test;
a coverage sample shows `isPaymentRefusal`,
`statedWaitMsOf`,
`routedJson`,
`secondOpinionsFrom` and others never called,
and the decision reply's refusal branches never exercised.
Recounted 2026-09-28 with the same script:
94 of 1,248,
the barrels having grown;
`reseatHookFor` (X12) is among them though every hook builder's test runs it.
The count has two blind spots,
so it is neither a floor nor a ceiling of untested code:
it reads `export function` declarations only (never `export const`),
and it counts a name mentioned anywhere in a test as tested,
while a function called only through another is uncounted.
The work waits on a measurement of execution rather than names:
the unit suite under `NODE_V8_COVERAGE`,
with function entries that never ran intersected with the barrel exports,
then a case per branch of each function on that list (TCV).

Filed in:

- [Audit ledger: code no unit test runs, method, first censuses and early batches](audit-ledger-test-suite-unrun-code-method-first-censuses-and-early-batches.md)
- [Audit ledger: code no unit test runs, stretch queue batches one to ten](audit-ledger-test-suite-unrun-code-stretch-queue-batches-one-to-ten.md)
- [Audit ledger: code no unit test runs, stretch queue batches eleven to sixteen](audit-ledger-test-suite-unrun-code-stretch-queue-batches-eleven-to-sixteen.md)
- [Audit ledger: code no unit test runs, stretch queue batches seventeen to twenty-four](audit-ledger-test-suite-unrun-code-stretch-queue-batches-seventeen-to-twenty-four.md)
- [Audit ledger: code no unit test runs, agent clusters and bundles before the trial](audit-ledger-test-suite-unrun-code-agent-clusters-and-bundles-before-the-trial.md)
- [Audit ledger: code no unit test runs, trial model clusters from `group` to `coverage`](audit-ledger-test-suite-unrun-code-trial-clusters-group-through-coverage.md)
- [Audit ledger: code no unit test runs, trial model clusters from `markup` to `corpus-run/editor`](audit-ledger-test-suite-unrun-code-trial-clusters-markup-through-editor.md)
- [Audit ledger: code no unit test runs, trial model clusters from `corpus-run/roster` to `corpus-run/publish`](audit-ledger-test-suite-unrun-code-trial-clusters-roster-through-publish.md)
- [Audit ledger: code no unit test runs, re-verification of 2026-10-05](audit-ledger-test-suite-unrun-code-reverification-of-2026-10-05.md)
- [Audit ledger: code no unit test runs, census at `65bd3a645` and the runner entry files](audit-ledger-test-suite-unrun-code-census-at-65bd3a645-and-runner-entry-files.md)
- [Audit ledger: code no unit test runs, final census and what stays cold](audit-ledger-test-suite-unrun-code-final-census-and-what-stays-cold.md)

## Repair lane

Probes and notes:
`~/temp/agent/audit-repair/notes.md`
(`seat-probe.mjs`,
`regress-check.mjs`,
`dispute-standin.mjs`,
`ride-along.mjs`,
`preservation-vacuous.mjs`).

Filed in:

- [Audit ledger: the repair lane](audit-ledger-repair-lane.md)
- [Audit ledger: the repair lane's smaller items](audit-ledger-repair-lane-smaller-items.md)

## Docs and comments against code

Probe scripts:
`~/temp/agent/audit-docs2/`
(`backticks.mjs`,
`repo-wide.mjs`,
`examples.mjs`,
`owner-quotes.mjs`,
`hygiene.mjs`,
`class-dates.mjs`,
`pairing.mjs`).
Roster values were computed from `src/corpus-run/run-config.ts` itself:
`RUN_ROSTER` 9 seats,
`RUN_READER_MODELS` 6,
7 wide seats,
8 late judges.
Paths in this section are package-relative.

Filed in:

- [Audit ledger: docs and comments that disagreed with the code](audit-ledger-docs-against-code.md)
- [Audit ledger: doc conventions and their guards](audit-ledger-doc-conventions-and-their-guards.md)

## Found while fixing

Filed in:

- [Audit ledger: found while fixing, stages, seats and pairing keys](audit-ledger-found-while-fixing-stages-seats-and-pairing-keys.md)
- [Audit ledger: found while fixing, tests, source text and live defaults](audit-ledger-found-while-fixing-tests-source-text-and-live-defaults.md)
- [Audit ledger: found while fixing, names, headings and math on the page](audit-ledger-found-while-fixing-page-names-headings-and-math.md)

## Recurring code families

Audit area six:
code kept in more than one place,
which can drift until two parts of the pipeline
read one page two ways.
`~/temp/agent/audit-glossary-fix/duplicate-bodies.mjs` parses every non-test source file with rolldown's parser
and groups function bodies with comments and whitespace removed;
on 2026-09-28 it found 31 groups of 80 normalized characters or more spanning two or more files.
`duplicate-triage.mjs` and `duplicate-texts.mjs` print each copy's full text and the module-level names it reads,
so a copy whose body matches but whose constants differ shows up as such.

The rule applied to each group:
merge when both copies are live code that must agree;
keep a copy that is an artifact generation's frozen rule,
which the reader recomputes and refuses to disagree with,
and say so where it stands.
`artifact-two-lane-comparison.ts` states this for the lane verdict (`judgeTwoLaneSlice` beside `judgeSlice`).
A reader of one artifact version never imports from a live stage;
two readers of the same version may share.

Filed in:

- [Audit ledger: copies of shared code in production](audit-ledger-copies-in-production-code.md)
- [Audit ledger: code nothing reaches](audit-ledger-unreferenced-code.md)
- [Audit ledger: comments, TSDoc and source text](audit-ledger-comments-tsdoc-and-source-text.md)
- [Audit ledger: text by code point, and words inside words](audit-ledger-code-points-and-word-boundaries.md)
- [Audit ledger: folds and quote forms](audit-ledger-folds-and-quote-forms.md)
- [Audit ledger: composed operations and checks on a part](audit-ledger-composed-operations-and-partial-checks.md)
- [Audit ledger: which seats a quorum counts](audit-ledger-which-seats-a-quorum-counts.md)
- [Audit ledger: what each sheet shows](audit-ledger-what-each-sheet-shows.md)
- [Audit ledger: defaults that stand in for an input](audit-ledger-defaults-standing-in-for-an-input.md)
- [Audit ledger: test cases that cannot fail](audit-ledger-test-cases-that-cannot-fail.md)
- [Audit ledger: caught text carried into messages](audit-ledger-caught-text-carried-into-messages.md)
- [Audit ledger: values read back from text](audit-ledger-values-read-back-from-text.md)
- [Audit ledger: labels and counts in messages](audit-ledger-labels-and-counts-in-messages.md)
- [Audit ledger: tags, nesting and paired marks](audit-ledger-tags-nesting-and-marks.md)
- [Audit ledger: outcome rules and stage records](audit-ledger-outcome-rules-and-stage-records.md)
- [Audit ledger: text that shows nothing](audit-ledger-text-that-shows-nothing.md)
- [Audit ledger: blocks and quotes read off the parse](audit-ledger-blocks-and-quotes-read-off-the-parse.md)
- [Audit ledger: references to titles](audit-ledger-title-references.md)
- [Audit ledger: the source scans and the coverage census](audit-ledger-source-scans-and-coverage-census.md)
- [Audit ledger: readers that accept what no writer writes](audit-ledger-readers-accept-shapes-writers-never-write.md)
- [Audit ledger: refusals that name too little](audit-ledger-refusals-that-name-too-little.md)
- [Audit ledger: loops that copy what they built](audit-ledger-loops-that-copy-what-they-built.md)
- [Audit ledger: command lines read by each runner](audit-ledger-command-lines-read-by-each-runner.md)
- [Audit ledger: clocks and durations](audit-ledger-clocks-and-durations.md)
- [Audit ledger: tests touching the real world](audit-ledger-tests-touching-the-real-world.md)
- [Audit ledger: positions compared across texts](audit-ledger-positions-compared-across-texts.md)
- [Audit ledger: provider streams, usage counts and retries](audit-ledger-provider-streams-usage-and-retries.md)
- [Audit ledger: copies of shared code in tests and scans](audit-ledger-copies-in-tests-and-scans.md)
- [Audit ledger: files a later run reads back](audit-ledger-files-a-later-run-reads-back.md)
- [Audit ledger: footnote markers and link destinations](audit-ledger-footnote-markers-and-link-destinations.md)
- [Audit ledger: repeated wording and ids on a page](audit-ledger-repeated-wording-and-ids-within-one-text.md)
- [Audit ledger: block pairings that do not fit their text](audit-ledger-block-pairings-that-do-not-fit-their-text.md)
- [Audit ledger: branches no input reaches, kept as quiet answers](audit-ledger-unreachable-branches-kept-as-quiet-answers.md)
- [Audit ledger: lists that must name every member of a type](audit-ledger-lists-that-must-name-every-member-of-a-type.md)
- [Audit ledger: repeated keys in stored records and rows](audit-ledger-repeated-keys-in-stored-records-and-rows.md)
- [Audit ledger: operator refusals printed as faults](audit-ledger-operator-refusals-printed-as-faults.md)
- [Audit ledger: output decided by arrival order](audit-ledger-output-decided-by-arrival-order.md)
- [Audit ledger: credentials masked at the transport](audit-ledger-credentials-masked-at-the-transport.md)
- [Audit ledger: runner reports and probes](audit-ledger-runner-reports-and-probes.md)
- [Audit ledger: the environment handed to child processes](audit-ledger-child-process-environment.md)
- [Audit ledger: failures under a caller's stop](audit-ledger-failures-under-a-callers-stop.md)
- [Audit ledger: work merged from parallel briefs](audit-ledger-work-merged-from-parallel-briefs.md)
- [Audit ledger: ambient state touched by library code](audit-ledger-ambient-state-touched-by-library-code.md)
- [Audit ledger: building the tense check](audit-ledger-tense-check.md)
- [Audit ledger: building the consistency pass, repeat groups and the carry](audit-ledger-consistency-pass-repeat-groups-and-the-carry.md)
- [Audit ledger: the consistency pass, the span and the marks beside it](audit-ledger-consistency-pass-span-and-marks-beside-it.md)
- [Audit ledger: the consistency pass, apostrophes and block floors](audit-ledger-consistency-pass-apostrophes-and-block-floors.md)
- [Audit ledger: the consistency pass, the page-wide proof, forms, floors and limits](audit-ledger-consistency-pass-page-wide-proof-forms-floors-and-limits.md)
- [Audit ledger: the consistency pass, stack depth, the floors fixed point and the page form](audit-ledger-consistency-pass-stack-depth-floors-fixed-point-and-page-form.md)
- [Audit ledger: the consistency pass, one reading of every mark](audit-ledger-consistency-pass-one-reading-of-every-mark.md)
- [Audit ledger: the consistency pass, the fixes of the eighth review and the oracle residue](audit-ledger-consistency-pass-fixes-of-the-eighth-review-and-the-oracle-residue.md)
- [Audit ledger: the consistency pass, parse boundaries, the letter test and the proof's page](audit-ledger-consistency-pass-parse-boundaries-letter-test-and-proof-page.md)
- [Audit ledger: the consistency pass, the ninth review](audit-ledger-consistency-pass-ninth-review.md)
- [Audit ledger: the consistency pass, the independent oracle and the rules for marks](audit-ledger-consistency-pass-independent-oracle-and-mark-rules.md)
- [Audit ledger: the consistency pass, the tenth review](audit-ledger-consistency-pass-tenth-review.md)
- [Audit ledger: the consistency pass, the re-review and the refusal run](audit-ledger-consistency-pass-re-review-and-the-refusal-run.md)

## Process mistakes in this audit

These are the agent's own mistakes while fixing,
recorded for the prevention doc.

Filed in:

- [Audit ledger: process mistakes, shell commands and tasks](audit-ledger-process-shell-commands-and-tasks.md)
- [Audit ledger: process mistakes, launch checks and cache versions](audit-ledger-process-launch-checks-and-cache-versions.md)
- [Audit ledger: process mistakes, docs that grow or go stale](audit-ledger-process-docs-that-grow-or-go-stale.md)
- [Audit ledger: process mistakes, guards and red cases](audit-ledger-process-guards-and-red-cases.md)
- [Audit ledger: process mistakes, claims and commit messages](audit-ledger-process-claims-and-commit-messages.md)
- [Audit ledger: process mistakes, checks run before a commit](audit-ledger-process-commit-gates.md)
- [Audit ledger: process mistakes, searches and censuses](audit-ledger-process-searches-and-censuses.md)
- [Audit ledger: process mistakes, lint, edits and tests](audit-ledger-process-lint-edits-and-tests.md)
- [Audit ledger: process mistakes, stopping and waiting](audit-ledger-process-stopping-and-waiting.md)
- [Audit ledger: process mistakes, agents and briefs](audit-ledger-process-agents-and-briefs.md)
- [Audit ledger: process mistakes, agents and briefs in the consistency fix rounds](audit-ledger-process-agents-and-briefs-consistency-fix-rounds.md)
- [Audit ledger: process mistakes, the lead's slips by batch of work](audit-ledger-process-the-leads-slips-by-batch.md)
- [Audit ledger: work merged from parallel briefs](audit-ledger-work-merged-from-parallel-briefs.md)
- [Audit ledger: process mistakes, questions and handoffs to the owner](audit-ledger-process-questions-to-the-owner.md)
