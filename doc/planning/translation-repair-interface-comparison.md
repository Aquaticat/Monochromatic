# Comparing replacement pipeline interfaces

## Status

This compares design candidates under corrected requirements in
`doc/planning/translation-repair-pipeline-redesign.md`.
It is a proposal,
not architecture decision.
Measured motivation is recorded in
`doc/audit/translation-repair-carena-stopped-run.md`.

## Shared interface contract

All candidates expose one deep entry module:

```ts
export type ResumeAuthority =
  | {
    readonly kind: 'unfinished-node';
    readonly manifestDigest: string;
    readonly nodeId: ManifestNodeId;
  }
  | {
    readonly kind: 'new-external-evidence';
    readonly evidenceDigest: string;
  }
  | {
    readonly kind: 'human-authorized-plan';
    readonly authorizationDigest: string;
  };

export type TranslationEntryModule = {
  readonly advance: (
    input: StartEntry | (ResumeEntry & { readonly authority: ResumeAuthority; }),
  ) => Promise<CompletedEntry | SuspendedEntry>;
};
```

`CompletedEntry` always carries final document,
sealed audit,
and publication receipt.
Completion requires every fixed production responsibility discharged,
every retained dossier item explicitly resolved,
and every deterministic integrity obligation satisfied.
`SuspendedEntry` is durable open-run state,
not terminal quality result.
There is no `failed-quality`,
`refused`,
`error-without-output`,
or `incomplete-terminal` variant.
Caller abort throws exact `signal.reason` rather than converting it to outcome.

Every start operation persists finite work manifest before provider contact.
Every node records canonical model and prompt digest plus durable payload state.
Provider adapter refuses payload not named in manifest.
Indeterminate transmission suspends or reuses recorded payload;
it never creates second provider payload.
No reply,
finding,
text change,
nonce,
or round can add node.

Resume with unfinished node can execute only that same manifest.
New manifest requires new external evidence or explicit human authorization.
Finding,
changed wording,
or exhausted manifest is not resume authority.
Scheduler cannot automatically repeat spent manifest.
This prevents durable suspension from hiding unbounded loop in scheduler.
Current self-replenishing path in
`package/module/translation-repair/src/corpus-run/entry-attempt-queue.ts`
must be replaced rather than adapted.

Shared ports:

- `ModelWorkPort`: true-external provider work,
  with routed production adapter and scripted test adapter
- `RunJournalPort`: local-substitutable plan,
  payload,
  audit,
  checkpoint,
  and artifact journal
- `PublicationPort`: local-substitutable atomic write and readback verification

Parsing,
source spans,
structure,
coverage,
identity authority,
media evidence,
deduplication,
and deterministic validation stay in-process.

Quality is represented by concrete defects,
never score or historical naturalness label:

```ts
export type EditorialDefect = {
  readonly kind:
    | 'wrong-meaning'
    | 'omission'
    | 'addition'
    | 'identity-change'
    | 'syntax-damage'
    | 'grammar'
    | 'unclear-reference'
    | 'tense-inconsistency'
    | 'paragraph-relation'
    | 'register-mismatch';
  readonly sourceAnchor?: SourceAnchor;
  readonly targetAnchor: TargetAnchor;
  readonly explanation: string;
};
```

Subjective finding is editorial evidence.
It is not numeric measurement and does not become objective because several models repeat it.

## Candidate A: Accountable editor with finite audit dossier

### Seam and interface

Seam is whole-document editorial commit.
One pinned editor identity owns initial draft and final patch commit.
Specialists only discover concrete defects;
they never produce competing drafts or vote.

```ts
export type EditorialPlan = {
  readonly brief: DocumentBrief;
  readonly draftEditor: ModelIdentity;
  readonly auditors: {
    readonly fidelity: ModelIdentity;
    readonly expression: ModelIdentity;
    readonly continuity: ModelIdentity;
  };
};
```

### Fixed call graph

1.  Compile source-backed brief deterministically.
2.  Ask accountable editor for whole-document draft.
3.  Run fidelity,
    expression,
    and continuity auditors concurrently.
4.  Compile anchored,
    deduplicated dossier deterministically.
5.  Ask same accountable editor for one patch transaction resolving dossier.
6.  Apply patch and verify deterministic integrity.
7.  Publish atomically.

Provider payload ceiling is 5.
Finding count cannot increase it.

### Stage postconditions

Brief names every source unit,
identity,
link,
media claim,
front-matter field,
line structure,
and supported archive-only context exactly once.
Draft maps every source unit to target span.

Auditors have disjoint responsibilities.
Fidelity owns meaning,
omission,
addition,
and attribution.
Expression owns grammar,
usage,
and concrete register mismatch.
Continuity owns target-anchored reference,
tense,
and paragraph relation only;
it is not catch-all reviewer.
Every finding names exact target span and source anchor when relevant.
They return no score,
threshold,
or generic approval.

