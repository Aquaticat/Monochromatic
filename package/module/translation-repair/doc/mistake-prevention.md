# Preventing this package's mistakes

The audit of 2026-09-27 and 2026-09-28 recorded every mistake made while fixing this package
as an M entry in [the audit ledger](audit-ledger.md#process-mistakes-in-this-audit),
and every defect found while fixing as an X entry.
The ledger is the record,
in the order things happened.
This page is the same knowledge grouped by family:
for each family,
what went wrong,
the one rule that prevents it,
and what enforces the rule.
Where a test or the type checker enforces it,
that is named;
where only a habit does,
the habit is named as such.

Read the checklist before any run launches,
and the family that matches what you are about to do before you do it.

## Contents

This record is kept as one file per subject or span,
each of at most 1,000 lines and named for what it holds.
New text goes into the file whose subject it belongs to;
a file that would pass the limit gives up a subject to a new file,
named for that subject and listed here.

- [Preventing mistakes: shell commands, edits, commits and agents](mistake-prevention-shell-edits-commits-and-agents.md):
  Rules for how the work is carried out:
  shell commands and tasks,
  lint and edits,
  commit messages,
  questions to the owner,
  and work handed to agents.
  Sections:
  - [Shell commands](mistake-prevention-shell-edits-commits-and-agents.md#shell-commands)
  - [Tasks, builds and bulk output](mistake-prevention-shell-edits-commits-and-agents.md#tasks-builds-and-bulk-output)
  - [Lint and edits](mistake-prevention-shell-edits-commits-and-agents.md#lint-and-edits)
  - [Commit messages](mistake-prevention-shell-edits-commits-and-agents.md#commit-messages)
  - [Questions to the owner](mistake-prevention-shell-edits-commits-and-agents.md#questions-to-the-owner)
  - [Work merged from parallel briefs](mistake-prevention-shell-edits-commits-and-agents.md#work-merged-from-parallel-briefs)
  - [How an agent waits](mistake-prevention-shell-edits-commits-and-agents.md#how-an-agent-waits)
- [Preventing mistakes: guards, searches and claims](mistake-prevention-guards-searches-and-claims.md):
  Rules for evidence:
  guards that must be able to fail,
  searches and censuses that must reach what they look for,
  and claims that carry their backing.
  Sections:
  - [Guards that cannot fail](mistake-prevention-guards-searches-and-claims.md#guards-that-cannot-fail)
  - [Searches and censuses that miss](mistake-prevention-guards-searches-and-claims.md#searches-and-censuses-that-miss)
  - [Claims without their evidence](mistake-prevention-guards-searches-and-claims.md#claims-without-their-evidence)
  - [Guards a census wants gone](mistake-prevention-guards-searches-and-claims.md#guards-a-census-wants-gone)
  - [Modules without a test of their own](mistake-prevention-guards-searches-and-claims.md#modules-without-a-test-of-their-own)
  - [Lists that must name every member of a type](mistake-prevention-guards-searches-and-claims.md#lists-that-must-name-every-member-of-a-type)
  - [What a failing check prints](mistake-prevention-guards-searches-and-claims.md#what-a-failing-check-prints)
- [Preventing mistakes: docs and references](mistake-prevention-docs-and-references.md):
  Rules for the docs themselves:
  current-state docs,
  references in code and docs,
  dates and clock times,
  and how long a doc may grow.
  Sections:
  - [Current-state docs](mistake-prevention-docs-and-references.md#current-state-docs)
  - [References in code and docs](mistake-prevention-docs-and-references.md#references-in-code-and-docs)
  - [Dates and clock times](mistake-prevention-docs-and-references.md#dates-and-clock-times)
  - [Docs that only grow](mistake-prevention-docs-and-references.md#docs-that-only-grow)
- [Preventing mistakes: the real world, clocks and arrival order](mistake-prevention-tests-clocks-and-arrival-order.md):
  Rules for tests and code that meet the world outside them:
  real files,
  keys and processes,
  the clock,
  process globals,
  and the order concurrent work ends in.
  Sections:
  - [Tests touching the real world](mistake-prevention-tests-clocks-and-arrival-order.md#tests-touching-the-real-world)
  - [Tests on the real clock](mistake-prevention-tests-clocks-and-arrival-order.md#tests-on-the-real-clock)
  - [Durations on the system clock](mistake-prevention-tests-clocks-and-arrival-order.md#durations-on-the-system-clock)
  - [Globals a case replaces](mistake-prevention-tests-clocks-and-arrival-order.md#globals-a-case-replaces)
  - [Output decided by arrival order](mistake-prevention-tests-clocks-and-arrival-order.md#output-decided-by-arrival-order)
- [Preventing mistakes: comparing text and reading structure](mistake-prevention-text-comparison-and-structure.md):
  Rules for comparing text and reading a document's structure:
  code points,
  word boundaries,
  folds,
  blank text,
  escapes,
  paired marks,
  the parse,
  positions and quotes.
  Sections:
  - [Text by code point](mistake-prevention-text-comparison-and-structure.md#text-by-code-point)
  - [Words inside words](mistake-prevention-text-comparison-and-structure.md#words-inside-words)
  - [Which fold for which question](mistake-prevention-text-comparison-and-structure.md#which-fold-for-which-question)
  - [Checks on the bytes that ship](mistake-prevention-text-comparison-and-structure.md#checks-on-the-bytes-that-ship)
  - [Text that shows nothing](mistake-prevention-text-comparison-and-structure.md#text-that-shows-nothing)
  - [Escapes and the layer that reads them](mistake-prevention-text-comparison-and-structure.md#escapes-and-the-layer-that-reads-them)
  - [Paired marks](mistake-prevention-text-comparison-and-structure.md#paired-marks)
  - [Structure read off the parse](mistake-prevention-text-comparison-and-structure.md#structure-read-off-the-parse)
  - [Pairing by position](mistake-prevention-text-comparison-and-structure.md#pairing-by-position)
  - [Offsets and positions](mistake-prevention-text-comparison-and-structure.md#offsets-and-positions)
  - [Quotes a judge gives back](mistake-prevention-text-comparison-and-structure.md#quotes-a-judge-gives-back)
- [Preventing mistakes: sheets, quorums and outcome rules](mistake-prevention-sheets-quorums-and-outcome-rules.md):
  Rules for what each model is shown,
  which seats a quorum counts,
  and how a stage reaches and records its outcome.
  Sections:
  - [Which seats a quorum counts](mistake-prevention-sheets-quorums-and-outcome-rules.md#which-seats-a-quorum-counts)
  - [Sheets every model reads](mistake-prevention-sheets-quorums-and-outcome-rules.md#sheets-every-model-reads)
  - [What each sheet is shown](mistake-prevention-sheets-quorums-and-outcome-rules.md#what-each-sheet-is-shown)
  - [Exits an outcome rule reaches](mistake-prevention-sheets-quorums-and-outcome-rules.md#exits-an-outcome-rule-reaches)
  - [Refusals inside a composed operation](mistake-prevention-sheets-quorums-and-outcome-rules.md#refusals-inside-a-composed-operation)
  - [Checks on one part of a composed text](mistake-prevention-sheets-quorums-and-outcome-rules.md#checks-on-one-part-of-a-composed-text)
  - [Checks that vouch for a whole block](mistake-prevention-sheets-quorums-and-outcome-rules.md#checks-that-vouch-for-a-whole-block)
  - [Records of more than one round](mistake-prevention-sheets-quorums-and-outcome-rules.md#records-of-more-than-one-round)
  - [Work no floor can check](mistake-prevention-sheets-quorums-and-outcome-rules.md#work-no-floor-can-check)
- [Preventing mistakes: inputs, defaults and values read from text](mistake-prevention-inputs-defaults-and-values-read-from-text.md):
  Rules for what the code takes in:
  defaults,
  fields and numbers carried as text,
  command lines,
  the package's own log lines,
  and what providers send.
  Sections:
  - [Defaults that stand in for an input](mistake-prevention-inputs-defaults-and-values-read-from-text.md#defaults-that-stand-in-for-an-input)
  - [Fields carried as strings](mistake-prevention-inputs-defaults-and-values-read-from-text.md#fields-carried-as-strings)
  - [Numbers read back from text](mistake-prevention-inputs-defaults-and-values-read-from-text.md#numbers-read-back-from-text)
  - [Command lines](mistake-prevention-inputs-defaults-and-values-read-from-text.md#command-lines)
  - [Readers of the package's own log lines](mistake-prevention-inputs-defaults-and-values-read-from-text.md#readers-of-the-packages-own-log-lines)
  - [Provider fields read by their documentation](mistake-prevention-inputs-defaults-and-values-read-from-text.md#provider-fields-read-by-their-documentation)
  - [Two layers reading one refusal](mistake-prevention-inputs-defaults-and-values-read-from-text.md#two-layers-reading-one-refusal)
- [Preventing mistakes: messages, labels and counts](mistake-prevention-messages-labels-and-counts.md):
  Rules for what a refusal,
  finding or printed line says:
  its class,
  its labels,
  its counts,
  and what a catch adds to it.
  Sections:
  - [Messages a marked class carries](mistake-prevention-messages-labels-and-counts.md#messages-a-marked-class-carries)
  - [Counts a finding states](mistake-prevention-messages-labels-and-counts.md#counts-a-finding-states)
  - [Labels a message names](mistake-prevention-messages-labels-and-counts.md#labels-a-message-names)
  - [One field carrying two kinds of text](mistake-prevention-messages-labels-and-counts.md#one-field-carrying-two-kinds-of-text)
  - [Counts in printed text](mistake-prevention-messages-labels-and-counts.md#counts-in-printed-text)
  - [What a catch charges](mistake-prevention-messages-labels-and-counts.md#what-a-catch-charges)
- [Preventing mistakes: shared code, loops and keyed tables](mistake-prevention-shared-code-loops-and-keyed-tables.md):
  Rules for the shape of the code:
  one copy of shared code,
  loops that do not copy what they built,
  and tables keyed by text.
  Sections:
  - [Copies of shared code](mistake-prevention-shared-code-loops-and-keyed-tables.md#copies-of-shared-code)
  - [Loops that copy what they built](mistake-prevention-shared-code-loops-and-keyed-tables.md#loops-that-copy-what-they-built)
  - [Tables keyed by text](mistake-prevention-shared-code-loops-and-keyed-tables.md#tables-keyed-by-text)
- [Preventing mistakes: stored files and cached decisions](mistake-prevention-stored-files-and-cached-decisions.md):
  Rules for what one run stores and a later run reads back:
  caches and their versions,
  stored files,
  and file names derived from an input.
  Sections:
  - [Cached decisions](mistake-prevention-stored-files-and-cached-decisions.md#cached-decisions)
  - [Files a later run reads back](mistake-prevention-stored-files-and-cached-decisions.md#files-a-later-run-reads-back)
  - [File names derived from an input](mistake-prevention-stored-files-and-cached-decisions.md#file-names-derived-from-an-input)

## Before a run launches

Every step is a command whose output is read,
not a memory of having done it.

1.  The tree is committed and pushed:
    `git status --short` prints nothing (M19).
2.  The full suite runs on that commit:
    `mise run buildAndTest` from the package,
    and the log's `[FAIL]` lines are counted (zero),
    not the exit code (M2,
    M12,
    M19),
    and not the `[PASS]` lines:
    a suite with failing cases still prints its pass line,
    so that count is the same in a red run and a green one (M125).
3.  Lint reads the whole `src` tree,
    and its `Found 0 warnings and 0 errors` line is read (M10,
    M23,
    M45).
4.  Every cache version is accounted for (M25,
    M28):
    `mise run //package/module/translation-repair:cache-account-audit` lists every constant the source declares,
    the commit that set each value,
    and every non-test source commit since the earliest of them that no version's account names;
    read each unnamed commit against the files its stage's sheets and floors import,
    the house rules and prose ranges included;
    a change that alters what the stage asks or accepts moves the version,
    unless no cache file was written after the change
    (`find <runs dir> -path '*slice-cache*' -type f -newermt '<time>'`,
    with the time in ISO 8601 (`2026-09-27T04:26:30Z`),
    since this host's `find` is bfs and refuses `… UTC` as an invalid timestamp (M57),
    its errors written to a file that is read,
    a control time that must find files,
    and an output file named so the pattern cannot match it).
5.  No source file holds control bytes (M40):
    `rg --text --files-with-matches '[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]' src` prints nothing,
    after the same search has found a scratch file written with one.
6.  The launch reads the plan first:
    `mise run corpus-pass -- --plan` before any spending run.
7.  The current handover says what is launching and why (M55):
    the snapshot's "What to do next" and its newest checkpoint name this launch,
    and the document map's "Current status" names the last pass read.
8.  Both output streams reach the log through one descriptor (M147):
    the runbook's `> "${RUNDIR}.log" 2>&1`,
    or a systemd unit given `StandardOutput=truncate:<log>` and no `StandardError` property,
    which then inherits stdout's file;
    never `StandardOutput=truncate:` beside `StandardError=append:` on the same file,
    whose stdout overwrites every stderr line,
    every `warn` among them.
    Right after the launch,
    `systemctl --user show --property=StandardError <unit>` prints `StandardError=inherit`
    (the runbook's launch step).
