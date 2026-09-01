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

- `ModelWorkPort`:
  true-external provider work,
  with routed production adapter and scripted test adapter
- `RunJournalPort`:
  local-substitutable plan,
  payload,
  audit,
  checkpoint,
  and artifact journal
- `PublicationPort`:
  local-substitutable atomic write and readback verification

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

### Rejected Candidate B evidence

Candidate B implemented its five-payload graph with one specification author,
one renderer,
and three concurrent complete-document fallback specialists.
Scripted controls proved valid-renderer preservation,
fixed-priority fallback selection,
raw-specification fallback,
restart without redispatch,
image-bearing prompts,
and transaction guards.
The complete unit suite recorded 871 passes and no failures.
Eight guard mutations covered specification identifiers,
realization locators,
transaction replay,
cross-role conflicts,
anchor drift,
fallback priority,
output envelope,
and image transmission.
Initial conflict mutation exposed a control that did not isolate conflict handling.
Commit `98931789a` corrected that control,
a repeated mutation failed it,
and all mutations were restored.
Both providers were wet immediately before live execution.

Fresh Carena execution exhausted all five nodes after 726,466 milliseconds and threw bounded
`ProductionUnavailableError`.
It wrote no candidate or publication receipt:

- specification author completed after 101,952 milliseconds but did not satisfy response schema
- renderer exceeded stream envelope after 214,597 milliseconds
- fidelity fallback stream was cut after 24,686 milliseconds
- authority fallback completed after 170,936 milliseconds but introduced footnote relation defect
- expression fallback completed after 409,737 milliseconds but supplied absent realization locator;
  exact runtime-validator replay also found footnote relation defect

The complete preserved tree contains no `fixed` page.
The two completed fallback documents each carried all 22 manifest source identifiers,
`fallback` mode,
null base digest,
and empty change list.
Those shape facts were insufficient for admission.
All five node records carry distinct structured contract digests.
The reply cache contains only three completed transport replies,
which usage records map to specification,
authority,
and expression nodes.
Cut and overrun nodes have no reply artifact by store design.
The specification schema-mismatch record has neither failure digest nor explicit reply-cache key;
next prototype must close that audit-binding gap.
Candidate B is rejected rather than retried,
repaired from quarantined responses,
or selected without output reading.
Prototype commits are
`de651603d`,
`3c6dbd3c2`,
and
`98931789a`.
Private artifacts remain at
`~/temp/agent/prototype-Carena-B-specification-compiler-20260830/`.
A preserved private copy is at
`~/Downloads/Carena0442-candidate-B-rejected-20260830/`.
Raw responses are operational and contract evidence only.

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

### Rejected Candidate C evidence

Candidate C ran on fresh Carena inputs after scripted full-graph,
restart,
abort,
vision,
and deterministic-admission controls passed.
Its fixed manifest named three concurrent preparation briefs followed by two concurrent complete-document editors.
Both providers were wet at preflight.
The live invocation exhausted that graph after 370,068 milliseconds and threw bounded
`ProductionUnavailableError`.
It wrote no selected candidate,
final digest,
or publication receipt.

One preparation brief completed.
Two preparation responses were unusable:

- source brief exceeded specialist responsibility after 71,635 milliseconds
- expression brief supplied an unlocated anchor after 9,961 milliseconds

Those failures were nonblocking as designed.
Both complete-document editors then received same immutable packet and all image inputs.
Neither response passed deterministic first-candidate admission:

- primary editor completed after 221,049 milliseconds but returned invalid front matter
- fallback editor completed after 233,245 milliseconds but returned source-realization identifiers
  differing from manifest

Failure digests bind these categories without exposing response wording:

- `d28cd3694f5d448d868ec30fae6b14dd05970ce2e09d416495b9a2be25a0008c`:
  `brief item exceeds specialist responsibility`
- `0388f479397f9004f5163be1ecfd156dc7f1bab93bb9d2a90659bb0aa8f31915`:
  `brief item anchor is not located`
- `bc25fe043161a9e242a717ff29287ab4897b128b603c848bf0d42559b62c7cd4`:
  `candidate front matter invalid`
- `2a6cf4aca78445f8872b3c21838f96a1f26b47f5398aa8c4b24258abbc01ee5a`:
  `source realization ids differ from manifest`

Prototype implementation and guard commits are
`e7f69e076`,
`1c92c961a`,
and
`6d1a50dee`.
Result and node records remain private at
`~/temp/agent/prototype-Carena-C-brief-editor-20260830/`.
A private checksum-preserved copy is at
`~/Downloads/Carena0442-candidate-C-rejected-20260830/`.
The copy contains 19 files and occupies 110,332 bytes as measured after preservation.
Raw responses are operational and contract evidence only.
Do not score,
rank,
average,
quote,
repair,
or use them as translation-quality samples.
Candidate C is rejected rather than retried or salvaged with deterministic text mutation.
A materially changed brief-before-prose design would be a new candidate.

## Measured concurrency implications

Production uses 5 Synthetic slots per active model
and exposes 20 aggregate Synthetic slots across the current roster.
Hyper has no provider concurrency ceiling,
with width 64 corroborated on live request shape.
The Hyper account's 1,000 requests-per-hour limit is separate from simultaneous in-flight work.
See `doc/troubleshooting/translation-repair-provider-concurrency.md`.

Candidate C executed its five payloads in two dependency waves before rejection.
Candidate B executed its five payloads in three waves:
specification,
renderer,
then three independent specialist transactions.
Its concurrent specialist wave ended when slowest GLM response completed after 409,737 milliseconds.
Static fixed priority remained deterministic,
but no candidate was usable.
No cross-provider response was required,
and one model never received same canonical substantive prompt twice.

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

## Selection after A, B, and C rejection

No tested candidate is eligible for production selection.
All three exhausted their finite graph without a published page,
so no complete output exists to compare for fidelity,
grammar,
identity,
structure,
or media handling.
Operational evidence cannot be promoted into output-quality evidence.

Historical learning order is:
rejected C > rejected B > rejected A.

Rejected C ranks over rejected B because its two-wave pre-authorship graph had fewer stateful seams,
and one preparation brief was usable;
neither design adopted a candidate.
Rejected B ranks over rejected A because it proved raw-specification fallback,
concurrent bounded specialist execution,
and deterministic transaction controls before exhausting.
Rejected A ranks last because two implementations wrote no output,
and A1 allowed non-producing audit work to withhold complete draft.
This order records design learning only.
No rejected candidate can be retried or selected under same design.

## Candidate D proposal: Immutable-shell slot compiler

Candidate D makes models author translatable content,
not Markdown structure or semantic audit identifiers.
Deterministic parsing derives translatable slots and immutable shell from source plus archive authority.
Slots include headings,
paragraphs,
footnote prose,
and other body-language text.
Existing English front matter remains byte-authoritative,
including contributor identity fields and translated scalar values.
Shell also owns front-matter delimiters and keys,
links,
media references,
footnote relations,
comments,
and node order.

A producer receives full source,
archive,
all page-referenced images,
slot contract,
and complete shell context.
It returns one fixed-key slot record with manifest-derived structural keys such as `s0`.
Exact schema properties bind each translation to one slot without asking model to invent or repeat semantic identifiers.
Compiler reconstructs complete document and applies existing deterministic integrity validation before adoption.
Each producer owns full concrete quality contract across every slot and whole-page relation.

### Fixed call graph

1.  Deterministically derive immutable shell and fixed-key slot record schema.
2.  In parallel,
    ask primary and two statically named fallback authors for complete slot records from same evidence.
3.  Compile and validate all three records independently.
    Adopt first usable candidate by fixed manifest priority,
    never completion order.
4.  Ask one statically named holistic reviser for complete slot record against selected base,
    full source,
    archive,
    and all page-referenced images.
    Adopt usable complete response;
    otherwise preserve selected base byte-for-byte.
5.  Ask one statically named copy editor for complete slot record against latest usable candidate,
    full source,
    archive,
    and all page-referenced images.
    Adopt usable complete response;
    otherwise preserve latest usable candidate byte-for-byte.
6.  Atomically publish and read back final complete document.

Payload ceiling is 5 in three provider waves.
No preparation model,
Gate,
review-only node,
retry,
or response-created work exists.
All five provider nodes return complete candidate records or have no effect.
Each first-wave node can establish first complete candidate.
Role-differentiated canonical prompts preserve uniqueness when one provider and one model fill multiple seats.
Candidate D inherits manifest-bound restart without redispatch,
exact abort identity,
zero transport retries,
and durable transaction states from prototype runtime.
Schema-mismatch handling must additionally persist response digest,
base prompt digest,
and reply-cache key before response becomes spent-unusable.

Model-authored front-matter delimiters,
links,
media,
and footnote markers cannot cause rejection because those bytes are outside model response.
A model can still mistranslate slot content;
only complete-page reading can provide quality evidence.

### Design alternative

Alternative D2 asks each author for unrestricted complete Markdown and validates it after return.

#### D1 pros

- immutable shell removes structural failure classes observed in A,
  B,
  and C from model authority
- fixed-key structural properties remove model-authored semantic identifier values that failed B and C
- one whole-document authorship response still controls voice across every translatable slot
- three independent complete-candidate producers provide bounded fallback before two finite complete-record editors

#### D1 cons

- parser must classify every translatable and immutable region correctly
- sentence relations crossing slot boundaries remain model judgment
- fixed slot boundaries can constrain rhetorical reorganization
- fixed-key schema still needs corpus-sized provider validation

#### D1 measured output evidence and D1.1 correction

Fresh live D1 completed all three concurrent author payloads and published fixed-priority Kimi candidate.
Invocation duration was 347,578 milliseconds.
Published page occupied 20,014 bytes across 55 lines.
All three node records completed,
all reply-cache filenames exactly matched recorded cache keys,
and publication digest matched primary decision digest.
This was first replacement candidate to produce page.

Complete source,
archive,
selected page,
and both alternate candidates were read from beginning through footnote.
Selected Kimi page was not publication-ready:

- shell removed author-supplied leading spaces after inline footnote and link syntax
- one source role was genericized
- concrete overdose,
  repeated-school-year,
  posture,
  and blackmail wording was defective
- one protest relation gained unsupported alongside implication
- source recognition and support content was omitted
- one intentional happiness repetition was collapsed

Complete Qwen alternate preserved role,
overdose,
repeated-school-year,
posture,
recognition and support,
and rhetorical repetition more faithfully.
It also carried literal or awkward phrasing in future relation,
death counterfactual,
queer identity,
and closing imagery.
GLM alternate repeated more selected-candidate defects.
Fixed priority therefore changes from Kimi to Qwen on output evidence,
not completion time or model preference.

D1 artifacts remain private at
`~/temp/agent/prototype-Carena-D-immutable-shell-20260830/`.
Preserved copy is
`~/Downloads/Carena0442-candidate-D1-output-review-20260830/`.
Raw replies are quality evidence only inside this private comparison and are never publication fallback.

D1.1 changes compiler contract rather than retrying same prompts:

- preserve one author-supplied leading space when left shell byte is non-whitespace
- expose adjacent shell context and state that words cannot cross immutable syntax boundary
- use Qwen as fixed-priority base author from complete-page evidence
- add one finite Kimi holistic reviser returning complete slot record
- preserve Qwen base byte-for-byte when reviser is unusable

D1.1 has new manifest digest,
role prompts,
dependency wave,
and payload ceiling.
Scripted controls cover Qwen primary,
Kimi fallback,
GLM reserve,
reviser adoption,
reviser failure preservation,
all-author exhaustion,
and four-node restart without redispatch.
Candidate D1.1 remains unselected until fresh live output is read completely.

Fresh live D1.1 completed four payloads in two waves and published revised document after 732,142 milliseconds.
All node and publication digests bound correctly.
Published file occupied 21,241 bytes across 55 lines.
Complete page,
source,
archive,
all three author candidates,
and revised candidate were read.
The boundary spacing defect and role genericization were corrected,
and source repetition plus footnote details survived.
Page was still not publication-ready:

- opening compensation idiom lacked object and could be read as fabrication
- future relation,
  emotional coercion,
  temporary responsibility,
  and school-suspension phrasing remained source-language calques
- laboratory staining was rendered as ordinary dyeing
- one protest phrase left actor attribution ambiguous
- recognition and support relation was grammatically malformed
- one positive unrestrained expression became morally negative
- closing dialogue remained awkward English

More importantly,
fixed-priority Qwen response echoed source-language slot content instead of translating it.
Schema and deterministic integrity validation incorrectly marked that response complete.
Kimi reviser produced published English page,
but if reviser had been unusable D1.1 would have preserved Chinese base as `page.en.md`.
D1.1 is therefore rejected under tested admission contract.
Its preserved private artifact is
`~/Downloads/Carena0442-candidate-D1.1-output-review-20260830/`.

D1.2 changes canonical prompts and validator identity rather than redispatching D1.1 graph unchanged.
Every slot value containing Unicode Han ideographs is now spent-unusable before compilation.
Guard covers unified ideographs through Extension I plus compatibility supplements;
CJK punctuation is intentionally outside this source-echo check.
This is pinned zh-to-en prototype guard,
not general destination-language classifier.
Prompt adds complete-page idiom,
technical-verb,
pronoun,
and actor-attribution responsibilities.