Final editor returns patches,
not unrestricted replacement document.
Every patch names dossier items it resolves.
Untouched spans remain byte-identical.
Every retained dossier item must end in linked patch or deterministic conflict disposition.
Conflict precedence is fixed by source fidelity,
identity authority,
structure,
then expression and continuity;
editor cannot waive defect by unsupported rebuttal.
If final response cannot satisfy complete disposition contract,
manifest suspends after fifth provider node.
No sixth call is authorized.

No model call follows commit.
Deterministic assembly checks coverage,
identity,
syntax,
structure,
links,
media obligations,
patch scope,
and readback bytes.
This is integrity verification,
not generic final Gate.

### Pros

- Highest interface depth with one operation and payload ceiling 5.
- One editor owns document voice and decisions.
- Audit happens once and cannot multiply work.
- Final output is producing editor responsibility,
  not panel compromise.
- Patch transaction protects accepted wording.
- Reuses existing preparation and invariant modules behind new seam.

### Cons

- Same editor can repeat own blind spot in draft and commit.
- Three auditors can miss defect.
- Whole-document prompt may exceed model envelope.
- Patch-only commit can be too restrictive for broad document rewrite.
- `editor-commit-unfulfilled` requires honest suspension and explicit new plan;
  architecture cannot guarantee model obeys contract.

## Candidate B: Specification-first translation compiler

### Seam and interface

Seam is compilation from typed source specification to published document.
Translation specification,
not draft,
is source of truth.

```ts
export type TranslationSpecification = {
  readonly units: readonly SemanticUnit[];
  readonly relations: readonly SemanticRelation[];
  readonly identities: readonly IdentityObligation[];
  readonly structure: StructureContract;
  readonly media: readonly MediaObligation[];
  readonly archiveEvidence: readonly ArchiveEvidence[];
};
```

### Fixed call graph

1.  Derive typed specification deterministically.
2.  Ask renderer for whole document plus unit-to-span realization map.
3.  Run four contract auditors across fixed roster:
    fidelity and omission,
    identity,
    structure and media,
    expression and document relations.
4.  Reduce typed diagnostics deterministically.
5.  Ask distinct reconciler for one contract-preserving patch transaction.
6.  Link specification,
    realization map,
    patches,
    and final Markdown deterministically.
7.  Publish atomically.

With `N` planned seats,
provider payload ceiling is `2 + 4N`.
Current eight-seat plan would cap at 34 payloads.

### Stage postconditions

Every source span belongs to exactly one semantic unit.
Every unit declares propositions,
relations,
identity references,
and destination obligations.
Renderer realizes every unit and relation.
Auditors emit typed diagnostics against specification,
not general prose verdict.

Reconciler must disposition every corroborated diagnostic.
Linker verifies realization map,
locked identities,
structure,
media,
coverage,
and patch scope.
No model Gate follows linker.

### Pros

- Strongest root-cause attack on omissions,
  identity drift,
  source relation loss,
  and visual evidence bypass.
- Quality obligations exist before prose.
- Diagnostics are concrete contract failures rather than global opinion.
- Specification is reusable audit artifact and test surface.
- Distinct reconciler can see renderer blind spots.

### Cons

- Deterministic semantic-unit derivation is not actually solved for unrestricted Chinese prose.
  Calling it deterministic can encode missed meaning into specification.
- Four roster-wide audit roles still buy up to 32 audit payloads.
- More shallow role interfaces and artifact schema than Candidate A.
- Distinct reconciler can damage document voice established by renderer.
- Highest migration cost and largest new correctness surface.

## Candidate C: Brief-before-prose editorial room

### Seam and interface

Seam is one final whole-document authorship operation informed by upstream specialist briefs.
No model reviews output after it exists.
This candidate moves expertise before prose rather than adding another postdraft catcher.

```ts
export type AuthorshipPlan = {
  readonly sourceBriefAuthor: ModelIdentity;
  readonly structureBriefAuthor: ModelIdentity;
  readonly expressionBriefAuthor: ModelIdentity;
  readonly documentEditor: ModelIdentity;
};
```

### Fixed call graph

1.  Build deterministic document envelope and authority facts.
2.  In parallel,
    ask source specialist for proposition and ambiguity brief,
    structure specialist for relations,
    media,
    links,
    and formatting brief,
    and expression specialist for voice,
    reference,
    tense,
    grammar,
    and register instructions grounded in archive.
3.  Reduce briefs,
    preserve disagreements,
    and fit one bounded editorial packet.
4.  Ask one document editor to produce final whole document once.
5.  Verify deterministic integrity and publish.

Provider payload ceiling is 4.
No candidate selection,
postdraft audit,
reconciliation,
or model Gate exists.

