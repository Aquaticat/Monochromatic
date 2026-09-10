# Scoped archive evidence

Task 26 designs the generic implementation after the successful
[name-repair prototype](translation-repair-name-authority-2026-09-10.md).
Tasks 27 and 28 cover acquisition implementation and repair-lifecycle integration.
Task 21 remains incomplete until that integration is verified.
No production revision feature has been added.

## Verified starting point

The `b9d3b2ea0` evidence-injection prototype completes the real repair path
with correct disclosure direction,
administrator wording and `Harunome Hanbai` retained.
All three editors retain the group name.
The selected GLM-flash chunk wins six votes,
not a fallback.
Regional ties leave a weaker composite,
but whole-chunk selection chooses the complete editor draft.

`~/temp/agent/temporal-revision-path-replay-20260910.json`
replays all 58 requests with zero cache misses and identical final text.
`~/temp/agent/temporal-revision-boundary-20260910.out`
records valid strict grammar and paragraph/list structure.
Some selector reasons incorrectly reject source-supported date or name expansions;
those reasons are not credited as factual evidence.
The selected summary itself does not carry the wrong childhood timing.

This verifies an evidence treatment,
not generic acquisition or a complete published page.
The prototype still selects one known historical revision manually.

## Required interface properties

- Read from the pinned pre-repair archive,
  not generated candidates or the mutable working tree.
- Derive revision provenance rather than maintaining a name list.
- Keep exact before/after fragments,
  origin revision/path and current occurrence scope.
- Never reuse an inferred correspondence across entries.
- Distinguish a recorded wording change from factual truth,
  an official English name or an official work title.
- Do not label arbitrary revisions as naming choices.
- Keep source facts,
  explicit naming declarations,
  work-title precedence and mentioned-form preservation intact.
- Missing or incomplete history must be represented honestly,
  not manufactured as an empty authoritative record.
- Cache and twin identities must include the normalized evidence actually supplied.
- Stored artifacts must retain enough provenance to audit and rebuild that input.
- No additional model-generation round is introduced.

## Existing module facilities

`package/module/translation-repair/src/corpus-source.ts`
already reads blobs at `CorpusPin.commitSha`,
rather than reading the working tree.
It folds CRLF to LF through `foldCarriageReturns`.
Lone carriage returns are not folded.
`src/corpus-run/git-command.ts` supplies the existing `resolveGit` helper,
which prefers the real binary over the repository's mutation-policy shim.
Reuse these choices rather than creating a second Git-resolution convention.

The proposed seam is a module that accepts the pin and archive path
and returns scoped revision records plus honest coverage/availability findings.
It owns Git reading and parsing.
Consumers should not need to reconstruct blame origins or join diff hunks.
Tests should cross that interface using disposable Git repositories.
The exact record and failure contracts remain to be finalized from the probes.

## Git source and initial acquisition probe

The installed command reports Git 2.55.0.
Read-only source reference:
`~/temp/agent/git-reference-20260910`,
tag `v2.55.0`,
commit `e9019fcafe0040228b8631c30f97ae1adb61bcdc`.
The inspected paths are `Documentation/git-blame.adoc`,
`Documentation/blame-options.adoc`,
`Documentation/diff-options.adoc` and `builtin/blame.c`.
No third-party source is edited.

`~/temp/agent/prototype-archive-revision-acquisition-20260910.mjs`
uses pinned line origins and ordinary parent-relative diffs.
It does not name Mio's origin revision in its acquisition algorithm.
The first read-only invocation on `people/Mio/page.en.md` produces:

- 234 current lines and nine origin revisions considered.
- Eleven Git calls and 131374 bytes of captured output.
- Forty-two single-line replacement records.
- The desired `春の芽工作室` to `Harunome Hanbai` replacement,
  with the correct `33a9d3d9...` origin.
- Other records consisting of punctuation,
  reordered wording and partial-word changes such as `dmit` to `ccep`.

Results:
`~/temp/agent/archive-revision-acquisition-20260910.json`.
The result demonstrates why indiscriminately labeling all records as names would be wrong.
The recorded elapsed time is one invocation,
not a performance comparison or a corpus-wide estimate.

Current prototype limits are deliberate investigation scope,
not the final implementation contract:

- Only unambiguous single-line replacement hunks are paired.
- Boundary,
  ignored and foreign-path origins are not used.
- Initial insertions and deletion-only changes provide no pair.
- A minimal contiguous changed span is derived with surrogate-pair boundaries preserved.
  This is not a general semantic diff.
- Current-range checks reject a normalization mismatch.
- Author names and email addresses are not part of emitted evidence.

Disposable-fixture verification is still required for roots,
merges,
renames,
shallow history,
multiple edits,
reversions,
path quoting and line-ending behavior.
The collector must not infer naming semantics from a hunk's shape.
The verified Git mechanics and limitations are recorded in
[Git blame archive revisions](../troubleshooting/git-blame-archive-revisions.md).

## Generic evidence wording

The successful probe's sentence calls the edit a local naming choice.
That statement is accurate for the inspected Mio revision,
but cannot be copied blindly over arbitrary acquired records.

`proc_d506` tested a generic conditional explanation.
Its factual-error,
archive-only work-title,
mentioned-form and explicit-English-name controls remained actionable.
The actual reference-name allegation nevertheless became accepted,
with three supports,
two oppositions and one malformed abstention.
The probe stopped before selector comparisons.
No corresponding formatter is integrated.

## Completed generic-wording probe

`proc_b1a6` stopped after eighteen calls in 54 seconds.
It stays closer to the successful fragment description,
but calls the revision a local English wording choice,
not a naming choice,
and excludes independent factual authority.