Scripted source-echo control now records Qwen as `DestinationScriptError` with response,
cache,
and failure digests,
then deterministically selects Kimi fallback.
Restored controls and 871-suite build passed.
GFP mutations proved whole destination-script check and supplementary range boundary each load-bearing.
Four-node v3 restart did not redispatch.
Candidate D1.2 remains unselected until fresh live output is read completely.

Fresh live D1.2 completed four payloads in two waves and published after 689,075 milliseconds.
Published file occupied 21,887 bytes across 55 lines.
All provider nodes completed,
Qwen returned English rather than source echo,
and publication digest matched reviser decision.
Complete final page and all author candidates were read against source,
archive,
footnote,
contributor,
link,
and image.
D1.2 was still not publication-ready:

- 7 visible return-marker glyphs appeared inside two published paragraphs
- dedication punctuation after immutable footnote boundary was awkward
- emotional-coercion wording remained source-language calque
- roommate description and background pronouns remained unclear
- laboratory staining was still mistranslated as ordinary dyeing
- legal statement was rendered as confession
- parent identity became broader relative identity once
- final regret passage claimed narrator had asked Carena not to worry immediately after stating this was never said

D1.2 Qwen base and Kimi revision both carried visible return markers.
Under corrected admission both are unusable;
Kimi fallback did not carry markers but retained more calques.
D1.2 is rejected under tested presentation-admission contract.
Preserved private artifact is
`~/Downloads/Carena0442-candidate-D1.2-output-review-20260830/`.

D1.3 changes prompts and validator identity again.
Deterministic guard refuses visible return symbols,
control pictures,
replacement character,
and raw C0/C1 controls before compilation.
LF and CR remain accepted because compiler normalizes them to spaces.
One static third-wave Qwen copy editor receives latest usable complete candidate,
full source,
archive,
and page image.
It owns whole contract whether holistic reviser succeeded or not,
with general idiom,
technical and legal terminology,
actor,
pronoun,
chronology,
and register responsibilities.

D1.3 remains finite:
5 payloads,
3 waves,
zero retries,
and no response-created work.
Scripted evidence covers copy adoption,
copy failure preserving reviser,
reviser failure followed by copy adoption,
both editors failing while preserving author,
presentation-artifact author fallback,
all-author exhaustion,
and five-node restart without redispatch.
Wave-three SIGTERM records `CallerAbort` and restart publishes reviser without redispatch.
Wave-three SIGKILL leaves dispatched copy node;
restart records `IndeterminateTransmission` and publishes reviser without redispatch.
Stored-completed response revalidation currently fails run rather than degrading node;
manifest and prompt identity prevent cross-validator replay,
but corruption hardening remains production migration work.
Role-distinct fixture digests make preservation observable.
GFP mutations prove artifact refusal,
copy preservation,
author preservation,
and fixed priority load-bearing.
Restored controls and 871-suite build passed.
Candidate D1.3 remains unselected until fresh live output is read completely.
If D1.3 produces another unacceptable page on new prose defect classes,
serial editor layering stops and Candidate D returns to architecture selection.

Fresh live D1.3 completed all 5 payloads in 3 waves and published after 1,508,884 milliseconds.
Published file occupied 21,322 bytes across 55 lines.
All node,
decision,
and readback digests bound correctly;
page contained no Han source echo or visible return marker.
Complete final page and complete holistic-reviser candidate were read against source,
archive,
footnote,
contributor,
link,
and image.
D1.3 final was not publication-ready:

- emotional description became generic and awkward
- future relation remained literal
- responsibility and emotional-coercion language remained calqued
- school-suspension idiom remained opaque
- roommate background reference remained ambiguous
- laboratory staining was still mistranslated as ordinary dyeing
- police entrapment wording was imprecise
- queer identity wording became essentializing and awkward
- final sections drifted from retrospective past into present tense
- closing carefree register became indifference

Complete Kimi reviser already retained future,
emotional-coercion,
school-suspension,
laboratory-staining,
protest-attribution,
and closing-register defects.
Qwen copy editor failed to correct those classes and introduced further generic wording,
fragments,
imprecise police phrasing,
and tense drift.
Serial quality was therefore non-monotonic.
Deterministic validation can prove output usable but cannot prove later usable candidate better than prior candidate;
byte-preservation handles unusable output only.

D1.3 meets documented stop condition.
Candidate D is rejected under tested fixed-priority plus unconditional-serial-adoption design.
No further prompt iteration or serial editor layer is allowed.
Immutable shell,
source-echo guard,
presentation-artifact guard,
and audit runtime remain eligible components for a different architecture;
D graph itself is not eligible for production selection.
All tested Candidates A,
B,
C,
and D are rejected.
Next candidate must use comparative or conditional adoption grounded in concrete located defect classes,
not unconditional later-output adoption or terminal reviewer failure.
Preserved private D1.3 artifact is
`~/Downloads/Carena0442-candidate-D1.3-output-review-20260830/`.

Page evidence includes one `PhotoScroll` asset,
and every page-referenced image reaches every producer.
Entry profile image is presentation metadata from `info.yml`,
not document content or translation evidence,
and remains outside page prompt manifest.

#### D2 pros

- author has unrestricted freedom to reorganize Markdown and prose
- response contract is simpler than slot record plus shell compiler

#### D2 cons

- repeats invalid front matter,
  structure,
  footnote,
  and identifier failure surfaces already measured
- deterministic rejection again happens only after full-document generation spend
- unrestricted structure makes exact authority preservation harder

Within reusable D components,
immutable-shell D1 > unrestricted-Markdown D2,
because D1 removes measured structural admission failures while retaining whole-document authorship;
D2 preserves flexibility by retaining same failure authority already exhausted in three candidates.
This component ranking does not select Candidate D graph.
No tested architecture is selected after complete D1.3 reading.

## Candidate E proposal: quote-bound conditional shell adoption

Candidate E reuses immutable shell,
source-echo refusal,
presentation-artifact refusal,
and transaction runtime,
but discards fixed-priority quality selection and unconditional serial adoption.
Quality evidence is concrete defect class located to fixed candidate and slot,
with exact source and candidate anchors.
No auditor may return naturalness score or unlocated preference.

### Candidate E1 prime fixed graph

1.  Derive immutable shell and fixed-key slot schema.
2.  Ask 3 independent complete authors concurrently.
3.  Ask 3 independent full-contract auditors concurrently to inspect all complete candidates against source,
    archive,
    and page-referenced images.
4.  Validate every finding anchor deterministically against source slot and candidate slot.
5.  Confirm finding only when at least 2 usable auditors agree on candidate,
    slot,
    and concrete defect class.
6.  Select baseline by lexicographic defect tuple:
    fewer severe confirmed findings,
    then fewer total confirmed findings,
    then fixed manifest priority.
7.  Ask one complete resolver to correct selected confirmed-defect slots only.
    Resolver receives no alternate candidate.
8.  Refuse resolver response if any unlocated slot changes or deterministic candidate guard fails.
9.  Ask 3 post-auditors concurrently to inspect baseline and resolution.
10. Adopt resolution only when
    at least 2 post-auditors are usable and resolution finding set is strict subset of baseline finding set.
    Otherwise publish baseline byte-for-byte.
11. Atomically publish and read back selected complete document.

Payload ceiling is 10 in 4 dependency waves.
Every author and resolver returns complete candidate or has no effect.
Auditors cannot withhold existing complete candidate.
No response creates new node,
retry,
Gate,
or work queue.

Finding schema has fixed candidate properties and bounded arrays.
Each entry contains fixed-key slot,
concrete defect class,
exact nonempty source anchor,
and exact nonempty candidate anchor.
Classes are:

- wrong meaning
- omission
- unsupported addition
- identity or attribution
- actor or reference
- chronology
- technical or legal term
- grammar or usage
- tense
- register
- source-language calque

Severe tuple component counts wrong meaning,
omission,
unsupported addition,
identity or attribution,
actor or reference,
chronology,
and technical or legal term.
Second tuple component counts every confirmed finding.
No free-form severity,
score,
or naturalness verdict enters selection.
Quorum agrees on candidate,
slot,
and defect class rather than exact anchor text;
anchors prove each claim is located while allowing auditors to quote different spans of same defect.
One invalid or unbound finding makes whole auditor response unusable.
Strict response loss is preferred over silently pruning unauditable claims;
reduced-quorum table then preserves finite baseline behavior.
Total finding comparison can still reward shared auditor blind spots,
so retained-output calibration must reproduce known human comparisons before graph spend.

Reduced-quorum behavior is manifest-owned:

- 3 usable auditors require any 2 agreeing
- 2 usable auditors require both agreeing
- 1 or 0 usable auditors produce no confirmed findings and fixed-priority baseline
- fewer than 2 usable post-auditors always preserve baseline

Post-audit adoption compares whole documents only.
Per-slot mixing is forbidden because it would recreate transaction conflicts and lose whole-page voice.
Resolution must change at least one confirmed-defect slot and no other slot.
Resolution finding keys must be strict subset of baseline finding keys;
new confirmed defect or unresolved key preserves baseline.

### Alternatives

#### E1 prime pros

- replaces blind author priority with quote-bound comparative evidence
- prevents D1.3 regression through conditional whole-document adoption
- resolver changes are limited to auditor-located slots
- auditor failure preserves complete baseline and never suspends publication

#### E1 prime cons

- 10 payloads and 4 waves increase latency
- auditor agreement can miss shared model blind spots
- terse bounded matrices need provider conformance validation
- resolver may fail to correct located defects and then has no effect

#### E3 pros

- author comparison fixes D1 blind selection with fewer waves
- no resolver means no later-output regression

#### E3 cons

- every measured first-wave author candidate remained below publication bar
- selection alone cannot exceed measured author ceiling

#### E2 pros

- authors receive shared source-risk context before writing
- one brief can focus all candidates on difficult source relations

#### E2 cons

- repeats Candidate C brief-before-prose dependency
- one brief defect correlates across every downstream author
- brief producer does not establish complete candidate

Ranking:
E1 prime > E3 > E2,
because E1 prime addresses both blind selection and later regression;
E3 addresses blind selection but cannot repair measured author defects;
E2 repeats rejected shared-preparation dependency.
Candidate E1 prime entered retained-output calibration before any new candidate publication spend.

### Rejected Candidate E1 prime calibration

Candidate E1 prime dispatched 9 zero-retry auditor payloads in one dependency wave against retained D outputs.
The bounded run ended after 1,170,562 milliseconds.
Strict whole-response admission made only 3 responses usable:

- D1 comparison had 0 usable auditors and fell back to known-inferior primary author
- D1.3 post comparison had 1 usable auditor and no quorum
- seeded comparison had 2 usable auditors and confirmed all 3 planted defects
- 5 responses parsed as JSON but failed caller guard
- 1 GLM D1.3 response ended with `StreamCutShortError`

Every parsed provider reply was already stored privately by prompt digest.
Digest-bound replay proved all 5 caller-guard failures were structurally valid ballots.
Across those ballots,
72 of 80 findings had exact source and candidate anchors and unique candidate-slot-class keys.
Strict response admission discarded those 72 located findings together with 3 duplicates,
3 source-anchor misses,
and 2 candidate-anchor misses.
Candidate E1 prime is rejected under whole-response admission;
it cannot proceed to resolver or publication spend.
Private evidence is preserved at
`~/Downloads/Carena0442-candidate-E1-prime-calibration-rejected-20260830/`.

### Candidate E1 double-prime admission

Candidate E1 double-prime changes audit admission and decision semantics rather than changing prose prompts:

1.  Structurally valid fixed-candidate ballot becomes usable.
2.  Each finding is independently admitted only when exact source and candidate anchors bind within named slot.
3.  Duplicate candidate-slot-class finding and unbound finding are excluded and recorded by candidate,
    slot,
    class,
    and deterministic rejection reason.
4.  Each usable auditor independently applies severe-count,
    total-count,
    then manifest-priority tuple to complete author candidates.
5.  At least 2 auditors must select same baseline.
    Otherwise fixed-priority baseline is published with explicit `evidenceFloorMet: false`;
    such run cannot qualify as architecture quality evidence.
6.  Resolver receives union of admitted located findings for selected baseline and may change only those slots.
7.  Each usable post-auditor independently establishes nonempty-baseline strict-subset relation.
8.  At least 2 post-auditors must establish strict subset before resolution can be adopted.
    Otherwise baseline survives byte-for-byte.

Auditor prompts omit manifest candidate priority.
Auditors may evaluate output from same model family,
but exact anchors,
independent role prompts,
and 2-vote decision prevent one self-review from controlling selection or adoption.
Finding-empty ballot abstains rather than voting fixed priority.
Every post-auditor ballot persists baseline keys,
resolution keys,
new resolution keys,
approval,
and whether auditor shares resolver model identity.
A third dissent is recorded but does not veto 2 independent approvals;
this implements stated 2-auditor adoption rule rather than silently changing it to unanimity.

Zero-spend digest-bound replay over exact E1 prime provider replies admitted every completed ballot:

- D1 had 3 usable auditors;
  votes were 2 for Qwen fallback,
  with one empty admitted ballot abstaining,
  reproducing complete-page comparison
