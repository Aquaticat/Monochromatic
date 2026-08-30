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
export type TranslationEntryModule = {
  /**
   * @throws ProductionUnavailableError when every finite producer is unusable before first adoption.
   * @throws PublicationUnavailableError when assembly, atomic write, or readback fails.
   */
  readonly produce: (
    input: StartEntry | RestartEntry,
  ) => Promise<CompletedEntry>;
};
```

`CompletedEntry` always carries one good complete document,
sealed audit,
and publication receipt.
It is only normal translation outcome.
There is no `failed-quality`,
`refused`,
`error-without-output`,
`incomplete-terminal`,
or user-visible suspended translation variant.
Caller abort throws exact `signal.reason` rather than converting it to outcome.

Every start operation persists finite work manifest before provider contact.
Every node records canonical model and prompt digest plus durable payload state.
Provider adapter refuses payload not named in manifest.
No reply,
finding,
text change,
nonce,
or round can add node.
Model nodes are preparation-evidence or candidate-producer nodes.
Preparation-evidence node may produce brief or specification before authorship;
its unusable response contributes nothing and cannot withhold producer work.
First adopted candidate producer owns full concrete quality contract:
fidelity,
completeness,
identity,
grammar,
clear references,
consistent tense,
paragraph relations,
and register.
Later producers are targeted improvements,
not required rescue for deficient baseline.
Every post-preparation model node is candidate producer and produces complete candidate or has no effect.
After first complete candidate exists,
node timeout,
refusal,
or unusable output preserves prior candidate byte-for-byte and execution continues.
Before first candidate exists,
manifest names finite fallback producers that may each be tried once.
If all planned producers are exhausted by transport failure or unusable response,
`produce` throws bounded `ProductionUnavailableError` with exhausted node identities.
It does not suspend,
automatically requeue,
or publish unchecked archive fallback.
`ProductionUnavailableError` concerns exhausted candidate producers only;
failed preparation-evidence node never causes it.

Restart requires same manifest digest and checkpoint and executes pending nodes only.
Completed,
failed,
unusable,
aborted,
or indeterminate nodes are spent.
Recorded payload from indeterminate transmission may be reused,
but canonical prompt may never be resent.
Caller abort bypasses fallback immediately and throws exact `signal.reason`.
Checkpoint is internal crash and cancellation evidence,
not user-visible translation state.
Each node digest binds exact source,
archive,
brief,
prior candidate bytes or explicit absence marker,
role,
and response contract.
Assembly,
atomic write,
or readback failure after first adoption throws bounded `PublicationUnavailableError`.
It cannot suspend,
automatically requeue,
publish partial bytes,
or publish archive fallback.
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

Manifest planning follows provider preflight.
For each supported single-provider mode,
every producer,
fallback,
renderer,
specification author,
brief author,
and editor resolves through that wet provider.
Cross-provider response is never correctness dependency.

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

## Candidate A: Serial accountable document producers

### Seam and interface

Seam is adoption of complete whole-document revisions.
Every model node can create full document when no prior candidate exists,
or revise prior complete document under one concrete responsibility.
No model merely diagnoses defects that another model must later rescue.

```ts
export type EditorialPlan = {
  readonly brief: DocumentBrief;
  readonly producers: readonly [
    WholeDocumentProducer,
    FidelityProducer,
    ExpressionProducer,
    ContinuityProducer,
  ];
};
```

### Fixed call graph

1.  Compile source-backed brief deterministically.
2.  Ask whole-document producer for complete draft.
3.  Ask fidelity producer for complete source-faithful revision.
4.  Ask expression producer for complete grammar,
    usage,
    and register revision.
5.  Ask continuity producer for complete reference,
    tense,
    chronology,
    and paragraph-relation revision.
6.  After each response,
    adopt complete candidate only when deterministic obligations pass;
    otherwise preserve prior candidate byte-for-byte.
7.  Publish final surviving candidate atomically.

Provider payload ceiling is 4.
No response can increase it.
If first producer does not return usable document,
remaining statically named producers receive source,
archive,
brief,
and empty-prior marker and can establish first candidate.
Any producer in fallback mode assumes full concrete quality contract;
its narrower role applies only when prior complete candidate exists.
Once candidate exists,
node failure cannot withhold it.

### Stage postconditions

Brief names every known identity,
link,
media claim,
front-matter field,
line structure,
and supported archive-only context.
Each producer returns one complete document,
not score,
verdict,
finding-only report,
alternative slate,
or patch requiring another model.

Responsibilities are disjoint.
Fidelity owns wrong meaning,
omission,
addition,
identity,
and attribution.
Expression owns grammar,
usage,
unclear expression,
and concrete register mismatch.
Continuity owns unclear reference,
tense,
chronology,
repetition,
and paragraph relation.
Each later producer receives exact prior document and returns complete candidate plus exact edit transaction.
Every edit names prior-text anchor,
source evidence,
and concrete responsibility.
Deterministic application must reproduce complete candidate exactly and rejects undeclared changes.

Deterministic adoption checks coverage,
identity,
syntax,
structure,
links,
media obligations,
and complete-document shape before changing current candidate.
No model Gate follows final producer.

### Pros

- A usable producer establishes output that later node failure cannot withhold.
- Every specialist improves text directly rather than manufacturing blocking work.
- Payload ceiling is 4 with no panel,
vote,
patch round,
or reconciliation call.
- Complete-document boundaries preserve document voice better than independent slice candidates.
- Reuses existing preparation and invariant modules behind one deep adoption seam.

### Cons

- Later whole-document producer can request more edits than responsibility requires.
- Source-anchored edit transactions constrain authority but cannot prove every semantic judgment.
- Serial calls trade some latency for stage accountability.
- If every configured producer becomes unavailable before first candidate,
  infrastructure cannot create translation output;
  fixed roster must exhaust into bounded production-unavailable diagnostic.

### Rejected Candidate A evidence

First throwaway A1 implemented draft,
three finding-only auditors,
and later patch commit.
Carena run reached complete draft and two audits,
then fidelity auditor exceeded 360,000-millisecond exchange deadline.
A1 returned suspended after 469 seconds and wrote no final page.
Its explicit resume was stopped after user clarified that this behavior leaves caller hanging.

A1 therefore falsified audit-dossier interface before output reading:
a non-producing auditor could withhold complete producer output.
A1 result remains operational evidence at
`~/temp/agent/prototype-Carena-A-accountable-editor-20260830/result.json`,
but is not quality evidence and must not be averaged with corrected Candidate A.

Corrected A2 ran four serial complete-document producer nodes on fresh Carena root.
Both providers were wet at preflight.
Four prompt-payload artifacts and four `SPEND` records exist;
provider-internal request attempts were not counted.
Process exhausted graph with exit code 1 after 432 seconds;
recorded invocation duration was 429,690 milliseconds.
No candidate was adopted and no accepted or published page existed:

- whole-document response document field introduced structural parse regression
- fidelity fallback response document field dropped one contributor form
- expression fallback response document field introduced footnote relation defect
- continuity fallback response document field had invalid front matter

A2 did not leave suspended work,
but bounded `ProductionUnavailableError` still left caller without output.
This falsifies Candidate A against user requirement.
Raw responses remain private under
`~/temp/agent/prototype-Carena-A2-serial-producers-20260830/`.
Do not score,
rank,
average,
quote,
or use them as translation-quality samples.
They are operational and contract evidence only.
Candidate A is rejected rather than repaired with another retry or Gate.

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

1.  Ask specification author for typed source specification.
2.  Deterministically admit valid units and preserve raw source spans for any unsupported unit.
3.  Ask renderer for complete document plus unit-to-span realization map.
4.  In parallel,
    ask fidelity and omission producer,
    identity,
    structure,
    and media producer,
    and expression and document-relations producer
    for complete revised document and exact specification-linked transaction against same renderer base.
    If renderer was unusable,
    each receives explicit absence marker and can establish first candidate from source and specification.
5.  Validate all transactions independently.
    When base exists,
    merge non-conflicting valid transactions in fixed responsibility order.
    When base is absent,
    adopt first valid complete candidate in that same fixed order.
6.  Publish final surviving candidate atomically.

Provider payload ceiling is 5.
Specification-author failure leaves raw source envelope as renderer input and cannot block document production.
Renderer failure lets each later statically named producer establish first candidate from specification and source.
No response can add work.

### Stage postconditions

Every admitted source span belongs to one semantic unit.
Every unit declares propositions,
relations,
identity references,
and destination obligations.
Raw unsupported spans remain first-class obligations rather than disappearing from invalid specification.
Each document producer returns complete document,
unit-to-span realization map,
and exact edit transaction when prior candidate exists.
Every changed unit and edit anchors immutable raw source span and digest;
model-authored specification alone is never source authority.

Linker verifies realization map,
locked identities,
structure,
media,
coverage,
edit scope,
and complete document before adoption.
No model Gate follows final producer.

### Pros

- Strongest root-cause attack on omissions,
  identity drift,
  source relation loss,
  and visual evidence bypass.
- Quality obligations exist before prose.
- Revisions are linked to concrete specification obligations rather than global opinion.
- Specification is reusable audit artifact and test surface.
- Distinct responsibility producers can correct renderer blind spots directly.

### Cons

- Deterministic semantic-unit derivation is not actually solved for unrestricted Chinese prose.
  Calling it deterministic can encode missed meaning into specification.
- Model-authored specification can be confidently wrong despite raw-span fallback.
- More shallow role interfaces and artifact schema than Candidate A.
- Distinct producers can damage document voice established by renderer.
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
  readonly documentEditors: readonly [ModelIdentity, ModelIdentity];
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
3.  Reduce usable briefs,
    preserve disagreements,
    and fit one bounded editorial packet.
    Missing or unusable brief contributes nothing and cannot block authorship.
4.  In parallel,
    ask primary and statically named fallback document editors
    to produce final whole document once from exact same immutable packet.
5.  Validate both responses independently.
    Adopt primary when usable;
    otherwise adopt fallback.
    Fallback completion time never overrides fixed priority.
6.  Verify deterministic integrity and publish adopted whole document.

Provider payload ceiling is 5.
No candidate selection,
postdraft audit,
reconciliation,
or model Gate exists.

### Stage postconditions

Each specialist brief covers declared responsibility against source and archive before prose exists.
Each editor receives exact same complete packet and owns every wording choice.
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
- Payload ceiling is 5 including one fixed editor fallback.
- Two provider waves expose all independent work:
  three briefs,
  then two fixed-priority editors.
- No postdraft panel can manufacture more work.
- One adopted editor controls complete document voice.
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

## Measured concurrency implications

Production uses 5 Synthetic slots per active model
and exposes 20 aggregate Synthetic slots across the current roster.
Hyper has no provider concurrency ceiling,
with width 64 corroborated on live request shape.
The Hyper account's 1,000 requests-per-hour limit is separate from simultaneous in-flight work.
See `doc/troubleshooting/translation-repair-provider-concurrency.md`.

Candidate C can execute its five payloads in two dependency waves.
Candidate B can execute its five payloads in three waves:
specification,
renderer,
then three independent specialist transactions.
Static fixed priority preserves deterministic adoption regardless of response order.
No cross-provider response is required,
and one model never receives same canonical substantive prompt twice.

These are scheduling consequences,
not quality evidence.
Corpus-sized generation and complete-page reading remain prototype acceptance requirements.

## Finite work and guaranteed output

Finite calls to external models cannot prove every human reader will find no prose defect.
Claiming type shape proves quality would repeat current mistake of treating process completion as output evidence.
Actual complete output remains production-readiness evidence,
and any recurring defect means producing architecture is not ready.

Requirements coexist through producer adoption:

- invocation executes one finite manifest and never replenishes it
- each successful model node returns one complete candidate under named responsibility
- unusable later response has no effect and cannot withhold prior complete candidate
- before first candidate,
  only statically named fallback producers may run
- deterministic integrity decides adoption,
  never an aggregate quality opinion
- normal return always includes published complete output
- checkpoint and restart recover crashes or exact cancellation without becoming visible suspended translation
- completed canonical prompt is never resent

Transport loss or unusable output from every producer before first adoption
is not solvable by translation architecture.
Fixed producer roster exhausts into bounded `ProductionUnavailableError`
rather than suspension or ordinary translation result.
The pipeline must not disguise it as quality refusal,
automatically retry it,
or publish archive fallback as repaired output.

## Provisional working order pending complete B and C outputs

Working order:
C > B > A.

C ranks over B on design evidence only because it tests whether quality information placed before prose
can avoid invalid first output with five payloads and smaller interface.
This edge is not empirical quality evidence and remains paper-only until both complete Carena outputs are read.

B ranks over A because typed source obligations may prevent concrete structure,
contributor,
and completeness failures measured in A2.
B remains unproven and carries larger artifact schema.

A ranks last because both measured implementations wrote no output.
A1 let non-producing auditor withhold draft;
A2 received all planned model responses but every response failed concrete adoption obligation.
No runtime or quality advantage can compensate for violating required output contract.

## Required lifecycle migration

Replacement must remove current terminal-looking outcomes in
`package/module/translation-repair/src/corpus-run/pass-entry-contract.ts`.
`resumable-failure` and `stopped` cannot remain normal translation results under new run contract.
`package/module/translation-repair/src/corpus-run/pass-entry.ts`
must return published output after finite producer graph,
not `TALLY status=ERROR`,
`INCOMPLETE`,
or visible suspended translation because ancillary model work failed.

`package/module/translation-repair/src/corpus-run/entry-attempt-queue.ts`
must not infer new work from cache growth or append same entry to queue.
Deterministic restart may reuse completed nodes from same manifest after crash or exact caller cancellation;
it cannot create another manifest automatically.
Publication assertions remain candidate-adoption integrity implementation,
not terminal quality refusal.

## Prototype acceptance evidence

Before selecting for production:

- static manifest proves declared ceiling:
  A at most 4 payloads,
  B and C at most 5
- positive controls cover seeded omission,
wrong meaning,
identity change,
syntax damage,
grammar,
unclear reference,
tense inconsistency,
paragraph relation,
and register mismatch
- negative controls use previously read acceptable text and prove responsibility-specific producers preserve it
- stopped Carena inputs fit each whole-document producer envelope
- either one-provider adapter can supply complete producer and fallback roster
- abort preserves exact identity
- deterministic restart sends no duplicate payload
- each unusable later producer preserves prior complete candidate and execution reaches publication
- first-producer failure exercises statically named fallback producer without adding manifest work
- deterministic publication guards still GFP-fail when removed
- complete actual Carena output from every candidate is read by human and independent reviewer;
  artifact or tally alone is not comparison evidence
- recurring output defect changes brief,
producer responsibility,
or adoption contract;
it never adds Gate or retry loop
