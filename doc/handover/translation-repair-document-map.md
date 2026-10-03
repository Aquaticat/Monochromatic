# Translation repair document map

## Current status

From 2026-10-03 the owner is away for about 48 hours,
and a trial model,
MiMo 2.6 Pro,
works the package on the branch `translation-repair-mimo-trial`.
Its start point and log is
[`translation-repair-mimo-trial-2026-10-03.md`](translation-repair-mimo-trial-2026-10-03.md),
which names the state that day:
`98e94e584` fails one case,
the empty-label contributor link now numbered B126;
B123 is written into the audit ledger from the commit message that queued it;
and T8's next batch reads against a fresh whole-suite census,
since the cut of the remaining bundles was never committed.

As of 2026-09-29,
work is on the LEGACY slice pipeline,
under the owner's direction decision of 2026-09-01 and the OpenRouter order of 2026-09-03,
with Synthetic,
Amazon Bedrock,
Hyper and OpenRouter as its providers.
It is not production ready.

Since 2026-09-27 the work has been the owner's audit of the whole package
("audit the whole translation-repair pkg for all the mistakes we've made and fix all of them").
The package's
[audit ledger](../../package/module/translation-repair/doc/audit-ledger.md)
holds every finding with its measurement,
its fix and its guard,
and every mistake made while fixing;
[`mistake-prevention.md`](../../package/module/translation-repair/doc/mistake-prevention.md)
holds the rule that prevents each family of mistakes.
Open work is every ledger entry whose status reads open or recurring.
The last pass,
`TianqiChen66621` on `.frozen-dist-9a3f28b30`,
settled on 2026-09-28 and was read the same day;
the class it found,
one hundred eighty-seven,
is fixed.
No pass has launched since:
the owner allowed the next launch to wait for the audit's fixes
("You don't need to immediately start/restart a costly run if you believe further fixes should be done before
launching it.").

The finite redesign stopped after Candidate M failed on 2026-09-01.
No Candidate A through M is production-eligible,
and no successor implementation or calibration is authorized.
That closure does not bound the legacy pipeline.

Start with:

1.  [`translation-repair-handover-2026-09-06.md`](translation-repair-handover-2026-09-06.md),
    the current snapshot whatever its date:
    its "Where the work stands" opens with dated checkpoints,
    newest first,
    and its "What to do next" carries the state each session left and the next launch;
2.  the package's [audit ledger](../../package/module/translation-repair/doc/audit-ledger.md)
    and [`mistake-prevention.md`](../../package/module/translation-repair/doc/mistake-prevention.md)
    for the audit in progress,
    and the [package README](../../package/module/translation-repair/README.md)'s "Where the rest lives"
    for the package docs on configuration,
    the roster,
    the providers and the seats;
3.  [`translation-repair-readiness-signal.md`](../planning/translation-repair-readiness-signal.md)
    for what production ready would take and why the answer is still no;
4.  [`translation-repair-openrouter-2026-09-03.md`](../planning/translation-repair-openrouter-2026-09-03.md)
    for every OpenRouter run and its reading,
    one section per run or read,
    each heading dated;
    when this map was written the newest was TianqiChen66621's read of 2026-09-28;
5.  [`translation-repair-redesign-failure-2026-09-01.md`](../audit/translation-repair-redesign-failure-2026-09-01.md)
    for the redesign's terminal disposition and A through M reconstruction;
6.  [`translation-repair.md`](translation-repair.md)
    for the owner's operating rule,
    and for the private evidence paths,
    spent prompts and stop conditions of the 2026-09-01 handover it keeps;
    its repository state is that handover's,
    and the current one is the snapshot's "Repository state";
7.  this map for the remaining document families and its [redaction timing](#redaction-timing).

## Finite-interface design

- [`translation-repair-pipeline-redesign.md`](../planning/translation-repair-pipeline-redesign.md)
  records the original hard requirements.
- [`translation-repair-interface-comparison.md`](../planning/translation-repair-interface-comparison.md)
  is the candidate index and shared design baseline.
- [`translation-repair-interface-candidates-a-d.md`](../planning/translation-repair-interface-candidates-a-d.md)
  covers serial producers,
  specification compilation,
  brief-before-prose,
  and immutable-shell iterations.
- [`translation-repair-interface-candidates-e-g.md`](../planning/translation-repair-interface-candidates-e-g.md)
  covers conditional adoption,
  donor assembly,
  and realization ledgers.
- [`translation-repair-interface-candidates-h-j.md`](../planning/translation-repair-interface-candidates-h-j.md)
  covers bounded verdicts,
  candidate-scoped ballots,
  and the rejected Kimi expansion.
- [`translation-repair-interface-candidates-k-m.md`](../planning/translation-repair-interface-candidates-k-m.md)
  covers readable review units,
  lean realization,
  and risk-split challengers.

Candidate detail files are evidence,
not authorization to reuse their prompts or resume their graphs.
Before formatting,
the split script assigned every byte of the pre-split comparison to the index or one detail file.
Its pre-split SHA-256 was
`933df3bccd51b986bd325d6fd540c4b972d4a5288ebbb205096cfba66398eac9`.

## Chronological history

[`translation-repair-history.md`](translation-repair-history.md)
is the chronological index for 12 groups and 44 navigable segments.
The pre-split source had SHA-256
`56bdbdf2a0d5b7198b0ff75b428d7b00a2e9218ae28e25f9421895f5ce51aa8d`.
Every source byte was assigned to one chronological group,
and every group byte was assigned to an initial segment before stop banners or formatting were added.
The
[`translation-repair-history-secondary-split-2026-09-01.json`](../audit/translation-repair-history-secondary-split-2026-09-01.json)
and
[`translation-repair-history-indented-split-2026-09-01.json`](../audit/translation-repair-history-indented-split-2026-09-01.json)
audits record exact raw-part reassembly for later segment splits.
Every directly opened segment carries the current Candidate M implementation stop.

Historical claims can be superseded by later segments.
The timestamped failure report and current handover take precedence.

## Superseded handovers

The split of 2026-09-01 moved three dated snapshots out of the handover:

- 2026-08-29 pipeline and stopped-run state;
- 2026-08-25 to 2026-08-27 provider and production state;
- 2026-08-26 session close and open register.

The handover index also links the 2026-09-04 snapshot among these historical ones,
and the 2026-09-06 snapshot as current.

The pre-split handover had SHA-256
`285c54e35836750d110a544bd9e93ae08980b0cb989e4eef95820af478a670aa`.
Every pre-split byte was assigned to the current handover or one dated snapshot before formatting.

Dated snapshots are historical evidence.
Do not follow their next-action lists without reconciling them against the current implementation stop.

## Legacy production operation

- [`translation-repair-overlap-dial.md`](translation-repair-overlap-dial.md)
  records the overlap mechanism and measurements.
- [`translation-repair-run-continuity.md`](translation-repair-run-continuity.md)
  indexes supervision,
  restart measurement,
  and cache-fix history.
- [`translation-repair-corpus-pass.md`](../runbook/translation-repair-corpus-pass.md)
  is the manual corpus-pass runbook.
  Passes on the legacy pipeline are authorized;
  when the next one launches is in the current snapshot's "What to do next".

The pre-split continuity document had SHA-256
`14c7e46f7b54867af4539cca0ba493302da06ff5a7e16a76d32d8be18a281806`.
Every byte was assigned to the index or one of its three historical parts before formatting.

The final process-state audit is
[`translation-repair-process-state-2026-09-01.json`](../audit/translation-repair-process-state-2026-09-01.json).
It checked the exact pass and supervisor argument basenames recorded in the continuity documents and found no matching
process.

## Split verification

The sanitized after-state audit is
[`translation-repair-document-split-2026-09-01.json`](../audit/translation-repair-document-split-2026-09-01.json).

For the history,
handover,
run-continuity,
and interface-comparison families,
the audit verifies that every word from the pre-split or unreplaced committed baseline remains in order after formatting
and splitting.
It also verifies that every prior Markdown link target remains,
and that the current handover,
Candidate M disposition,
legacy stop banner,
and implementation stop are present.
The after-state probe is deliberately limited to ordered word tokens and link-target containment;
it does not claim punctuation,
Markdown syntax,
code syntax,
or link ordering.
Split-time byte-assignment and raw-part audits provide the separate structural evidence.

The final local-link audit is
[`translation-repair-document-links-2026-09-01.json`](../audit/translation-repair-document-links-2026-09-01.json).
It checked 168 local Markdown and JSON targets,
including 14 rendered heading fragments and one same-document fragment,
from translation-repair documents and inbound links from other documents;
none failed.
The audit parses Markdown with `remark-parse`,
derives visible heading text from its syntax tree,
and applies GitHub's heading slugger.
Its staged JSON retains one result row per checked target.
The
[`translation-repair-document-link-controls-2026-09-01.json`](../audit/translation-repair-document-link-controls-2026-09-01.json)
positive controls detect a missing file and a missing fragment while accepting a valid file plus fragment fixture.

## Provider and tooling evidence

[`../troubleshooting/README.md`](../troubleshooting/README.md)
indexes provider,
transport,
streaming,
token-limit,
concurrency,
and detached-worktree behavior.
Read the matching troubleshooting record before attributing an external-tool failure.

Candidate M's public harness and sanitized envelope evidence are pinned by SHA-256 in the failure report and current
handover.
The GitHub gist base URL is mutable;
use the revision-specific URL and byte digest.

## Task numbers in these documents

Many documents indexed here cite items of a session's task tracker,
as `#N` or as "task N".
Those ids belong to the session that wrote them:
one number names different work in different sessions,
none is a GitHub issue,
and a bare `#N` on GitHub links an unrelated one
(`AGENTS.md` rules XNS and XN2).
The history segments,
dated snapshots,
run-continuity parts and interface-candidate files are kept byte for byte,
as their split audits require.
The living documents name the work instead:
the translation-repair decision records,
the current handover and its snapshot,
the readiness signal and OpenRouter pass log it links as current,
and the translation-repair runbooks and troubleshooting docs.
Every other document keeps its numbers as written;
read each against the session and date around it.
Where a living document quotes the owner,
the quotation keeps its number and the text around it says what the number meant.
The sections those living documents carry from the sessions of 2026-09-10 to 2026-09-15
keep that tracker's numbers under a note saying whose they are.

## Redaction timing

The
[package-local redaction policy](../../package/module/translation-repair/doc/redaction-timing.md)
records the standing instruction:
documentation redaction is deferred while the package remains unfinished and not production-ready.
The split preserves historical corpus,
review,
calibration,
and takeover evidence for later package work.
Redaction becomes a required readiness gate before the package may be declared finished or production-ready.

The timing deferral does not authorize committing credentials,
API keys,
or raw provider payloads.
Those materials remain private throughout development and after release.
The targeted staged-content audit is
[`translation-repair-sensitive-material-2026-09-01.json`](../audit/translation-repair-sensitive-material-2026-09-01.json).
It checks credential and embedded-image signatures,
staged file extensions,
and exact long chunks from retained Candidate I,
K,
L,
and M provider-traffic artifacts without redacting corpus or reviewer wording.