- D1.3 had 2 usable auditors;
  each located at least 1 concrete defect and neither established resolution strict subset,
  reproducing copy-editor rejection
- seeded arm had 3 usable auditors and retained quorum confirmation for every planted slot

Replay completed in 48 milliseconds without provider calls.
It calibrates audit admission and decisions only.

Full scripted graph fixes ceiling at 10 payloads across 4 waves and proved:

- base run selected fallback author on 3 defect-based votes,
  constrained resolver to located slot,
  received 3 post approvals,
  and adopted complete resolution
- all-author failure terminated with `ProductionUnavailableError` after 3 author nodes and no later calls
- no usable author-audit ballot published fixed-priority baseline with `evidenceFloorMet: false`
- invalid or unlocated resolver,
  invalid post wave,
  and regression post wave each preserved baseline byte-for-byte
- 2 usable approving post auditors plus 1 unusable auditor adopted;
  2 approvals plus 1 located dissent also adopted and retained dissent keys
- completed restart left 31 non-result files byte-identical,
  all 10 node mtimes unchanged,
  and normalized result byte-identical
- resolver SIGTERM restart retained exact `CallerAbort`,
  did not redispatch,
  and published baseline
- post SIGTERM recorded 3 `CallerAbort` nodes;
  restart preserved their digests and baseline
- post SIGKILL left 3 dispatched nodes;
  restart converted all to `IndeterminateTransmission` and preserved baseline
- types,
  local controls,
  and complete suite passed with 871 suite verdicts and no failures

Restored GFP mutations separately proved located-only resolver change,
nonempty resolver change,
2-vote post floor,
strict-subset new-key exclusion,
empty-ballot abstention,
and hidden-priority refusal.
Earlier admission mutations proved structural slot membership,
source and candidate anchor binding,
duplicate pruning,
and author-selection vote floor.
Every mutation failed named control and restored suite again passed 871 verdicts with no failures.

### Rejected E1 double-prime Hyper-only output

Fresh Hyper-only run completed in 1,142,906 milliseconds and published complete Qwen baseline.
Run proved one-provider bounded operation but did not produce publication-ready page:

- Qwen author completed
- Kimi author consumed 16,000 output tokens and returned empty content,
  then structural guard recorded schema mismatch
- GLM author and relation auditor failed locally with `NoProviderForModelError`
- 2 usable auditors inspected only Qwen candidate and both selected it
- runtime incorrectly marked `evidenceFloorMet: true` although no comparative candidate existed
- auditors located findings in 7 slots
- resolver completed but changed 13 slots,
  including 6 outside located set,
  so located-only gate rejected whole response before post audit
- publication correctly preserved Qwen baseline byte-for-byte

Complete-page reading rejected baseline for concrete defects in existing classes:
unsupported addition,
source-detail omission,
role generalization,
technical-term misuse,
actor and device-reference ambiguity,
wrong causal basis,
chronology wording,
and lost rhetorical repetition.
Source shell,
front matter,
contributor link,
footnote relation,
page media reference,
Han-script refusal,
presentation-artifact refusal,
and publication readback remained correct.
Page image showed memorial,
trans identity,
and chemistry context consistent with translated content and no additional text obligation.
Private evidence is preserved at
`~/Downloads/Carena0442-candidate-E1-double-prime-hyper-only-output-review-20260830/`.

This rejects E1 double-prime output and its current evidence-floor predicate,
not reusable architecture.
Candidate E1 triple-prime correction requires:

- at least 2 usable author candidates from distinct model identities before comparative floor can pass
- at least 2 agreeing auditor model identities;
  this necessarily includes external vote because selected author has 1 model identity
- `evidenceFloorMet: false` publication when any floor condition fails
- Hyper-only reserve author and auditor selected only after structured vision and complete-document validation
- persisted schema-mismatch detail distinguishing unparseable output from caller-guard rejection
- evaluation of 2 concurrent fixed resolver seats as alternative to one over-eager resolver nullifying every located fix

No defect wording from this run may enter new prompts.
Retained output remains negative calibration evidence only.
### Rejected E1 triple-prime under active Hyper roster

E1 triple-prime comparative-floor correction is implemented and tested:

- candidates and ballots persist model identity
- evidence requires at least 2 votes,
  2 candidate model identities,
  and 2 agreeing auditor model identities
- one candidate or repeated auditor identity cannot satisfy floor
- schema mismatch preserves stable reason distinguishing guard rejection,
  invalid JSON,
  truncated thinking,
  and other mismatches
- controls,
  retained replay,
  scripted one-author behavior,
  restored build,
  and 871 suites pass
- GFP independently proves candidate diversity,
  auditor diversity,
  parser-reason,
  and persistence guards load-bearing

Hyper reserve evaluation then exhausted current active roster.
MiniMax M3 was only distinct image-capable integrated model.
Its quote-bound auditor completed strict response with 4 admitted findings and 1 duplicate pruned.
Its complete author consumed requested 32,000 output tokens,
ended `max_tokens`,
and returned unparseable JSON missing final outer brace.
Node correctly persisted `spent-unusable` with `schema-mismatch` and `unparseable-json` detail.
Caller repair is forbidden,
and prompt uniqueness forbids redispatching same model plus canonical author prompt with changed ceiling.
Schema-invalid response remains operational evidence and was not read as page-quality evidence.

No current active Hyper model distinct from Qwen and Kimi satisfies image,
complete-author,
and quote-bound-auditor contracts.
Full triple-prime graph run would therefore begin from known failed comparative-author precondition:
with Hyper alone it must set `evidenceFloorMet: false`,
skip conditional repair,
and republish same Qwen baseline already rejected by complete-page reading.
Further resolver controls cannot repair absent comparative evidence.
Running that graph would spend payloads without changing admissible outcome,
so it is not performed.

Private MiniMax evidence is preserved at
`~/Downloads/Carena0442-minimax-reserve-validation-rejected-20260830/`.
Technology vet report is
`doc/audit/tech-candidate-e-hyper-reserve-model-vet-2026-08-30.md`
on main branch.

### Rejected E1 triple-prime after Hyper roster expansion

A frozen roster-expansion evaluation then screened every out-of-roster Hyper vision row.
Kimi K2.6 and K2.7 Code exited before spend
because direct-service documentation did not support required named forced-tool schema
under default or mandatory thinking.
Hyper gateway translation remained unprobed,
so this is conservative integration screening rather than observed gateway incompatibility.
Owner-excluded Qwen3.8 Max remained excluded.

Five Qwen alternatives each received one canonical complete-author payload and one quote-bound D1-auditor payload.
All 10 zero-retry Hyper arms completed strict schema in one dependency wave.
Every compiled author page was read completely against pinned source,
archive,
and page-referenced image.
One analyst's complete-page review found all 5 failed publication-ready author hard gate:
1 hid severe semantic truncation behind populated slot keys,
3 retained concrete grammar,
reference,
provenance,
or source-carryover defects,
and strongest complete candidate introduced unsupported actor gender plus fidelity and English defects.
Strongest auditor cannot satisfy reserve requirement because same model's author failed.
All runtime survivors also remain Qwen-family siblings,
so distinct ids would not prove cross-family independence.

No roster candidate is recommended.
Prompt uniqueness forbids repeating any model plus canonical prompt pair from this run.
Private artifacts and located review are retained under
`~/Downloads/Carena0442-hyper-roster-expansion-validation-20260830/`.
Full technology evidence is in
`doc/audit/tech-candidate-e-hyper-roster-expansion-vet-2026-08-30.md`.

Candidate E1 double-prime and triple-prime are rejected under tested active-roster and expansion designs.
Reusable components remain immutable shell,
per-finding admission,
model-diverse comparative floor,
located-only resolution,
strict-subset adoption,
finite runtime,
restart,
abort identity,
and provider-isolation controls.
No Candidate E output is eligible for publication or production integration.

Final Candidate E learning order:
rejected expanded E1 triple-prime > rejected active-roster E1 triple-prime >
rejected E1 double-prime > E3 > E2 > rejected E1 prime.
Expanded triple-prime proves finite roster exhaustion;
active-roster triple-prime corrects false comparative evidence but lacks candidate diversity;
double-prime recovers located evidence but falsely passed one-candidate floor;
E3 cannot exceed measured author ceiling;
E2 repeats Candidate C dependency;
E1 prime discarded most valid ballot evidence.

## Measured selection outcome

No replacement architecture is selected.
Tested deployment candidates across A through E have zero survivor under fixed completion and quality contract.
A1 ended in `StreamCutShortError` and A2 in bounded `ProductionUnavailableError` before adoption.
B and C failed complete-page quality.
D failed complete-page quality after repeated bounded refinements.
Active-roster E lacked qualifying reserve and did not run full triple-prime graph;
expansion E produced distinct ids but every tested author failed complete-page quality.

Production replacement planning remains blocked.
Continuation requires fresh finite architecture definition based on measured failures,
not another serial editor,
retry loop,
Candidate E payload,
or relaxation of publication-ready output.
Semantic slot truncation,
identity fabrication,
and same-family correlation are now explicit design inputs.

## Next definition round

### Rejected Candidate F: witness-switched donor assembly

Candidate F would remove Candidate E resolver
and let deterministic compiler replace only whole immutable-shell slots copied from already complete candidates.
Auditors would compare baseline and donor defect sets;
a donor slot would be eligible after 2 independent per-auditor strict-subset findings,
then 2 post auditors would compare baseline and composite.

#### Pros

- Resolver cannot author unsupported prose.
- Every unchanged slot remains byte-identical.
- Donor substitutions preserve shell structure and bounded authority.
- Static graph can fit 5 retained authors,
  3 comparative auditors,
  and 2 post auditors in 3 dependency waves.

#### Cons

- Reported defect sets are open-world under-approximations.
  Missing donor finding is not evidence donor is clean.
- Two auditors can miss same new donor defect,
  especially among correlated model families.
- Whole-slot mixing can damage document voice and cross-slot reference.
- Empty finding set can mean abstention or missed evidence rather than clean coverage.
- Candidate identity must be removed from comparison key,
  while slot plus defect class is too coarse to distinguish source obligations.

Candidate F is rejected at design gate.
It improves mutation safety over E but cannot turn missing findings into quality proof.
A closed-world source-obligation checklist and explicit checked-clean states
would change interface enough to be different candidate.

### Candidate G proposal: verified realization ledger

Candidate G moves seam to whole-candidate admission against closed-world source obligations.
No prose resolver,
donor splice,
postdraft editor,
or generated work exists.
Model-produced realization is claim;
independent verification is evidence,
not mathematical proof.

```ts
export type SourceSpan = {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly digest: string;
};

export type SourceObligation = {
  readonly id: ObligationId;
  readonly kind: 'clause' | 'relation' | 'identity' | 'link' | 'media' | 'format' | 'archive-authority';
  readonly sourceSpans: readonly SourceSpan[];
  readonly relationEndpoints: readonly ObligationId[];
  readonly targetCardinality: 'one-or-more' | 'shell-owned';
  readonly authority: 'source' | 'archive-allowed' | 'shell-locked';
  readonly evidenceDigest: string;
};

export type TargetAnchor = {
  readonly slotKey: SlotKey;
  readonly startOffset: number;
  readonly endOffset: number;
  readonly digest: string;
};

export type RealizedCandidate = {
  readonly candidateId: CandidateId;
  readonly modelId: ModelIdentity;
  readonly candidateDigest: string;
  readonly slots: Readonly<Record<SlotKey, string>>;
  readonly realization: Readonly<Record<ObligationId, readonly TargetAnchor[]>>;
};

export type CandidateVerification = {
  readonly candidateId: CandidateId;
  readonly candidateDigest: string;
  readonly obligations: Readonly<Record<ObligationId, {
    readonly status: 'preserved' | 'defect';
    readonly verifiedTargetAnchors: readonly TargetAnchor[];
  }>>;
  readonly globalChecks: Readonly<Record<GlobalCriterion, 'clean' | 'defect'>>;
  readonly findings: readonly LocatedFinding[];
};

export type VerifierBallot = {
  readonly verifierModelId: ModelIdentity;
  readonly manifestDigest: string;
  readonly candidates: Readonly<Record<CandidateId, CandidateVerification>>;
};
```

Clause obligations carry contiguous parsed source spans.
Relation obligations name endpoint obligation ids and source connective spans.
Identity obligations bind canonical person and contributor forms.
Link and media obligations bind exact destination or asset digest.
Format and archive-authority obligations identify shell-owned or explicitly archive-allowed regions.
Target offsets disambiguate repeated phrases;
string equality alone never locates anchor.
Located finding names exactly 1 obligation id or global criterion,
defect class,
manifest-owned source spans,
and zero or more exact target anchors.
Runtime assigns candidate id,
model id,
and candidate digest after validating raw author slots and map;
author cannot self-assert those bindings.

#### Fixed call graph

1.  Deterministically split source shell text into bounded clause obligations from parsed source offsets.
    Add identity,
    relation,
    link,
    contributor,
    media,
    formatting,
    and archive-only obligations without model work.
2.  In wave 1,
    ask fixed author roster concurrently for complete immutable-shell slot map plus total realization ledger.
    Every author owns full fidelity,
    completeness,
    identity,
    grammar,
    reference,
    tense,
    relation,
    and register contract.