- Script:
  `~/temp/agent/probe-generic-revision-context-r2-20260910.mjs`.
- Plan:
  `~/temp/agent/generic-revision-context-plan-20260910-r2.out`.
- Log:
  `~/temp/agent/generic-revision-context-probe-20260910-r2.log`.
- Report:
  `~/temp/agent/generic-revision-context-probe-20260910-r2/report.json`.

The same preplanned safety controls run before the actual name allegation
and the previously constructed name-only selector comparison in both orders.
System rules,
schemas,
roles and tally thresholds remain unchanged.
The cap is sixty requests and a twenty-minute global bound.
No production code or corpus content changes.

The factual-error and archive-only work-title corrections remain authorized.
The genuine mentioned-form correction ties three-to-three and is not authorized,
so the probe stops without relaxing that positive control.
The generic description is not integrated.
The first generic probe logged 0.00292189 USD on Bedrock,
with four OpenRouter calls reporting zero and eleven Hyper plus seven Synthetic calls unpriced.
The second logged 0.00157165 USD on Bedrock,
with two OpenRouter calls reporting zero and eight Hyper plus three Synthetic calls unpriced.
The daily helper ran after both.

## Reconsider the evidence source

An independent advisor identified the missing semantic variable:
the successful history payload explicitly described a naming choice,
while arbitrary automatically acquired edits have no such classification.
Before building history machinery,
test whether typed current-archive use evidence can supply that fact directly.

### Typed current-archive occurrence use

- Pros:
  directly represents whether a span is a person,
  group or place reference,
  a creative-work title,
  a mentioned form or ordinary prose.
  It does not require Git history or a source-to-English name mapping.
- Cons:
  requires corroborated semantic classification,
  exact immutable anchors,
  and verification that an added response field does not degrade the existing alignment task.

### Narrow historical evidence

- Pros:
  the inspected naming revision has already improved actual repair and selection.
  The acquisition prototype finds its origin without a name-specific lookup.
- Cons:
  history availability and provenance need handling,
  ordinary edits are not naming declarations,
  and the generic descriptions tested so far do not preserve all required behavior.

### Generic history prose

- Pros:
  uniform representation of raw before/after facts.
- Cons:
  the current probes either lose name preservation or suppress a genuine mentioned-form correction.

Ranking:
typed current-archive evidence,
then narrowly scoped historical evidence,
then generic history prose.
Typed use states the policy-relevant fact directly without the historical-availability problem.
Narrow history has a measured successful case,
whereas generic prose has not retained the needed behavior.
This is the investigation ranking,
not an implementation decision yet.

## Candidate typed-record contract

A record observes the use of one exact span in the initial English archive.
It is not an official-name declaration,
a source-name alias,
a canonical replacement,
a global glossary entry or a finding that the surrounding facts are correct.
No generated candidate may establish the record.

The proposed closed use kinds are person-reference name,
group-reference name,
place-reference name,
creative-work title,
mentioned form,
ordinary prose and unresolved.
Unresolved or disputed classifications yield no naming evidence;
omission is not converted into an ordinary-prose judgment.
Only the exact occurrence is in scope.

The existing block-pairing call is a candidate seam.
It already reads both block lists before downstream criticism.
An auxiliary classification field could share that call without adding a production generation round.
Independent respondents must classify the same exact candidate;
no respondent sees another respondent's classification.
Primary pairings must remain usable when auxiliary classification is malformed.

## Completed classification prototype

`proc_a1a0` completed `translation-repair-archive-use-classification-probe-20260910`
in 115 seconds with fourteen requests.

- Script:
  `~/temp/agent/probe-archive-use-classification-20260910.mjs`.
- Plan:
  `~/temp/agent/archive-use-classification-plan-20260910.out`.
- Log:
  `~/temp/agent/archive-use-classification-probe-20260910.log`.
- Report:
  `~/temp/agent/archive-use-classification-probe-20260910/report.json`.

Candidate spans are discovered from parsed emphasis nodes,
not from the literal group name.
This is a bounded discovery prototype,
not a claim to find every plain-text name.
The real Mio slice is accompanied by invented person,
group,
place,
work-title,
mentioned-form and ordinary-prose cases,
plus an unrelated target block that should not be paired.
Expected kinds are not sent to models.

Baseline and augmented calls use the same full preparation roster
through the existing public block-pairing stage.
The augmented schema adds a use kind for each supplied candidate index.
The original pairing validator still decides pairing usability;
missing or malformed auxiliary fields are recorded separately.
Two independent exact-kind agreements are required,
and conflicting corroborated kinds yield no annotation.

The cap is 48 requests and a twenty-minute global bound.
No production schema or prompt is changed.
Both baseline and augmented stages hear seven usable voices,
return the same nine block pairs,
leave the unrelated target unpaired,
and report no pairing findings.
All eight candidate uses receive the expected corroborated kind.
Mio's group reference,
ordinary `owned` and the wrong-person reference each have six matching classifications and one dissent;
work titles,
mentioned form,
explicit group name and place have seven matching classifications.
No auxiliary wire findings are reported.

The initial scratch harness supplied `fanOut: 'all'`,
which is not a valid `FanOutMode` spelling.
`stage-fanout-window.ts` accepts `window` or `whole-bench`;
the unsupported value followed the window branch.
This was not an eleven-voice exhaustive run.
`~/temp/agent/verify-archive-use-window-20260910.mjs`
replays the same fourteen calls with valid `fanOut: 'window'`,
zero misses,
identical pairings and identical corroborated classifications.
The corrected replay is the configuration verification.

Next compare typed current-use evidence with neutral history evidence
at the same claim and selector seams,
including all genuine-correction controls.
Neither a runtime Git dependency nor a typed-use implementation is selected yet.