### Stage postconditions

Each specialist brief covers declared responsibility against source and archive before prose exists.
Final editor receives complete packet and owns every wording choice.
Output carries source-unit realization map and brief disposition map.
Deterministic assembly checks maps,
identities,
syntax,
structure,
links,
media,
and publication bytes.

### Pros

- Attacks root cause most directly:
  quality information arrives before text is created.
- Lowest payload ceiling at 4.
- No postdraft panel can manufacture more work.
- One editor controls complete document voice.
- Simplest call graph,
audit,
and prompt-uniqueness proof.

### Cons

- Specialists cannot discover output-specific grammar,
reference,
or meaning defects before output exists.
- Editor can misunderstand or ignore briefs with no model correction path.
- Realization map can be confidently wrong.
- Mechanical integrity cannot prove finished prose quality.
- Risk is shifted to offline validation rather than reduced inside run.

## Finite work and guaranteed output

Finite calls to external models cannot prove every human reader will find no prose defect.
Claiming type shape proves quality would repeat current mistake of treating process completion as output evidence.
This does not weaken completion contract into mechanical success.
Actual output remains production-readiness evidence,
and any recurring defect means producing architecture is not ready.

Requirements coexist under explicit lifecycle semantics:

- invocation executes one finite manifest and never replenishes it
- `completed` requires all fixed responsibilities,
  complete dossier disposition,
  deterministic integrity,
  and published output
- unusable provider reply or unmet production contract returns `suspended`
- suspended run remains open but scheduler cannot automatically repeat spent manifest
- continuation requires unfinished node from same manifest,
  new external evidence,
  or explicit human authorization for different finite manifest
- no quality deficit is published or called completed

This preserves no terminal no-output rule without moving unbounded loop into scheduler.
It also exposes unavoidable case:
automatic system may remain suspended until new evidence or human action exists.
Architecture cannot honestly promise otherwise.

## Ranking

Ranking:
A > C > B.

A ranks over C because postdraft specialists can find concrete defects that pre-prose briefs cannot observe,
while final output still belongs to producing editor and no model Gate follows.
Five-payload ceiling remains finite and directly replaces 186-round churn.

C ranks over B because it most cleanly tests root hypothesis with four payloads and smallest new interface.
It is weaker on output-specific defect discovery,
but weakness is measurable in throwaway prototype without committing large semantic specification system.

B ranks last because strongest contract vocabulary rests on unproven deterministic semantic specification,
and retains a roster-shaped 34-payload architecture.
It offers best omission locality,
but highest implementation and validation surface before root hypothesis is tested.

## Recommended hybrid prototype

Prototype Candidate A with Candidate B's smallest useful element:
a deterministic `DocumentBrief` carrying existing proven obligations,
not new semantic interpretation engine.

Reuse only obligations already backed by current implementation and fixtures:

- parsed structure and front matter
- prepared source and archive spans
- contributor authority
- destinations and media evidence
- carried insertion anchors
- line structure
- supported archive-only context

Do not attempt deterministic extraction of all source propositions in first prototype.
Fidelity auditor and accountable editor still read full source.

Prototype external interface remains Candidate A's `advance`.
Implementation has exactly five provider nodes.
No stage loop,
no per-slice panel,
no candidate tournament,
no generic final Gate,
and no new naturalness metric.

## Required lifecycle migration

Replacement must remove or redefine current terminal-looking outcomes in
`package/module/translation-repair/src/corpus-run/pass-entry-contract.ts`.
`resumable-failure` and `stopped` cannot remain user-visible completed attempts under new run contract.
`package/module/translation-repair/src/corpus-run/pass-entry.ts`
must route module suspension into durable open-run record,
not `TALLY status=ERROR` or `INCOMPLETE` terminal.

`package/module/translation-repair/src/corpus-run/entry-attempt-queue.ts`
must not infer new work from cache growth or append same entry to queue.
Scheduler can resume only authority variants named in shared interface.
Publication assertions remain deterministic integrity implementation,
not terminal quality refusal.

## Prototype acceptance evidence

Before selecting for production:

- static manifest proves at most five provider payloads
- positive controls cover seeded omission,
wrong meaning,
identity change,
syntax damage,
grammar,
unclear reference,
tense inconsistency,
paragraph relation,
and register mismatch
- negative controls use previously read acceptable text and prove auditors do not manufacture dossier work
- stopped Carena inputs fit editor and dossier envelopes
- one-provider adapter completes fixed graph
- abort preserves exact identity
- resume sends no duplicate payload
- unresolved patch contract suspends after fifth call and cannot auto-requeue
- deterministic publication guards still GFP-fail when removed
- complete resulting Carena page is read by human and independent reviewer
- recurring output defect changes brief,
auditor responsibility,
or editor contract;
it never adds Gate or retry loop