3.  Admit candidate only when every non-shell obligation has required anchor cardinality,
    every target offset and digest binds exact declared slot,
    every shell key appears once,
    and existing deterministic guards pass.
    Mapping remains untrusted semantic claim.
4.  In wave 2,
    ask fixed verifier roster concurrently to inspect every admitted whole candidate against complete source,
    archive,
    realization ledger,
    and all page-referenced images.
    Candidate aliases hide author model and priority.
    Every verifier independently marks every candidate-obligation pair and every global criterion.
5.  Admit ballot only when verifier identity,
    manifest digest,
    every candidate digest,
    full candidate-obligation matrix,
    and global-check matrix match manifest.
    Preserved status requires verifier-confirmed exact target offsets.
    Defect status requires finding linked to obligation or global criterion.
    Omission may have no target anchor;
    unsupported addition uses target-only global finding.
    Empty,
    partial,
    or duplicate ballot abstains.
6.  Candidates with 2 complete clean ballots from distinct verifier model identities rank ahead.
    Dissent persists.
    Hidden fixed priority selects within same evidence class.
    Same-family identity remains correlated evidence,
    not independence proof.
7.  Calibration writes selected whole candidate only to private review root,
    with `evidenceFloorMet: false` when no candidate has 2 clean ballots.
    Verifier failure cannot withhold structurally usable private candidate.
    Calibration never calls production `PublicationPort` or returns `CompletedEntry`.
    No candidate text is mixed or revised after authorship.

Prototype ceiling is 7 payloads:
4 complete authors and 3 complete-candidate verifiers in 2 dependency waves.
Before live spend,
serialized worst-case author and verifier schemas must fit 32,000-token project ceiling with measured headroom.
Qwen3.8 Flash previously used 27,922 completion tokens to audit only 3 candidates,
so unmeasured 4-candidate matrix is blocker rather than assumed fit.
Manifest binds exact obligation ledger,
author and verifier identities,
source,
archive,
shell,
media,
schemas,
provider mode,
and fixed priority.
Each model plus canonical substantive prompt receives at most 1 provider payload.
One wet provider supplies whole manifest;
cross-provider responses are never correctness dependency.

#### Stage postconditions

Deterministic obligation ledger is total over parsed source text but makes no semantic claim.
Author realization anchors cannot certify their own meaning.
Verifier record is structurally complete only when it covers every candidate-obligation pair and every global criterion,
binds candidate digests,
and carries verifier model identity.
Verifier independently checks semantic source-to-target realization;
author map is only navigation claim.
Candidate selection never treats missing finding as checked-clean.
Verifier timeout,
refusal,
or malformed response has no effect and never suspends calibration.
Every model node receives `photo1.webp` and never presentation-only profile image.
Restart,
indeterminate transmission,
caller abort,
cache eligibility,
and prompt uniqueness reuse Candidate E proven controls.

#### Pros

- Makes unmapped source clauses visible even when every slot key is populated.
- Whole candidate preserves voice and cross-paragraph coherence.
- Closed-world coverage replaces Candidate E open-world defect-count comparison.
- Verifiers inspect output-specific identity,
fidelity,
and English defects before selection.
- No model can create repair work or mutate selected prose.
- Finite 2-wave graph remains highly parallel.

#### Cons

- Exact anchor can support wrong semantic mapping;
  verification remains fallible judgment.
- Author ledger expands output and may increase truncation risk.
- Valid mapping can falsely attach omitted meaning to unrelated exact anchor.
- Large all-candidate verifier schema may exceed output ceiling.
- Fixed-priority private review below evidence floor does not solve production normal-return contract.
- Same-family verifier agreement remains correlated even with distinct model ids.
- Production eligibility still requires complete-page acceptance across repeated isolated runs.

### Next-round ranking

Ranking:
Candidate G > rejected Candidate F.
G ranks above F because explicit total coverage can distinguish checked-clean from unobserved,
whereas F treats absent donor findings as improvement evidence.
F retains safer mutation than Candidate E but cannot close donor-defect blind spot.

Candidate G enters scripted controls and retained-output calibration only.
Controls must cover omitted clause,
fabricated identity,
wrong relation,
unsupported addition,
repeated anchor,
archive-regurgitated text,
partial and empty ballot,
dissent,
all-verifier failure,
and known Qwen3.6 Plus truncation with concise valid negative control.
Restart,
indeterminate transmission,
cache binding,
prompt uniqueness,
provider isolation,
and exact caller abort must pass for both waves.
It is not selected for production.
Live calls are authorized;
Candidate G did not proceed before schema-size measurement,
implementation review,
GFP controls,
and advisor review.

### Candidate G envelope disposition

Candidate G failed the compact schema-stress gate used on 2026-08-31.
The output-envelope boundary resolution supersedes that gate as an architecture rejection criterion.
No live Candidate G payload was sent.

The pinned Carena shell has 23 slots and 134 obligations.
The strict author schema serialized to 2,994 bytes;
the four-candidate verifier schema serialized to 7,397 bytes.
Compact response witnesses excluded optional JSON whitespace,
which is not bounded by JSON Schema.

Four compact schema-valid stress witnesses were serialized.
They are not claimed as mathematical tokenizer extrema.
All four pass committed structural guards,
but none is candidate-admissible or evidence-admissible:
the author witnesses violate target cardinality or presentation requirements,
the lower verifier witness has defect statuses without findings,
and the upper verifier witness repeats findings against clean statuses.
Their measurements were:

- author lower witness:
  7,294 bytes,
  2,432 tokens under the project three-bytes-per-token estimate,
  and 2,528 tokens under the official Qwen3.6-27B tokenizer;
- author upper stress witness:
  2,820,201 bytes,
  940,067 estimated tokens,
  and 2,317,000 Qwen tokens;
- four-candidate verifier lower witness:
  93,488 bytes,
  31,163 estimated tokens,
  and 46,671 Qwen tokens;
- four-candidate verifier upper stress witness:
  437,076 bytes,
  145,692 estimated tokens,
  and 139,331 Qwen tokens.

The witness SHA-256 digests in the same order are:

- `6f931d1f874d583816823f8b2e68036fb3d8ca22cff04b93d1dc5e9f190ed38e`;
- `cc8ec3c3902a4090966a892036a54fceb67471d44fbf24e8c646aeb636179c22`;
- `3ca1631bdfd98dd894a567386ad09d70bfc2278c5b3f44621cb8f19780d73f59`;
- `88039b143e279111d27b7f7b3292314ba2694a39fd775c11e2d49b18bed011aa`.

The exact tokenizer was `Qwen/Qwen3.6-27B` at commit
`6a9e13bd6fc8f0983b9b99948120bc37f49c13e9`,
loaded directly from `tokenizer.json` through Python `tokenizers` 0.22.2,
with no chat-template wrapper.
The completion ceiling is 32,000 tokens.
The author upper stress witness tokenized with Qwen3.6-27B exceeded it by 2,285,000 tokens.
That proves the schema permits responses outside the provider envelope.
It does not prove that a working model can return those responses under the manifested transport cap,
and deterministic admission still gives truncated output no effect.
The verifier token counts remain Qwen-specific evidence and are not attributed to MiniMax or DeepSeek tokenizers.
Measurement tooling and structural controls are committed as `a15bd65df`.

A private compact-wire experiment kept three disjoint author and finding anchors,
made runtime own target digests,
and replaced repeated ids with manifest indexes.
It reduced usable witnesses,
but a source-derived per-slot prose cap remained substantively unproved,
and schema-valid control,
escape,
and emoji arms still exceeded the ceiling.
The experiment was reverted rather than weakening author authority or declaring semantic invalidity a transport bound.

Candidate G is not production-selected because it has no qualified author.
Its four-candidate verifier completion headroom is unproven under planned model tokenizers and blocks pre-spend.
Its reusable findings are closed-world obligation coverage,
manifest-ordered status arrays,
runtime-owned digests,
and the distinction between schema maximum and semantically acceptable output.
Any Candidate G continuation must measure complete provider-returnable verifier responses without capping publication-quality prose or dropping split-anchor evidence.

### Candidate H proposal: closed-world verdict with bounded defect evidence

Candidate H removes author self-realization and separates complete checking from exhaustive defect narration.
A verifier still returns one status for every source obligation and global criterion,
but status arrays are manifest-ordered compact codes rather than repeated objects.
Concrete findings remain exact and split-anchor-capable.

```ts
export type CandidateHAuthorResponse = {
  readonly slots: Readonly<Record<SlotKey, string>>;
};

export type CandidateHFinding = {
  readonly scope: 'obligation' | 'global';
  readonly manifestIndex: number;
  readonly defectClassIndex: number;
  readonly targetAnchors: readonly TargetAnchor[];
};

export type CandidateHVerification = {
  readonly candidateId: CandidateId;
  readonly candidateDigest: string;
  readonly obligationStatuses: readonly ('preserved' | 'defect')[];
  readonly globalStatuses: readonly ('clean' | 'defect')[];
  readonly overflow: boolean;
  readonly findings: readonly CandidateHFinding[];
};
```

Every author returns one complete immutable-shell slot map and owns the full quality contract.
Runtime attaches candidate identity,
model identity,
document digest,
slot digest,
and manifest binding.
No author ledger or author-generated audit claim is required.

Every verifier receives complete source,
archive,
shell,
closed-world obligation ledger,
all admitted anonymous candidates,
and every page-referenced image.
Each candidate response has exactly one status per obligation and global criterion.
A clean candidate is one whose statuses are all preserved or clean,
whose `overflow` is false,
and whose findings are empty.

A defective candidate does not need an exhaustive prose dossier to lose:

For manifested per-candidate finding cap `C` and defect-status count `D`:

- `overflow` must equal `D > C`;
- with `overflow: false`,
  every defect status has one unique concrete finding,
  every finding links to a defect status,
  and clean statuses have no findings;
- with `overflow: true`,
  findings have length `C`,
  each finding links to a distinct defect status,
  and the candidate is unconditionally unclean;
- an absent finding never makes a candidate cleaner,
  because selection uses explicit complete status arrays rather than finding counts.

These findings are bounded certificates that a candidate is unclean,
not an exhaustive defect inventory.
This keeps concrete evidence while bounding narration.
`overflow` is not truncation recovery or response-created work.
It is a manifested terminal classification saying that bounded evidence already proves the whole candidate cannot win.
No resolver,
donor splice,
editor,
retry,
or dynamic node follows it.

#### Candidate H fixed graph

1.  Build immutable shell and closed-world obligation ledger deterministically.
2.  Run three whole-document authors concurrently.
3.  Admit every complete candidate independently;
    unusable author output has no effect.
4.  Run three all-candidate verifiers concurrently.
5.  Admit only whole all-candidate ballots covering exactly the candidate set derived from one complete author-wave settlement.
    Bind settlement digest,
    candidate digests,
    exact finding indexes,
    split target anchors,
    and correct overflow accounting.
    One malformed candidate row makes the whole verifier abstain;
    retained row evidence is audit-only and cannot vote.
6.  Set calibration evidence floor only with at least two admitted candidate model identities and two complete clean ballots from distinct verifier families other than candidate's own author model.
    Hidden manifest priority supplies private calibration fallback below the evidence floor.
    Candidate's own verifier ballot cannot certify it clean,
    while explicit self-model defect still counts as dissent.
    Production eligibility additionally requires no admitted dissenting defect or overflow ballot.
7.  Write only to private review root;
    no production publication is authorized by calibration status.

The proposed graph has at most six payloads in two dependency waves.
One wet provider remains sufficient.
Every node receives all page-referenced images.
A verifier failure abstains and cannot suspend or mutate a complete candidate.
Candidate aliases and ballot order are derived independently of author identity and fallback priority;
priority exists only in private manifest metadata.
Wire anchors may omit repeated digests only when runtime recomputes and persists exact candidate-substring SHA-256 values,
and restart reproduces byte-identical enriched evidence.
Omission findings remain source-located by obligation index;
other findings require target anchors.

#### Candidate H options considered

Candidate H3,
the all-candidate compact matrix with bounded defect evidence,
is preferred.
It preserves one verifier view across candidates,
keeps the six-payload graph,
and makes overflow an explicit losing verdict.
Its cost is reduced per-defect exhaustiveness after the cap.

Candidate H1 would run one verbose verifier payload per candidate.
It preserves familiar verbose rows,
but expands the graph to twelve payloads and leaves one-candidate worst-case findings near the output ceiling.

Candidate H2 would split each verifier-candidate pair into status and finding payloads.
Each payload is smaller,
but the graph reaches twenty-one payloads and independently generated halves can disagree,
turning a working verifier into an abstention.

Ranking:
H3 > H1 > H2.
H3 ranks above H1 because it keeps closed-world comparison in one bounded ballot without multiplying calls.
H1 ranks above H2 because one atomic verifier response is more auditable than independently generated status and evidence halves.

Candidate H is an implemented private calibration prototype,
not yet a viable successor.
The output-envelope boundary resolution supersedes abstract schema stress as architecture rejection.
The verifier finding cap is frozen at `C = 8`.
The active evidence still contains no qualified author roster:
all five Qwen expansion authors failed complete-page review,
and MiniMax returned an unusable author response.

Before spend,
controls must prove complete arrays,
no absent-as-clean path,
overflow accounting,
three disjoint anchors,
hidden priority,
author and verifier diversity,
provider isolation,
restart,
indeterminate transmission,
and exact concurrent abort cleanup.
Maximum compact schema witnesses and realistic complete Carena author outputs must be tokenized under every planned model tokenizer available;
unavailable tokenizers remain explicit roster blockers rather than guessed equivalence.

### Candidate H envelope disposition

Candidate H is not production-selected.
Its compact schema-stress witness proves that the schema is overpermissive,
not that the provider-returnable author envelope is unbounded.
Its slot-only author uses the immutable-shell response envelope from Candidates D and E:
23 required slot strings,
each permitting 20,000 characters.
A Candidate H-specific compact stress witness was constructed against the schema returned by `slotResponseFormat` as
`{ slots: Record<SlotKey, string> }`.
`slotDocumentGuard` accepted the witness.
It measured 2,760,208 bytes and 2,300,131 tokens under `Qwen/Qwen3.6-27B` tokenizer commit
`6a9e13bd6fc8f0983b9b99948120bc37f49c13e9`.
Its SHA-256 is
`bbd5a9efc8c16d465d784525c8396f2ba1ca467e6a57ff2df110302ef22f46a8`.
The author response schema itself measured 1,664 bytes.
These token counts are Qwen3.6-specific because Candidate H has no frozen qualified roster.
Post-transport presentation rejection cannot enforce the output envelope.

No source-derived prose cap is authorized.
The five retained complete Qwen pages prove only that those rejected outputs fit their measured lengths;
they do not prove that a publication-ready candidate cannot require more.
The compact schema-stress failure no longer rejects Candidate H by itself.
Candidate H code is implemented on the finite-prototype branch,
but it is not production-selected.
Its completed live calibration rejects the current roster and ballot interface as recorded in
"Rejected Candidate H live calibration."

Candidate H contributes one reusable interface idea:
complete status arrays plus exact overflow algebra can bound defect narration without treating missing findings as clean evidence.
That idea may be reused only by a successor whose author boundary has a defensible envelope and whose roster contains a completely read acceptable author.

### Output-envelope boundary resolution

Candidate G and Candidate H prove that the current schemas are overpermissive.
They do not prove that every free-prose author interface exceeds the provider envelope.
Four different response sets must not be conflated:

1.  abstract JSON instances satisfying response schema;
2.  compact canonical serializations of those instances;
3.  provider-returnable output under the manifested completion-token cap;
4.  provider-returnable responses admitted by deterministic publication guards.

Optional JSON whitespace makes the set of textual schema serializations unbounded unless a canonical grammar is part of the contract.
Provider-returnable output is bounded by the provider completion cap by definition.
Deterministic admission is a subset of returned output.
The current measurements establish only that schema-valid compact stress instances can exceed the cap and that some pass structural guards before later rejection.
The provider implementation of JSON Schema string-length semantics and whitespace generation has not yet been measured.

Task #60 operationalized the pre-spend gate as a compact schema-stress maximum.
That interpretation is superseded.
The original normal-run objective qualifies success by a working model,
so pre-spend acceptance covers provider-returnable responses that deterministic guards can admit.
Candidate G and Candidate H are not rejected by their schema-stress witnesses alone.
Their lack of a qualified author and complete-page quality evidence remain independent blockers.

#### I1: transport-limited deterministic-admission boundary

Treat manifested provider completion tokens as the hard transport maximum.
Keep fixed-key immutable-shell slot JSON and require realistic plus adversarial deterministic-admission witnesses,
model-specific completion tokenization with framing reserve,
and full-page author acceptance before spend.
Schema-valid but semantically invalid floods may truncate and become no-effect output.

Pros:
publication prose and contributor authority remain unrestricted inside the actual provider envelope;
existing structure and restart guards survive.

Cons:
not every abstract schema-valid compact stress instance can complete;
model-specific token accounting and provider behavior become part of evidence.

#### I3: measured repository prose budget

Add per-slot or aggregate limits measured from source and accepted outputs.
This mechanism can be combined with I1,
but it cannot define correctness by itself.

Pros:
simple preflight arithmetic and smaller unusable-output region.

Cons:
cap can reject the only publication-quality wording;
retained rejected pages do not prove an acceptable-page ceiling.

#### I2: token-id experiment

Ask authors to print tokenizer ids and decode them into prose.
This is not an exact provider-token envelope as previously stated:
decimal digits,
commas,
JSON framing,
whitespace,
special tokens,
and invalid sequences consume provider completion tokens independently of decoded ids.

Pros:
model-specific decoded length is explicit.

Cons:
wire accounting remains nontrivial;
models are not calibrated for reliable tokenizer-id authorship;
provider and model swaps change encoding.
No implementation is warranted without a zero-spend reliability prototype.

Ranking:
I1 > I3 > I2.
I1 ranks above I3 because it preserves prose authority and matches truncation-as-unusable semantics.
I3 ranks above I2 because a measured aggregate budget is implementable despite editorial risk,
while token-id authorship has neither reliable generation nor exact provider accounting.

Provider research completed on 2026-08-31:

- Hyper documents Anthropic Messages `max_tokens` as required maximum output tokens;
- `buildAnthropicBody` applies the package-wide 32,000-token measured answer bound to every Hyper call,
  lowered only by model or caller cap;
- tool input streams as model-produced partial JSON strings and finalizes as an object;
  neither Hyper nor Anthropic promises compact whitespace;
- streaming usage reports cumulative output tokens;
- `stop_reason: max_tokens` explicitly means truncation.

The normal-run objective is qualified by a working model.
Accordingly,
future architecture work adopts the intersection of provider-returnable responses and deterministic admission,
not every abstract schema-valid stress instance.
Schema stress witnesses remain robustness evidence and can prove overpermissiveness,
but they are not by themselves a normal-run architecture rejection.

This interpretation removes Candidate G and Candidate H envelope-only rejections.
It does not reverse their independent blockers:
Candidate G has no qualified author and its four-candidate verifier interface remains unmeasured under the planned model tokenizers;
Candidate H is implemented and targeted-lint-clean,
but its completed live calibration admitted no verifier ballot and produced no publication-eligible candidate.
Live Hyper and Synthetic use is authorized without another permission checkpoint.

Consumer hardening is required first.
`readJsonOutcome` currently admits parseable guard-valid JSON even when `finishReason` is `max_tokens`.
That contradicts truncation-as-no-effect semantics and is documented in
`doc/troubleshooting/charm-hyper-max-tokens-tool-json.md`.
The shared provider boundary now rejects Anthropic `max_tokens` and OpenAI-compatible `length` before parsing.
Commit `44ed76c59` added dist-based controls,
and GFP showed both parseable truncation cases fail when the predicate is removed.

### Candidate H implementation status

Prototype commits `7ceaec899` and `f2e35fd2c` implement Candidate H with:

- three immutable-shell whole-document authors and three all-candidate verifiers in two dependency waves;
- one Hyper-only vision roster used in both roles:
  Qwen3.8-27B,
  Kimi K3,
  and MiniMax M3;
- canonical roster identities mapped to exact Hyper wire ids
  `qwen3.8-27b`,
  `kimi-k3`,
  and `minimax-m3`;
- self-model clean certification excluded while self-model defect remains dissent;
- complete manifest-ordered obligation and global status arrays;
- eight bounded exact findings per candidate and exact `overflow === D > 8` algebra;
- obligation-indexed omissions,
  non-overlapping UTF-16 target anchors,
  and raw duplicate-member refusal;
- complete author-wave settlement,
  whole-ballot abstention,
  hidden priority,
  family-aware evidence floors,
  and no-dissent production eligibility;
- frozen provider binding,
  one-payload prompt claims,
  process-incarnation lease,
  deterministic restart,
  indeterminate-transmission quarantine,
  and exact caller-abort propagation after sibling settlement;
- Hyper-only provider masking,
  all page-image carriage,
  blocked internal node subpaths,
  and private output only.

Targeted Candidate H controls pass.
Type lint passes.
The fresh restored package run reports 876 passing suites and no failure lines.
GFP removal of overflow algebra and family-floor checks fails at their intended Candidate H controls;
restored targeted and full runs pass.

Candidate H's synthetic structurally admitted field-count-maximum Carena verifier witness measured:

- 23 immutable-shell slots,
  134 obligations,
  three candidates,
  eight findings per candidate,
  and three anchors per finding;
- 13,339 compact bytes and 4,447 tokens under the project three-bytes-per-token estimate;
- 7,473 raw JSON tokens under exact Qwen3.8 tokenizer;
- 5,716 raw JSON tokens under exact Kimi K3 tokenizer;
- 5,816 raw JSON tokens under exact MiniMax M3 tokenizer;
- 10,284 tokens of lowest raw-wire arithmetic reserve under Kimi's 16,000-token model cap;
- compact wire SHA-256
  `85d8eeee934173552d5b631f47a580f7f1f47039102302eff966b51629befbc8`.

The witness is field-count-maximum,
not byte-maximum.
It passed full Candidate H admission for all planned verifier identities.

A realistic complete Carena author response measured 21,412 compact bytes with SHA-256
`bb61c6dcb2cde515e04748cccabb99e15579edf9091e634b156e633c3159ef08`.
Its exact raw JSON counts are 4,585 Qwen3.8 tokens,
4,594 Kimi K3 tokens,
and 4,524 MiniMax M3 tokens.
The lowest author-witness raw-wire arithmetic reserve is 11,406 tokens under Kimi's 16,000-token model cap.
The retained response is used only as realistic size evidence,
not as evidence that its rejected author identity is qualified.

Current roster tokenizer artifacts are pinned at:

- Qwen3.8 `1d4bf0f2ff6012fd82039f2fa52739d0dd7c60c0`;
- Kimi K3 `a590ce090cb049c93a33dfe8c208ec652aa20503`;
- MiniMax M3 `f0e1c1e04d40177e4673a22097036854f536e9c0`.

Raw-wire headroom does not include model reasoning or tool-call framing.
Provider `usage.output_tokens` and finish reason were therefore required and are recorded by live calibration.
`doc/troubleshooting/charm-hyper-token-count-evidence.md` records the endpoint research,
artifact hashes,
and exact method.

Envelope measurement code is committed as `be0c178d6`.
The fresh package run after that change reports 876 passing suites and no failure lines;
type lint passes.

Candidate H targeted lint is clean in prototype-branch commit `ebf5a7f7d`:
18 files checked against 484 Oxlint rules report no warnings or errors,
type lint passes,
and the fresh full run reports 876 passing suites and no failure lines.
The migration also split verifier schema from parsed guard,
moved lifecycle fixture construction to the dist-importing unit test,
and preserved exact `IndeterminateTransmission` operational evidence.

Fresh Hyper `GET /v1/models` evidence confirms current vision capability and provider maxima:
Qwen3.8-27B true and 128,000,
Kimi K3 true and 16,000,
and MiniMax M3 true and 512,000.
Both prior DeepSeek verifier ids remain vision false and are rejected by Candidate H manifest.
The package applies 32,000-token project cap where model maximum is higher.

H-specific GFP rejects removal of global-omission refusal,
Hyper vision filtering,
Hyper-only provider binding,
canonical-to-Hyper reach,
self-certification exclusion,
prompt claims,
fresh raw-member refusal,
spent-node restart,
runtime lease identity,
and all-settled abort behavior.
Task #69 already GFP-proves shared truncating-finish refusal.
Restored targeted lint and types pass;
the restored full run reports 876 passing suites and no failure lines.

### Rejected Candidate H live calibration

Private Carena calibration ran from prototype commit
`5f3ca0946e690dcef7cabeb2e3482c951d915679`
against corpus commit
`a80634a674f94861ea3b7056fba054ca9eab1a2c`.
Manifest SHA-256 was
`c289fbb230e28cd29ab94deee4dbd13778f76556fc3d9a5d7349169c91825353`.
The fresh Hyper catalog still reported all three manifested models as vision-capable with expected maxima.
An injected transient control made exactly one transport attempt under `retryPolicy.limit = 0`.
Forced-tool controls bound all three canonical model ids to expected Hyper wire ids,
tool name,
and tool choice.

The run sent exactly six exchanges,
one for each durable node row,
and completed in 1,025,027 milliseconds.
Every exchange record carries request and response digests,
bytes,
role,
wire model,
HTTP status,
stop reason,
and provider usage without retained raw payload text.
All six responses returned HTTP 200:

- Qwen author reported `end_turn` and 59,438 output tokens;
  complete response was admitted.
- Kimi author reported `max_tokens` and exactly 16,000 output tokens;
  truncation guard made it spent-unusable.
- MiniMax author reported `tool_use` and 18,680 output tokens;
  complete response was admitted.
- Qwen verifier reported `end_turn` and 47,553 output tokens;
  extracted tool answer was not parseable JSON and whole ballot abstained.
- Kimi verifier reported `max_tokens` and exactly 16,000 output tokens;
  truncation guard made it spent-unusable.
- MiniMax verifier reported `tool_use` and 9,031 output tokens;
  parsed response failed exact caller guard and whole ballot abstained.

The two admitted authors demonstrate bounded candidate retention in this run despite one author failure.
The three verifier abstentions left no clean or dissenting ballot.
Private fixed-priority fallback selected Qwen with `evidenceFloorMet: false` and
`productionEligible: false`;
it did not authorize publication.

Complete-page review read source,
archive,
both admitted candidate pages,
and page-referenced `photo1.webp` at 2,048 by 2,048 pixels.
The selected document preserved front matter,
node order,
link target,
media reference,
contributor attribution,
and all source passages.
It was not publication-ready.
The footnote boundary omitted required English whitespace between link and following prose.
Both admitted candidates carry same boundary defect,
so fixed priority cannot avoid it.
Complete reading also found unresolved English idiom in flight-ticket comparison.

Candidate H is rejected rather than retried or repaired from spent outputs.
Its complete status-array idea remains useful,
but current all-candidate response interface did not yield one admissible ballot from three vision models.
Raw-wire arithmetic reserve also failed to predict Kimi's reasoning-inclusive truncation.
Private artifacts remain at
`~/temp/agent/prototype-Carena-H-bounded-verdict-20260831/`.
Complete source,
archive,
image,
and both-candidate review record is
`complete-page-review.json` with SHA-256
`efe09e54068c7aa9b45557818119b4fb88b53cf6b363446857ace4f3b322c646`.

The user has authorized Hyper and Synthetic calls without another permission checkpoint.
Advisor review preceded live calibration as engineering evidence ordering,
not as an authorization gate.

## Candidate I plan: candidate-scoped compact ballots

Candidate I keeps immutable-shell whole-document authorship but replaces all-candidate verifier matrices.
Its fixed graph manifests:

1.  one Qwen3.8-27B author and one MiniMax M3 author in concurrent first wave;
2.  one Qwen,
    one GLM 5.3 Flash,
    and one MiniMax verifier for each author ordinal in concurrent second wave;
3.  deterministic selection and private publication after every dispatched sibling settles.

Maximum payload count is eight in two provider waves.
An unusable author writes durable terminal state and deterministically skips its three candidate-scoped verifier nodes.
It does not cause replacement author,
retry,
or generated verifier work.
All nodes remain Hyper-only and receive every page-referenced image.
One model and one canonical substantive prompt still produce at most one provider payload.
Canonical verifier prompt includes manifested candidate ordinal,
opaque candidate id,
and candidate digest;
ordinal keeps prompts distinct even if two candidate documents and digests are byte-identical.

Every verifier receives one complete anonymous candidate,
complete source,
archive,
immutable shell,
closed-world obligation ledger,
and all images.
Its response keeps complete manifest coverage in compact strings:

```ts
export type CandidateIVerification = {
  readonly candidateId: CandidateId;
  readonly candidateDigest: string;
  readonly obligationStatuses: string;
  readonly globalStatuses: string;
  readonly overflow: boolean;
  readonly findings: readonly CandidateHFinding[];
};

export type CandidateIVerifierProfile = {
  readonly modelId: ModelIdentity;
  readonly responseRoute: 'anthropic-tool';
};
```

`obligationStatuses` has exactly one `p` or `d` code per manifested obligation.
`globalStatuses` has exactly one `c` or `d` code per global criterion.
Runtime expands strings into durable manifest-indexed audit rows before selection.
Candidate and digest binding,
finding anchors,
duplicate-member refusal,
and Candidate H overflow algebra remain exact.
A malformed status length or character abstains atomically and records privacy-safe guard category,
not raw provider text.

For Qwen-authored candidate,
clean GLM and MiniMax ballots satisfy two-family nonself evidence floor.
For MiniMax-authored candidate,
clean Qwen and GLM ballots satisfy same floor.
Clean self-model ballot never contributes to floor;
a valid self-model defect or overflow still vetoes candidate.
No admitted dissent is allowed.
Private fixed-priority fallback may preserve complete candidate below floor,
but cannot claim production eligibility.

Candidate I does not set non-default thinking,
reasoning-budget,
temperature,
or effort parameters.
It still sends protocol-required or live-catalog output ceiling.
Package contracts record owner's standing instruction against reasoning and sampling knobs after measured serving-stack
failures.
Focused Kimi vet rejected every available route under those constraints.
K2.6 and K2.7 Code returned non-JSON content despite strict Hyper OpenAI schema request;
K3 returned parseable JSON that failed exact caller guard.
Repository transport source already records that Hyper OpenAI route accepts and ignores `response_format`.
Focused third-family vet selected Hyper `glm-5.3-flash` over Anthropic forced-tool route for prototype validation.
Manifest persists canonical id,
wire id,
output cap,
and exact route-table digest for every verifier.
Unsupported,
truncated,
or malformed output abstains without route or parameter fallback.

A bounded Hyper probe sent one image and one forced tool with low effort to Kimi K3.
It returned HTTP 200,
`tool_use`,
96 output tokens,
214 reasoning characters,
and expected parseable verdict after 2,955 milliseconds.
This proves route combination acceptance only.
It does not prove lower reasoning and cannot override owner no-effort policy.
Candidate I will not use low-effort path.

Candidate I intends to move target-language separators out of model authority.
Immutable shell manifest gains AST-derived boundary atoms for target text adjacent to locked inline syntax.
For each such relation,
manifest states exact separator and neighboring syntax roles.
Prototype compiler must insert separator before candidate hashing;
verifier input and persisted candidate must use exact post-insertion document.
It does not trim or normalize arbitrary prose.
Positive and negative fixtures cover link-to-prose,
footnote,
punctuation,
code,
URL,
media,
and block boundaries.
This addresses Candidate H's shared footnote boundary defect without editing model prose.

Candidate I replaces coarse caller-guard detail with finite privacy-safe union:

```ts
export type CandidateIGuardFailure =
  | 'key-set'
  | 'candidate-binding'
  | 'status-length'
  | 'status-alphabet'
  | 'finding-shape'
  | 'anchor'
  | 'overflow'
  | 'raw-duplicate'
  | 'json-syntax';
```

Every caller-guard rejection records one category without retaining reviewer wording.
Transport,
abort,
truncation,
and indeterminate-transmission failures remain separate operational classes.
Finish reason,
usage,
response route,
request and response digests,
and attempt count become durable node evidence.

### Candidate I posture after Kimi route rejection

Candidate I uses two authors and six candidate-scoped verifiers.

Pros:

- removes demonstrated Kimi author truncation from producer wave;
- preserves three verifier-family positions needed for two-family nonself evidence;
- reduces each ballot from all candidates to one candidate;
- isolates one malformed candidate response to one ballot;
- keeps eight-payload,
  two-wave finite graph.

Cons:

- only two author wordings enter selection;
- GLM remains load-bearing and lacks complete Carena translation-review evidence;
- Hyper OpenAI structured output is unavailable as candidate route;
- neither retained Candidate H author passed complete-page publication review.

Candidate J's Kimi third-author expansion is rejected.
It adds demonstrated truncating producer and twelve-payload graph while no Kimi route satisfies verifier hard gate.

Candidate I remained a private prototype,
not production selection,
until the calibration recorded in the next section.
GLM route was manifest-bound and transport-validated before consumer validation.
It inherits Candidate H's zero-retry and pre-dispatch exchange cap,
Hyper-only provider binding,
indeterminate-transmission quarantine,
spent-node restart,
process lease,
exact caller-abort identity after sibling settlement,
prompt claims,
and complete-candidate no-effect publication guards.
Prototype HEAD `28d548d84fe1fcb51765b0e9a845c6361bf6359c` implements the fixed graph.
It passed targeted type-aware lint with zero diagnostics,
type checking,
and full `buildAndTest` with 877 suite `PASS` lines and no suite `FAIL` line.
GFP mutations failed after rebuild for family exclusion,
pre-verifier abort,
atomic guard category,
spent restart,
compiled anchor slots,
AST roles,
punctuation spacing,
all three wire mappings and caps,
route digest,
status length and alphabet,
finding algebra,
status-row expansion,
and unusable-author verifier skips.
Every mutation was restored before final green run.

### Candidate I pinned-Carena disposition

Candidate I is rejected after its one zero-retry pinned-Carena calibration.
Harness SHA-256
`90455077ef109c50750728dc9cb975acde33459d91a4d55ca6ace5dc881e37ff`
ran prototype commit `28d548d84fe1fcb51765b0e9a845c6361bf6359c` against corpus commit
`a80634a674f94861ea3b7056fba054ca9eab1a2c`.
Its fixed manifest dispatched all eight nodes once,
then proved restart with zero additional transport calls.
Every request carried `photo1.webp` and used default reasoning and sampling.

Both authors completed and admitted complete candidates.
Verifier settlement was:

- Qwen candidate:
  Qwen failed JSON syntax,
  GLM was cut at the 360-second call deadline,
  and MiniMax returned a clean ballot;
- MiniMax candidate:
  Qwen returned a clean ballot,
  GLM was cut at the 360-second call deadline,
  and MiniMax reached `max_tokens` before a tool ballot.

Four nodes completed and four became spent-unusable.
No node was skipped.
Each candidate had only one clean nonself family.
Neither candidate met the two-family nonself floor.
The deterministic private fallback selected the Qwen candidate with
`evidenceFloorMet: false` and `productionEligible: false`.

Complete-page review read the source,
archive,
both candidate documents,
private selected document,
and page image before interpreting selection metadata.
Both candidates preserved front matter,
block order,
media syntax,
contributor identity and link,
and source footnote link.
The Qwen candidate still contained an opening punctuation defect,
an incomplete possessive construction,
and one source-and-image relation mistranslation.
The MiniMax candidate contained sentence fragments,
several unidiomatic constructions,
and one omitted contrast.
Neither document was publication ready.
No output was published.

Metadata summary SHA-256 is
`48c4607d29a90aebacc27f5130e7e45d8d83f4529958419bfd937b35afe3e115`.
Private complete-page review SHA-256 is
`f5368388a184fbe394eccedb923933bd69e0deeef1c40e702e743b821c62373b`.
Candidate I must not be retried,
repaired,
or integrated.

The next finite design must reduce the opaque review burden without dropping any of the 134 clause-and-relation
obligations or ten global criteria.
Deterministic admission already owns syntax,
structure,
links,
media,
identity,
and boundary separators.
A successor should ask model verifiers only for source-to-target semantic and language judgments over compiled
translation slots plus page-level criteria.
It must retain complete source,
archive,
candidate,
and image access,
family-aware nonself evidence,
exact status coverage,
and the same zero-retry lifecycle.
This is a new substantive verifier contract and cannot redispatch any Candidate I prompt.

## Candidate K plan: three-family authors with conjunctive review units

Candidate K addresses both Candidate I failure surfaces.
It adds GLM as a third independent whole-document producer,
so a strong GLM candidate can qualify from Qwen and MiniMax evidence without depending on a GLM self-verdict.
It also replaces the opaque digest-only verifier ledger with readable compiled review groups.
It retains one explicit status for every clause and relation obligation.
The unit compiler retains every original obligation,
its semantic evidence,
and its exact mapping.

### Static graph

The manifest fixes twelve node templates before any provider contact:

1.  Qwen3.8-27B,
    GLM 5.3 Flash,
    and MiniMax M3 each receive one substantively new complete-candidate author prompt in the concurrent author wave;
2.  Qwen,
    GLM,
    and MiniMax each verify every usable candidate with one combined fidelity-and-English ballot in the concurrent
    verifier wave;
3.  deterministic selection runs only after every dispatched sibling settles.

Maximum payload count is twelve in two waves.
If an author is unusable,
its three statically named verifier nodes become durable deterministic skips.
Actual payload count is therefore three plus three times the number of usable authors.
Dependency-independent nodes remain concurrent.
No response creates a node,
retry,
route fallback,
or correction request.

Every node remains Hyper-only and receives every page-referenced image.
One model and one canonical substantive prompt produce at most one payload.
A local request deadline remains finite and manifest-bound;
the initial prototype value is 900,000 milliseconds.
That value is provisional validation input,
not evidence that GLM will complete.
Deadline-aborted outputs are spent-unusable and have no selection effect.
No model request sets thinking,
reasoning budget,
temperature,
effort,
or another sampling knob.
The initial route output ceiling remains the vetted 32,000 tokens for each model.
A higher ceiling requires a separate new-protocol route vet before implementation may rely on it.

### Substantively new producer contract

Candidate I's Qwen and MiniMax author prompts are spent and cannot be sent again.
Candidate K author protocol changes both instruction and packet semantics:

- it receives the compiled review-unit plan instead of the raw per-clause status ledger;
- it treats source text as semantic authority and archive text only as permitted wording evidence;
- it explicitly owns complete meaning,
  every actor and relation,
  idiomatic sentence boundaries,
  unambiguous references,
  terminology,
  chronology,
  memorial register,
  and image-related meaning;
- it returns every immutable-shell slot exactly once and returns no audit or repair claims;
- it must produce one complete publication candidate or have no effect.

GLM has not received a Candidate I author prompt.
Qwen and MiniMax may enter Candidate K only under this genuinely changed protocol and packet,
not a digest-only rename.
All three producers are peers;
none reads or edits another producer's output.
This preserves the ban on serial editor layering.

### Review-unit compiler

The compiler template is fixed before authors run.
Candidate binding after author settlement instantiates already-manifested templates with candidate id,
candidate digest,
and deterministic-proof digest;
it does not create work.

Candidate K bounds one manifest at 192 slot groups,
192 clause subjects,
191 relation subjects,
six global subjects,
and 64 retained findings.
For pinned Carena,
the compiler must produce:

- 23 slot groups containing all 112 clause subjects and one status per clause;
- 22 relation subjects preserving every relation obligation as its own status;
- 23 slot-language subjects;
- six page-level global subjects.

Each slot group stores its slot key,
source-slot range,
source text,
digest,
authority,
and ordered clause subjects.
Each clause subject carries obligation id,
canonical source ranges and text,
authority,
allowed target slot keys,
and evidence digest.
The ballot returns one clause status for every member,
so no clause disappears behind a slot conjunction.
Grouping makes evidence readable without reducing status granularity.

Each relation subject carries obligation id,
`adjacent-source-slot` kind,
ordered left and right clause endpoints,
canonical endpoint source ranges and text,
authority,
allowed target slot keys,
and evidence digest.
Relation findings may use multiple target anchors across authorized endpoint slots.
Slot-language subjects bind exactly one candidate slot and its complete candidate text.
All readable plan structure is included in `reviewPlanDigest`;
opaque digests never substitute for evidence the verifier must inspect.
The six global subjects are:

- cross-slot actor identity and coreference;
- cross-slot chronology and semantic relations;
- technical and legal terminology consistency;
- document-wide grammar,
  tense,
  register,
  and rhetorical coherence;
- contributor voice and authority;
- source,
  image,
  and target relation.

Ownership intentionally overlaps.
Terminology,
coreference,
register,
and image-alt prose may be rejected by either fidelity or language evidence.
A verifier cannot defer a defect because another responsibility also owns it.

The compiler persists an exact coverage map from Candidate I criteria into Candidate K subjects:

- unsupported addition,
  identity attribution,
  actor reference,
  chronology,
  and technical or legal meaning map to slot fidelity,
  relation,
  and overlapping global subjects;
- grammar and usage,
  tense,
  register,
  and source-language calque map to slot-language and overlapping global subjects;
- paragraph relations map to relation units and the chronology-and-relations global subject.

Tests must prove that every 112 clause obligation belongs to exactly one slot group and has exactly one status,
every 22 relation obligation remains exactly once,
every translatable slot has a language subject,
and every prior global criterion has at least one explicit successor owner.
They must also prove every readable source excerpt matches its bound range and digest,
every relation endpoint and direction match the original ordered obligation,
and no compiler output exceeds the static bounds.

### Deterministic proof boundary

Deterministic admission owns only mechanically decidable properties:

- raw duplicate-member refusal and exact response key sets;
- exact slot-key set,
  nonempty values,
  and compiled-document envelope;
- immutable syntax and locked-range survival;
- runtime-owned separators and target boundaries;
- front-matter key shape;
- link destination,
  media path,
  contributor identity and URL,
  and footnote destination survival;
- candidate,
  manifest,
  review-plan,
  document,
  slot,
  image,
  and proof digests.

It does not claim that translated front matter,
link labels,
image-alt prose,
visual relations,
contributor voice,
or any other target wording is semantically correct.
Those remain model-reviewed.
The candidate-bound proof is recomputed before verifier dispatch and before selection.

### Combined ballot and finding algebra

Each verifier returns:

```ts
export type CandidateKBallot = {
  readonly candidateId: CandidateId;
  readonly candidateDigest: string;
  readonly reviewPlanDigest: string;
  readonly deterministicProofDigest: string;
  readonly clauseStatusesBySlot: readonly string[];
  readonly relationStatuses: string;
  readonly slotLanguageStatuses: string;
  readonly globalStatuses: string;
  readonly overflow: boolean;
  readonly findings: readonly CandidateKFinding[];
};

export type CandidateKFinding = {
  readonly scope: 'c' | 'r' | 'sl' | 'g';
  readonly subjectIndex: number;
  readonly defectClassIndex: number;
  readonly sourceEvidenceIndexes: readonly number[];
  readonly imageEvidenceIndexes: readonly number[];
  readonly targetAnchors: readonly TargetAnchor[];
};
```

`clauseStatusesBySlot` contains one string per slot group,
and every string length equals that group's clause count.
Clause and relation alphabets are `p` or `d`;
language and global alphabets are `c` or `d`.
Raw duplicate members,
wrong characters,
wrong outer or inner lengths,
stale bindings,
invalid evidence indexes,
and unbound anchors abstain atomically.

A status is one Boolean subject state,
not a defect count.
Canonical subject order is clause groups and members in manifest order,
then relations,
slot language,
and globals.
Let `D` be the number of defective subjects and let fixed `C` equal 64.
`overflow` must equal `D > C`.
Without overflow,
exactly one witness finding binds every defective subject.
With overflow,
findings must bind exactly the first `C` defective subjects in canonical order.
Multiple defects inside one subject do not change `D` and do not create an unverifiable finding-count claim.

Every finding field is present;
scope controls whether its arrays must be empty or populated:

- clause findings cite the subject's source evidence;
  omission findings have no target anchor,
  while every other clause defect anchors inside an allowed target slot;
- relation findings cite both ordered endpoint source records and one to four disjoint target anchors across authorized
  endpoint slots;
- slot-language findings have empty source and image evidence arrays and one to three target anchors inside their slot;
- nonvisual global findings require target anchors and no image evidence;
- source-image-target relation findings require at least one exact manifest image index and target anchor,
  plus any relevant source evidence.

Defect-class scopes are closed in the manifest.
An omission class is legal only for clause scope;
an image-relation class is legal only where image evidence is permitted.
All source evidence indexes resolve to readable plan records with exact range and digest.
All image indexes resolve to manifest-bound page images.

Seeded controls must include multiple defects in one slot,
a cross-slot relation defect,
terminology drift,
actor-coreference ambiguity,
register failure,
image-relation failure,
and a mixed fidelity-and-language defect that both roles may veto.

### Evidence and selection

For a Qwen candidate,
clean MiniMax and GLM ballots provide two nonself families.
For a MiniMax candidate,
clean Qwen and GLM ballots provide two nonself families.
For a GLM candidate,
clean Qwen and MiniMax ballots provide two nonself families.

One candidate is production eligible only when:

- deterministic proof passes at every boundary;
- both nonself family ballots are valid and clean across every status string;
- no admitted ballot from any family contains a defect or overflow;
- contributor,
  structure,
  media,
  prompt-claim,
  provider,
  restart,
  and cancellation controls pass.

Self-clean evidence never contributes to the floor.
A valid self defect or overflow vetoes.
Malformed,
partial,
truncated,
late,
or stale ballots abstain with no selection effect.
Selection among eligible candidates uses fixed hidden priority only after all siblings settle.
A complete private fallback remains explicitly below floor and cannot authorize publication.

### Alternatives

#### Option A: three authors with combined ballots (recommended)

Pros:

- adds a genuinely new GLM producer and gives that candidate Qwen plus MiniMax nonself evidence;
- performs one complete-page review per family and candidate;
- retains separate fidelity,
  relation,
  language,
  and global acceptance predicates inside one atomic ballot;
- fixes Candidate I finding algebra without duplicating full-page inputs.

Cons:

- one malformed combined ballot loses both fidelity and language evidence from that family;
- three concurrent GLM verifier calls remain unmeasured under the smaller contract and longer deadline;
- Qwen and MiniMax producer quality may remain correlated with prior family defects;
- no finite selection rule can publish when all three independent whole candidates are defective,
  so producer quality remains a calibration hard gate.

#### Option B: three authors with separate fidelity and language ballots

Pros:

- isolates role instructions and schema failures;
- one failed role does not erase valid evidence from the other role.

Cons:

- has 21 statically named nodes and sends six concurrent full-page verifier calls per model when all authors succeed;
- has the same family-aware acceptance predicate as Option A;
- repeats complete source,
  archive,
  candidate,
  shell,
  proof,
  and images for each responsibility;
- specialization benefit has no measured consumer evidence.

#### Option C: one GLM author with Qwen and MiniMax ballots

Pros:

- has three payloads when every node completes;
- avoids using GLM as its own qualifying verifier.

Cons:

- one unusable author leaves no complete candidate;
- offers no alternate wording when the complete candidate has a defect;
- cannot satisfy the normal-run resilience objective.

Ranking:
Option A > Option B > Option C.
Option A ranks over Option B because both enforce the same conjunction,
while Option A avoids duplicated full-page load and same-model concurrency.
Option B ranks over Option C because its producer redundancy and isolated evidence survive one producer failure;
Option C has a single producer point of failure.
A first-defect-only ballot is excluded before ranking because it cannot demonstrate complete review coverage.

### Prototype acceptance controls

Candidate K cannot enter live calibration until:

- the manifest fixes three authors,
  nine candidate verifier templates,
  twelve-payload ceiling,
  route ids,
  vetted 32,000-token caps,
  provisional 900,000-millisecond local deadlines,
  and two dependency waves;
- review-plan compilation proves exact obligation and prior-criterion coverage,
  readable evidence binding,
  static unit bounds,
  and relation direction;
- deterministic proof excludes every semantic claim named in its boundary section;
- combined-ballot schema and guard pass seeded positive and negative controls;
- family floor,
  self-veto,
  prompt uniqueness,
  image reach,
  exact provider mask,
  duplicate-member,
  abort identity,
  spent-node restart,
  lease,
  and deterministic-skip guards GFP-fail when removed;
- type-aware lint,
  types,
  targeted rebuilt tests,
  and full `buildAndTest` pass;
- advisor reviews the exact implementation and the zero-retry calibration harness;
- complete source,
  archive,
  every candidate,
  selected document,
  and every page image are read before any production-eligibility claim.

Candidate K is selected for structural prototyping only.
It is not selected for production.
It carries no permission to reuse Candidate I prompts or outputs as new provider work.

### Candidate K structural prototype status

Candidate K passed structural implementation at prototype commit
`399d0d686524818cd78e91bdb9417496901f9880`.
Built `prototype-review-unit.mjs` SHA-256 is
`bc64696ca4d7e1066e099718f5c83624eafc1be388d635191214f1c6f4678a83`.
Built test-support SHA-256 is
`1a5db330fed4bfd94e2907cbc447dcab958eb524821c6461c1e3c479c1016cd2`.
Built package index SHA-256 remains
`d67e90eab0b7f1d9c4073f4b33754c6b6fc92b2ec78e2f006217c6c892f0ca75`.

The implementation fixes three Qwen,
GLM,
and MiniMax author nodes plus nine candidate-scoped verifier nodes before provider contact.
It persists readable review plans,
mechanical proof,
manifest and route identities,
model-facing finding rules,
author settlement,
verifier plan,
node records,
responses,
ballots,
selection,
and prompt claims.
An unusable author deterministically skips its three verifier nodes.
A candidate qualifies only with two clean nonself families and no valid self or nonself dissent.
A vetoed higher-priority candidate cannot mask a lower-priority eligible candidate.

The readable pinned-Carena plan contains four semantic front-matter subjects,
112 individual clause statuses in 23 slot groups,
22 ordered relation statuses,
23 slot-language statuses,
and six page-level globals.
Every source excerpt,
range,
digest,
relation endpoint,
direction,
front-matter shape,
supported scalar,
synthetic target slot,
and old-to-new global owner remains manifest-bound.
Scope-specific model-facing rules and caller admission share one digest.
Canonical overflow retains the first 64 defective subjects.

Type-aware lint returned zero warnings and zero errors across 38 scoped files.
Types passed.
The rebuilt targeted suite has 34 cases.
Full `buildAndTest` exited zero with 878 suite `PASS` lines and no suite `FAIL` line.
The post-commit GFP script,
SHA-256 `82ed0f3b8dbaa66e161e1c1d6e3ea4301efcd70fc3d858f73e25511112f9541c`,
mutated 22 load-bearing controls.
Each mutation rebuilt,
made the targeted suite fail,
was restored immediately,
rebuilt,
and passed.
Mutations covered subject-specific global rules,
synthetic-slot collision,
front-matter structure and scalar identity,
proof and cancellation before dispatch,
narrow anchors,
canonical finding prefix,
route cap and deadline,
family floor,
candidate dissent veto,
sibling all-settlement,
exact abort identity,
between-wave cancellation,
indeterminate conversion,
spent restart,
author-dependent skips,
rule-table and image carriage,
provider mask,
and prompt claims.

Offline pinned-Carena request measurement used script SHA-256
`a7974f497ed539e5ba92eb161705a5b227c339c5b48d446a0c35e148fbf4aa30`.
Metadata summary SHA-256 is
`6824feaedd6ea6214e1ad5f19f888c1a7bcc77c3714297344f3dc75ab8656fe5`.
Verifier request bodies measured 1,145,716 to 1,145,719 bytes,
with one exact image,
one forced tool,
and 32,000 `max_tokens`.
The largest constructed admitted 64-finding response measured 37,389 characters.
Prior official-tokenizer artifacts counted it at 20,237 Qwen,
16,102 GLM,
and 14,907 MiniMax tokens.
Token-count metadata SHA-256 is
`7d7ad7bc6049c4414dad4df8863bb80419470ae629051a4805a11d07511a0577`.
These counts are screening evidence,
not hosted-route guarantees.
A separate 84,411-character conservative static superset intentionally violates dynamic subject enums and per-subject
admission bounds;
it is not an admitted maximum.
Its metadata SHA-256 is
`af305cb703e6d8813120e9cf3cabae3546a98f02b69525ce20e7d47a9bf3b8a3`.

The local 900,000-millisecond deadline remains a provisional calibration hypothesis.
Candidate I's GLM rejection applies to its 134-plus-ten candidate-ballot verifier contract;
it does not prove Candidate K's new author or readable-review contracts complete.
Only one zero-retry pinned-Carena run can establish consumer behavior.

Front matter remains a shared archive-derived immutable-shell input,
not independently authored prose.
Every verifier reviews its semantic string values and exact deterministic shape,
but a valid front-matter defect vetoes every candidate and no Candidate K author can repair it.
That common-mode limitation is a calibration hard gate.
It blocks any broader normal-run completion claim until production front-matter authority or authorship is redesigned.

Candidate K may proceed to an advisor-reviewed zero-retry pinned-Carena harness.
It remains ineligible for production integration before calibration and complete-page review.

### Candidate K calibration disposition

Candidate K is rejected after its one zero-retry pinned-Carena calibration.
The exact harness SHA-256 was
`41094dded81174b49bec30b5b7c14966362470524180c6fe44daadb77897886a`.
The output root is
`/var/home/user/temp/agent/prototype-Carena-K-review-unit-20260901`.
The retained summary binds prototype commit,
built artifacts,
corpus commit,
source,
archive,
image,
manifest,
review plan,
verifier rules,
provider routes,
and live catalog.
Every retained file is mode `0600` and every directory is mode `0700`.

The concurrent author wave made three exact Hyper Anthropic Messages exchanges:

- GLM returned HTTP 200 after 648,545 milliseconds,
  emitted only a thinking block,
  and stopped at 32,000 output tokens with `max_tokens`;
- Qwen returned HTTP 200 after 511,425 milliseconds,
  emitted thinking plus a tool-use block,
  and ended with `end_turn`,
  but accumulated tool input was not parseable JSON;
- MiniMax returned HTTP 200 after 184,139 milliseconds,
  emitted thinking plus a tool-use block,
  and stopped at 32,000 output tokens with `max_tokens`.

All three author nodes became `spent-unusable`.
The runtime created no candidate,
deterministically skipped all nine dependent verifier nodes,
and selected nothing.
Fresh and restart results were equal,
the restart transport made zero calls,
and the private artifact tree was unchanged by restart.
The result has three network exchanges,
three spent nodes,
nine deterministic skips,
and twelve terminal static nodes.

There is no candidate document to review or publish.
The source,
archive,
and exact WebP copy match the completely read Candidate I inputs by SHA-256,
but input identity cannot substitute for a candidate.
No complete-page candidate review can begin when candidate admission produced zero documents.

This rejection is an author-protocol result,
not a verifier result.
No Candidate K verifier payload was dispatched.
The readable combined-verifier protocol remains unspent and uncalibrated.
The calibration does not authorize a retry,
continuation,
output-ceiling increase,
partial JSON repair,
reconstruction from hidden reasoning,
or production integration.
Candidate K's author prompts and terminal outputs are permanently spent evidence.

The failure separates two design concerns:

- whole-document slot production remains viable because Candidate I admitted Qwen and MiniMax candidates with the same
  output schema;
- adding the readable audit plan to producer requests did not produce an admitted author in this calibration.

Candidate K therefore keeps its review-unit compiler,
ballot algebra,
and verifier lifecycle as reusable prototype evidence,
but its producer contract is retired.

## Candidate L plan: lean realization with readable verification

Candidate L removes audit bookkeeping from producer requests while retaining Candidate K's complete-page review units.
It also moves all translatable front-matter strings into author-owned slots,
removing Candidate K's known common-mode archive front matter.
Each path receives its own authority and serialization contract rather than generic free-prose treatment.

### Static graph

The manifest fixes eight nodes before provider contact:

1.  Qwen3.8-27B and MiniMax M3 each receive one substantively new lean realization prompt
    in the concurrent author wave;
2.  Qwen,
    GLM 5.3 Flash,
    and MiniMax each receive one Candidate K combined review-unit ballot for every usable candidate;
3.  deterministic selection runs only after every dispatched sibling settles.

Maximum payload count is eight in two waves.
An unusable author deterministically skips its three candidate-bound verifier nodes.
No response creates work,
and no node retries,
continues,
repairs,
or falls through to another route.
Every provider request remains Hyper-only,
uses one exact forced tool,
carries every page-referenced image,
and has a manifest-bound finite deadline and output ceiling.

Qwen and MiniMax remain author models because Candidate I proved both can return admitted complete slot maps.
GLM leaves the author wave because Candidate K measured 648,545 milliseconds of thinking,
followed by `max_tokens` and no tool block.
GLM remains the necessary third-family verifier,
where Candidate K's smaller unspent ballot output has not yet been calibrated.
If GLM spends unusably for a candidate,
that candidate cannot demonstrate publication eligibility under Candidate L.

### Lean realization contract

Each author receives:

- complete source text as semantic authority;
- complete archive text as wording evidence only;
- one ordered mutable-slot shell;
- every page-referenced image;
- a compact page-level quality contract;
- exact response keys and no audit-status request.

The author does not receive the clause ledger,
review-unit plan,
status strings,
finding rules,
verifier schema,
or selection policy.
It owns one direct task:
return every mutable English slot exactly once so deterministic assembly produces one complete publication candidate.

This protocol is substantively different from both spent predecessors:

- Candidate I asked authors to satisfy a raw obligation ledger;
- Candidate K asked authors to consume the readable review plan;
- Candidate L removes obligation statuses from production and gives the author one page-level realization contract;
- Candidate L changes the shell,
  response schema,
  and output cardinality by adding four author-owned front-matter paths.

Prompt and packet digests must prove those responsibility and schema differences before any live call.
Removing fields alone is not sufficient evidence of a new substantive prompt.

The mutable shell contains exactly 27 target strings:
23 body slots plus four front-matter string leaves.
For pinned Carena the front-matter paths and contracts are:

- `name` is one nonempty identity label.
  It must equal one normalized member of the candidate `info.alias` list;
- `info.alias` represents the source alias list,
  not undifferentiated prose.
  Runtime splits source and candidate values into the same nonempty member count,
  preserves order,
  requires every source Latin-script identity token at its original member position,
  and serializes members with canonical `, ` delimiters;
- `info.location` is one nonempty English place label.
  Runtime preserves path and scalar identity,
  while model review decides whether it names the source location accurately and canonically;
- `desc` is one nonempty memorial description.
  It preserves scalar path and contributor authority,
  while model review owns meaning,
  grammar,
  and register.

Source-script aliases are not mechanically deleted merely because the target page is English.
Model review decides whether transliteration,
translation,
or source-script retention best preserves each unprotected alias member.
The protected Latin identity `Carena` must survive exactly.

Runtime owns YAML delimiters,
key order,
container shape,
nonstring scalar identity,
canonical alias joining,
body syntax,
links,
media paths,
footnote destinations,
contributor identity,
and target-language separators.
The author owns the 27 English scalar and body values within those closed grammars.
Admission rejects missing,
extra,
empty,
Han-containing body values,
duplicate,
or structurally invalid responses.
Front-matter script admission follows its per-path identity contract rather than a blanket Han prohibition.
Deterministic checks do not claim semantic correctness.

### Readable verification contract

Candidate L derives its candidate-scoped verifier protocol from Candidate K's unspent implementation:

- four front-matter fidelity subjects bind path,
  source value and digest,
  candidate value and target-slot key,
  container identity,
  authority,
  protected identity tokens,
  and alias-member grammar;
- 112 clause statuses remain grouped into exactly 23 readable body-slot units;
- 22 ordered relation statuses remain individually visible;
- exactly 27 slot-language subjects cover the 23 body slots and four front-matter leaves;
- six page-level global subjects retain cross-slot identity,
  chronology,
  terminology,
  register,
  contributor authority,
  and source-image-target relations;
- first-64 canonical finding overflow,
  evidence indexes,
  narrow target anchors,
  image bindings,
  and exact status alphabets remain unchanged.

Every verifier still receives complete source,
archive,
candidate,
shell,
review plan,
proof,
and images.
Candidate L therefore changes Candidate K's verifier schema only where candidate-owned front matter requires it:
`frontMatterStatuses` still has four fidelity characters,
while `slotLanguageStatuses` expands from 23 to exactly 27 language characters.
Front-matter findings anchor only inside their exact synthetic target slot.
Identity findings cite source and candidate values plus protected tokens;
alias findings additionally cite ordered member evidence.
Location and description findings cite their source scalar and exact candidate target.

The review plan is verifier evidence,
not producer instructions.
A ballot is atomic:
partial,
malformed,
truncated,
stale,
or guard-invalid output abstains with no selection effect.

### Evidence and selection

A Qwen candidate needs clean MiniMax and GLM ballots.
A MiniMax candidate needs clean Qwen and GLM ballots.
Both clean nonself families must cover every status,
and no admitted self or nonself ballot may report a defect or overflow.
Self-clean evidence never contributes to the floor;
self-defect evidence vetoes.

Fixed hidden author priority breaks publication ties only after every dispatched node settles.
Private fallback is also deterministic:
after author settlement it is the mechanically admitted candidate with minimum numeric `priority`,
then minimum candidate ordinal if priorities tie,
independent of ballot arrival order.
The runtime persists its candidate id separately from publication selection.
When no candidate meets the evidence floor,
`evidenceFloorMet: false` prevents that fallback from authorizing publication.
Zero admitted authors returns no fallback rather than publishing the archive or repairing a partial response.

### Alternatives

#### Option A: lean authors with combined review-unit ballots (recommended)

Pros:

- isolates direct writing from audit bookkeeping;
- has eight static nodes and at most six complete-page verifier calls;
- reuses an implemented but unspent verifier protocol;
- removes shared archive-derived front-matter wording;
- preserves two-family nonself evidence for either author.

Cons:

- one malformed combined ballot loses both fidelity and language evidence for that family;
- GLM verifier completion remains unmeasured under the 900,000-millisecond deadline;
- two authors cannot protect against both producer families failing together.

#### Option B: lean authors with separate fidelity and language ballots

Pros:

- isolates verifier schemas and failure domains;
- one malformed role does not erase the other role's evidence;
- permits narrower model instructions.

Cons:

- has fourteen static nodes and up to twelve complete-page verifier calls;
- repeats source,
  archive,
  candidate,
  shell,
  proof,
  and images for each role;
- no calibration evidence yet shows that role splitting improves GLM completion.

#### Option C: retain GLM as a third lean author

Pros:

- provides a third complete candidate family if GLM succeeds;
- gives a GLM candidate Qwen and MiniMax nonself evidence.

Cons:

- Candidate K measured GLM exhausting 32,000 tokens without opening the forced author tool;
- adds one author and three dependent verifier nodes;
- increases static work without evidence that removing the audit plan is enough to make GLM translation complete.

Ranking:
Option A > Option B > Option C.
Option A ranks over Option B because the combined verifier protocol is already implemented and unspent,
while role splitting adds six possible exchanges without measured completion benefit.
Option B ranks over Option C because it changes the measured failure surface through narrower verifier duties;
Option C repeats a producer role that failed before tool use.

### Candidate L acceptance controls

Candidate L cannot enter live calibration until:

- the manifest fixes two authors,
  six candidate-bound verifier templates,
  eight-payload ceiling,
  exact Hyper routes,
  token caps,
  deadlines,
  images,
  and provider mask;
- front-matter slot compilation proves exact YAML path,
  shape,
  scalar,
  per-path authority,
  alias cardinality and ordering,
  protected-token survival,
  canonical serialization,
  and candidate binding;
- review compilation proves four front-matter fidelity subjects and exactly 27 slot-language subjects,
  with path-specific evidence and target anchors;
- author prompts contain no ledger,
  review plan,
  finding rules,
  statuses,
  or selection text;
- model-facing author packets and schemas are independently recomputed at dispatch;
- Candidate K verifier rules,
  expanded 27-slot plan coverage,
  schema,
  finding algebra,
  family floor,
  self-veto,
  cancellation,
  prompt uniqueness,
  restart,
  and deterministic skips remain guarded;
- targeted tests,
  type-aware lint,
  types,
  full `buildAndTest`,
  GFP mutations,
  and advisor review pass;
- a no-network harness proves exact eight static `(nodeId, wireModelId, schemaDigest)` bindings before any live spend.

Candidate L is selected for structural prototyping only.
It is not selected for production,
and it does not authorize redispatch of any Candidate I or Candidate K author prompt.

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

Before selecting any replacement for production:

- static manifest proves declared finite payload ceiling
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
- complete actual Carena output from selected candidate is read by human and independent reviewer;
  artifact or tally alone is not comparison evidence
- recurring output defect changes brief,
producer responsibility,
or adoption contract;
it never adds Gate or retry loop
