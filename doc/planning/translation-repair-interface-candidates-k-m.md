# Translation repair interfaces: Candidates K to M

Part of the [interface comparison index](translation-repair-interface-comparison.md).

## Current stop condition

Historical design evidence only.
Candidate M failed on 2026-09-01.
No candidate prompt may be retried,
and no successor implementation is authorized by this file.

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

A 2026-09-01 live-catalog refresh found newly available `glm-5.3` alongside `glm-5.3-flash` and `glm-5.2`.
Full `glm-5.3` reports a 262,144-token maximum output but `capabilities.vision: false`.
It fails Candidate L's mandatory-image hard gate and does not replace Flash.
`glm-5.3-flash` reports vision true,
default reasoning `max`,
and remains the manifested third-family route.
Candidate L will not override that default under owner policy,
so completion remains a calibration risk.
An unverified user-provided notice says GLM 5.2 will be deprecated shortly,
but the inspected Hyper pages and live row contained no date.
That timing has no design effect because GLM 5.2 was already excluded and its live row also reports vision false.

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

### Candidate L prototype result

Candidate L completed structural prototyping at
`9b8c25089d8d70e1be5c5daab774646cb1373c85`.
The implementation commits are:

- `97cc07e38`,
  the initial lean finite-realization graph;
- `4d5e87eb0`,
  the canonical front-matter authority contract and source-only verifier projection;
- `dba9776e0`,
  independent source-plan and admission-plan digest guards;
- `0bbaac722`,
  the extra-alias cardinality guard found by GFP;
- `9b8c25089`,
  the no-verifier-plan boundary guard found by GFP.

The final rebuilt artifact digest is
`3b885ae2f760b72477931ab0183e73b17fc8e2f4187a296e688ce9fb41cbc0bb`.
Targeted type-aware lint reported zero warnings and zero errors,
types passed,
and full `buildAndTest` reported 879 prefix-counted passing suites and zero failing suites.

The final GFP harness is
`/var/home/user/temp/agent/gfp-candidate-l-20260901.py`,
with SHA-256
`55b86b58e681a455a580ef1a3505b0110b696bcb0c94e117d4e72afd0857a3ee`.
It proved these mutations against the committed baseline,
restoring and rebuilding after each:

- contract path;
- contract kind and authority;
- projected authority;
- target delimiter grammar;
- alias member count;
- protected alias member position;
- name membership in aliases;
- archive target-field reintroduction;
- projected review-plan digest reintroduction;
- source-plan digest substitution;
- language-index transposition;
- overflow scope order;
- mutable-key schema cardinality;
- eight-node graph ceiling;
- author audit-packet exclusion;
- lean node identity;
- all-sibling settlement;
- exact abort identity;
- between-wave cancellation before verifier-plan creation;
- spent-node restart abstention.

### Candidate L calibration result

The one authorized pinned-Carena calibration used harness SHA-256
`6d050811e82a3156e1da5a0524b0bdb6a595d27fbfb814296ed854168b85a0fc`,
manifest digest
`14e5b100a5bddfc4426b7c0d5dbee89255e90d3a787644e5f115f08c6ed39fd3`,
and output root
`/var/home/user/temp/agent/prototype-Carena-L-lean-realization-20260901`.
No reasoning,
thinking,
effort,
temperature,
or retry parameter was sent.
Every transmitted node received `photo1.webp`.

The graph reached all eight terminal static nodes:

- Qwen's lean author hit the 900,000-millisecond local deadline after 900,022 milliseconds and was spent-unusable;
- MiniMax's lean author completed after 107,952 milliseconds and admitted candidate ordinal one;
- all three verifier nodes for Qwen's absent candidate were skipped without transport;
- Qwen's verifier returned HTTP 200 after 568,639 milliseconds,
  but its ballot violated the status alphabet and was spent-unusable;
- GLM 5.3 Flash returned HTTP 200 after 564,987 milliseconds,
  reported 32,000 output tokens and `max_tokens`,
  emitted thinking only,
  and was spent-unusable;
- MiniMax's verifier returned HTTP 200 after 141,327 milliseconds,
  but its ballot violated the status alphabet and was spent-unusable.

The runtime therefore recorded one completed node,
four spent-unusable nodes,
and three deterministic skips.
The private fallback had no clean verifier family,
`evidenceFloorMet: false`,
and `productionEligible: false`.
Restart completed before post-run accounting,
made zero transport calls,
and reproduced the persisted result.

The launch harness then rejected its own post-run accounting because its audit layer still derived and persisted the
stale `review-unit-verifier-` prefix into metadata-only exchange rows,
while Candidate L runtime node records correctly use
`lean-realization-verifier-`.
This happened after the graph and zero-call restart completed.
It changed no provider dispatch,
request,
response,
candidate,
selection,
or runtime record.
A no-network post-audit mapped that metadata prefix,
proved five dispatched plus three skipped terminal nodes,
recursively verified private modes,
and retained summary SHA-256
`55deaafeb67a22a11a0e07ed512efe54e37d306e3ecead39cd303e09e1f3c8c0`.

Complete source,
archive,
image,
and candidate reading independently rejected the only admitted candidate.
Candidate line 25 reverses the actor in the emergency-call cover story:
the narrator claims that the narrator climbed and became stuck,
while source authority says the narrator concealed Carena's suicidal intent by saying Carena climbed out of curiosity.
Candidate line 19 also attaches hanging up and enjoying medication-induced calm to the narrator,
while source authority assigns both actions to Carena.
The private complete-page review SHA-256 is
`384961fe9174ff451b80ba66bed4e77d69377c35afc0e524b9aa3494e4efe7bd`.
The memorial illustration is coherent with the page and introduced no conflicting evidence.

Candidate L is rejected for production.
Both author prompts and the three dispatched candidate-one verifier prompts are spent and cannot be retried,
continued,
repaired,
or redispatched.
The three candidate-zero verifier templates remained undispatched,
but their bound candidate never existed and the terminal calibration does not authorize later dispatch.
Candidate L also does not authorize redispatch of any Candidate I or Candidate K prompt.

## Candidate M plan: risk-attested authors and role-split challengers

Candidate M directly removes Candidate L's measured verifier status-alphabet surface without editing or redispatching a
spent candidate.
It does not claim to solve Qwen's author deadline or GLM's thinking-only output-ceiling failure.
Authors receive a substantively new risk-attestation contract.
Verifiers replace exhaustive status strings with one bounded whole-page challenge in each fixed responsibility role.
No response chooses,
creates,
or removes a node.

If Qwen's author fails again,
its six challengers skip and only MiniMax's candidate can qualify.
If GLM abstains in either challenger role,
no candidate can satisfy the strict two-family nonself floor.
Both conditions are terminal non-publication by design,
not triggers for fallback or retry.

### Risk-attested author contract

Qwen3.8-27B and MiniMax M3 each receive one complete source,
archive,
image,
immutable shell,
and 27-value response schema.
The packet also carries one static generic risk register derived from prior complete-page failures:

- actor attribution;
- event ownership and sequence;
- temporal and pronominal reference;
- unsupported emphasis;
- source-image relation;
- memorial register and contributor voice.

The response is exactly:

```ts
export type CandidateMAuthorResponse = {
  readonly slots: Readonly<Record<CandidateMMutableKey, string>>;
  readonly riskAttestations: {
    readonly actorAttribution: 'checked';
    readonly eventOwnershipSequence: 'checked';
    readonly temporalPronominalReference: 'checked';
    readonly unsupportedEmphasis: 'checked';
    readonly sourceImageRelation: 'checked';
    readonly memorialRegisterContributorVoice: 'checked';
  };
};
```

The manifest owns that key order and the sole `checked` code.
Admission compares `Object.keys(response.riskAttestations)` exactly with manifested order before hashing.
It rejects order deviation rather than canonicalizing it.
Missing,
extra,
unknown,
duplicated,
or differently coded members reject the response atomically.
The raw duplicate-member guard runs before parsing.
The ordered risk register,
code alphabet,
attestation object digest,
author protocol digest,
author schema digest,
manifest identity,
and deterministic candidate proof bind one another.

Every code means only that the author performed the named check.
It supports admission integrity only.
It is not clean evidence,
never votes,
and cannot override a verifier defect.
Runtime admits a candidate only when all 27 values and all six attestations are present exactly once.

This is substantively different from Candidate L.
Candidate L asked for values only under one general complete-page instruction.
Candidate M changes the packet,
response schema,
author responsibility,
protocol digest,
and deterministic admission contract.
It does not send Candidate L's canonical author prompt again.

### Role-split challenger contract

Each usable candidate has six statically manifested challengers:
Qwen,
GLM 5.3 Flash,
and MiniMax each receive one fidelity role and one publication-language role.
Every challenger receives the complete source,
archive,
candidate,
review plan,
deterministic proof,
and every page-referenced image.

The fidelity role owns:

- source facts,
actors,
relationships,
chronology,
causality,
reference,
omission,
and unsupported addition;
- identity,
front-matter meaning,
links,
media relation,
and image-grounded claims;
- exact contributor authority where wording changes meaning or agency.

The publication-language role owns:

- grammar,
idiom,
sentence attachment,
reference clarity,
tense,
register,
and paragraph coherence;
- memorial tone,
contributor voice,
and publication readiness;
- language defects in all 27 candidate-authored values.

Each challenger returns one compact atomic response:

```ts
export type CandidateMChallenge = {
  readonly candidateId: string;
  readonly candidateDigest: string;
  readonly deterministicProofDigest: string;
  readonly sourceReviewPlanDigest: string;
  readonly role: 'fidelity' | 'publication-language';
  readonly verdict: 'clean' | 'defect';
  readonly findings: readonly [] | readonly [CandidateMFinding];
};
```

A clean verdict requires an empty finding array.
A defect verdict requires exactly one publication-blocking finding with exact manifested source and target evidence.
The verifier must review the whole page before returning either verdict.
It need not narrate every defect after the first decisive counterexample.

Clean responsibility remains role-specific,
but valid defect classes use this closed role table:

- fidelity only:
  `wrong-meaning`,
  `omission`,
  `unsupported-addition`,
  `identity-attribution`,
  `chronology`,
  `technical-legal-term`,
  and `image-relation`;
- publication language only:
  `grammar-usage`,
  `tense`,
  `register`,
  `source-language-calque`,
  `paragraph-coherence`,
  and `contributor-voice`;
- shared cross-role veto:
  `actor-reference`,
  `event-ownership`,
  and `reference-attachment`.

Every finding has required arrays
`sourceEvidence`,
`targetAnchors`,
and `imageEvidenceIndexes`.
Each source evidence member is exactly
`{ scope: 'front-matter' | 'clause' | 'relation', subjectIndex: number }`.
All scopes,
indexes,
and anchors bind manifested evidence and candidate digests.
The closed class-to-source-scope table is:

- front matter permits
  `wrong-meaning`,
  `omission`,
  `unsupported-addition`,
  `identity-attribution`,
  `actor-reference`,
  `reference-attachment`,
  `grammar-usage`,
  `tense`,
  `register`,
  `source-language-calque`,
  and `contributor-voice`;
- clause permits every Candidate M defect class;
- relation permits
  `wrong-meaning`,
  `omission`,
  `unsupported-addition`,
  `actor-reference`,
  `event-ownership`,
  `reference-attachment`,
  `chronology`,
  `paragraph-coherence`,
  and `image-relation`.

A source index valid in another namespace or a class not allowed in that namespace abstains atomically.
Evidence cardinality is class-specific:

- fidelity classes other than omission and image relation require at least one source subject and one exact target anchor;
- omission requires at least one source subject and permits zero or one nearby target anchor;
- image relation requires at least one exact target anchor and one image index;
- publication-language classes require at least one exact target anchor and permit zero or one source subject;
- shared cross-role classes require at least one source subject and one exact target anchor;
- classes without image ownership require an empty image-index array.

Target anchors identify candidate front-matter or body slots plus exact start,
end,
and runtime-recomputed substring digest.
Model-facing evidence does not retain source or candidate wording outside the private candidate and prompt artifacts.

A challenger may report one fully evidenced shared blocker rather than suppress it or return clean.
An allowed shared defect vetoes the candidate,
but it does not provide clean evidence for either role.
A role-exclusive class emitted by the other role,
an unknown class,
or invalid evidence makes the whole challenge abstain atomically.
That abstention neither vetoes nor counts as clean and never creates a handoff node.

This interface removes Candidate L's long status alphabet,
per-clause status vector,
27-character language vector,
and overflow algebra from the wire.
Runtime still binds complete review-plan digest,
candidate proof,
role,
model family,
and evidence anchors.
An invalid or incomplete challenge abstains atomically.

### Static graph and selection

Candidate M uses manifest version 3 and exact architecture discriminator
`candidate-m-risk-challenger`.
Version 1,
version 2,
missing,
or different architecture identity cannot bind Candidate M nodes or restart artifacts.

The manifest fixes at most 14 nodes before contact:

1.  two concurrent risk-attested authors;
2.  six concurrent role-split challenger templates for each author ordinal;
3.  deterministic private selection after every dispatched sibling settles.

An unusable author skips its six candidate-bound challengers.
Every independent sibling settles before exact caller cancellation propagates.
Indeterminate transmission is spent.
Restart dispatches no terminal or potentially transmitted node.
No fallback route,
continuation,
correction,
or generated work exists.

A candidate is publication-eligible only when:

- no admitted self or nonself challenge reports a defect;
- each role has clean nonself evidence from both remaining model families;
- those clean families are distinct under the existing conservative family map;
- every deterministic candidate,
front-matter,
syntax,
media,
and contributor guard passes.

Self clean evidence never qualifies.
A valid self defect vetoes.
An abstention is neither clean nor dissent.
Self abstention neither qualifies nor vetoes.
A nonself abstention blocks only by leaving its role below the clean-family floor.
Partial role coverage cannot combine into clean evidence.
Private fallback remains minimum numeric priority,
then minimum candidate ordinal,
and records `evidenceFloorMet: false` when either role lacks its floor.

### Challenger options considered

#### Option A: role-split first-defect challengers

Pros:

- removes the status alphabet that invalidated Qwen and MiniMax Candidate L ballots;
- removes the large status-vector output that Qwen and MiniMax failed to follow;
- isolates semantic fidelity from publication language while both still read the whole page;
- one exact counterexample is sufficient to veto a candidate;
- keeps all work statically named and atomic.

Cons:

- raises the maximum graph from eight to 14 payloads;
- clean evidence is a whole-role assertion rather than a visible per-subject vector;
- GLM remains load-bearing for the strict two-family nonself floor;
- GLM's measured thinking-only `max_tokens` failure occurs before tool output,
  so the smaller response does not mitigate it;
- role overlap can produce duplicate defects,
  though duplicates have the same veto effect.

#### Option B: combined first-defect challengers

Pros:

- keeps Candidate L's eight-node maximum;
- removes status vectors and overflow while preserving one whole-page verdict;
- has the smallest verifier payload count.

Cons:

- retains the combined semantic and language burden that made every Candidate L verifier unusable;
- gives no role-specific evidence when a verifier abstains;
- one clean assertion spans too many distinct responsibilities.

#### Option C: independent status and finding halves

Pros:

- narrows each output further;
- can retain exhaustive coverage in one half and exact evidence in the other;
- separates compact classification from prose evidence.

Cons:

- independently generated halves can disagree and force abstention;
- doubles verifier calls without making one atomic clean decision;
- finding work depends conceptually on another response even when nodes are statically listed;
- recreates the status vectors that failed Candidate L.

Ranking:
Option A > Option B > Option C.
Option A ranks over Option B because Candidate L measured complete failure under combined exhaustive review,
while role splitting removes that measured burden and keeps atomic decisions.
Option B ranks over Option C because one complete challenge is auditable without reconciling independently generated halves.

### Author options considered

#### Option A: closed risk attestations plus 27 values

Pros:

- changes author responsibility and schema enough to be a new substantive protocol;
- directly foregrounds the actor and event-attachment defects found in Candidate L;
- adds a bounded attention mechanism without serial editing or dynamic work;
- preserves immutable-shell compilation.

Cons:

- attestations are not independently trustworthy and cannot count as quality evidence;
- extra fields can increase schema-following burden;
- the same model can attest despite still making the named defect.

#### Option B: values-only author with rewritten prose instructions

Pros:

- keeps the smallest response;
- MiniMax already completed Candidate L's 27-value schema;
- introduces no new admission surface.

Cons:

- differs from a spent Candidate L prompt mainly by wording;
- provides weak prompt-uniqueness evidence;
- adds no structural attention to the measured actor and attachment failures.

#### Option C: readable review-plan author

Pros:

- exposes every source clause and relation before writing;
- gives the author the richest explicit coverage plan;
- reuses implemented plan evidence.

Cons:

- Candidate K measured zero admitted authors under this responsibility;
- Qwen returned unparseable tool JSON;
- GLM and MiniMax exhausted the output ceiling;
- it repeats a rejected producer interface.

Ranking:
Option A > Option B > Option C.
Option A ranks over Option B because its changed response and admission contract provide structural prompt uniqueness and
focus the measured defect classes.
Option B ranks over Option C because a lean values-only producer has one measured admitted result,
while readable-plan authors admitted none.

### Candidate M acceptance controls

Candidate M cannot enter live calibration until tests and GFP controls prove:

- manifest version 3,
  exact `candidate-m-risk-challenger` discriminator,
  stale-version refusal,
  two authors,
  two roles,
  three verifier families,
  14-node ceiling,
  and exact static skips;
- author packets contain the generic risk register but omit Candidate L and Candidate K reviewer bookkeeping;
- exact 27 values plus the six-key `riskAttestations` object and sole `checked` alphabet;
- manifested attestation order through exact `Object.keys` comparison,
  order-shuffle,
  duplicate,
  missing,
  unknown,
  extra,
  and wrong-code rejection;
- attestation digest binding through protocol,
  schema,
  manifest,
  candidate proof,
  and restart,
  with no attestation contributing to selection;
- each role's schema,
  allowed finding classes,
  source evidence,
  target anchors,
  candidate binding,
  and first-defect cardinality;
- clean means zero findings and defect means exactly one finding;
- two-family nonself clean evidence independently for both roles;
- self clean exclusion and self defect veto;
- deterministic fallback order and explicit ineligibility below either role floor;
- the exact role-to-defect-class table,
  exact source namespace,
  class-to-source-scope table,
  and class-specific source,
  target,
  and image evidence cardinality;
- GFP wrong-scope mutations for front matter,
  clause,
  and relation evidence;
- shared actor-reference,
  event-ownership,
  and reference-attachment vetoes that never become clean evidence;
- atomic abstention for unknown,
  out-of-role,
  or invalidly evidenced classes,
  and no handoff behavior;
- abstention as neither clean nor dissent,
  self abstention as no effect,
  and nonself abstention as role-floor absence only;
- all images,
  provider isolation,
  prompt uniqueness,
  raw duplicate rejection,
  exact abort identity,
  all-sibling settlement,
  indeterminate transmission,
  and zero-call restart;
- realistic maximum request serialization below the manifested client limit;
- complete-Carena request-envelope tokenization under each exact model tokenizer;
- when an exact tokenizer is unavailable,
  an authenticated provider token-count endpoint or a previously accepted larger envelope with identical static content
  and a proved conservative token relation;
- a route marked unmeasured and no live spend when neither evidence path exists;
- synthetic forced-tool probes treated only as route compatibility,
  never as evidence that complete-page GLM work will finish;
- author deadline 1,800,000 milliseconds,
  challenger deadline 900,000 milliseconds,
  and 32,000 output tokens bound into protocol and manifest identity;
- targeted lint,
  types,
  rebuilt tests,
  full `buildAndTest`,
  GFP mutations,
  and advisor review;
- a self-hashed no-key harness independently proves all 14 static request bindings before one pinned-Carena spend;
- complete source,
  archive,
  image,
  and every admitted candidate are read before any production disposition,
  because clean challenges no longer expose per-subject status coverage.

The longer author deadline is a finite calibration bound,
not a claim that Qwen will complete.
The challenger deadline does not mitigate GLM's output-ceiling behavior.
Any failure at either boundary remains terminal for that one new prompt.

### Candidate M implementation evidence

Candidate M's contract foundation is commit `88e8bb97b`.
Its generic architecture-specific node failure records,
two-author lifecycle,
12-challenger role wave,
selection,
restart,
cancellation,
and test surface are commit `562e9948b`.
The detached-worktree GFP harness and its command-scoped mise trust boundary are commit `717bd8a08`.
All three commits are present on the GitHub branch
`prototype/translation-repair-finite-pipelines`.

Targeted type-aware lint completed with zero warnings and zero errors.
Type checking,
Candidate M tests,
Candidate L regression tests,
and Candidate K regression tests passed after rebuilding `dist/`.
Full package `buildAndTest` completed with 880 runner-prefixed `PASS` verdicts and zero `FAIL` verdicts.

The reproducible harness is
`package/module/translation-repair/src/corpus-run/prototype-risk-challenger-gfp.ts` and its three named helper modules.
Its source-set SHA-256 is
`903b1bd54ffdb86d99b5f0f4f35890f4122ca1d54c9e5cf041d59ff7991bd002`
and is recorded by the adjacent sanitized JSON summary.
The adjacent sanitized JSON summary is commit `d9305094f` and retains only source identity,
mutation names,
gate phases,
exit codes,
restored-baseline status,
publication `dist` before and after identity,
and leftover disposable-worktree count.
The harness proved targeted-test detection for seven restored mutations:

- clean or defect finding cardinality;
- source-plan and schema binding helper;
- runtime schema reconstruction against persisted plan identity;
- Candidate M restart failure-category whitelist;
- author admission failure-category persistence;
- strict per-role nonself family floor;
- between-wave cancellation before challenger-plan creation.

Every mutation rebuilt successfully and then failed the targeted Candidate M test gate.
The restored rebuild and targeted test passed.
After the architecture-specific failure-category refactor,
an independent advisor's sole blocker was that the newest helper and restart-test edits had not yet passed the required gates.
Those targeted gates,
GFP controls,
and the full package gate subsequently passed.
### Candidate M calibration preflight

The public calibration artifact is pinned by byte digest,
not by mutable gist identity.
Its revision-specific GitHub location is
[Candidate M calibration revision `b6c9fb5e`][candidate-m-calibration-gist].
The exact harness SHA-256 is
`6f0004e010d1477c3e2eea84287d03d21724495d6c2595d8fceef9131b3bb952`.
The same revision retains sanitized envelope generators,
exact tokenizer counts,
and no-key preflight metadata without corpus wording,
image bytes,
credentials,
or provider payloads.

Pinned official tokenizer artifacts measured these complete textual requests:

- Qwen author:
  15,120 tokens;
- MiniMax author:
  14,355 tokens;
- Qwen challengers:
  at most 60,320 tokens;
- GLM challengers:
  at most 55,556 tokens;
- MiniMax challengers:
  at most 51,974 tokens.

Each request carries the same pinned 2048 by 2048 page image that reached its corresponding Hyper route during Candidate
L.
The live harness exact-tokenizes every actual request before transport and rejects any challenger exceeding its same-model,
same-image retained-candidate ceiling.
The live catalog pins context windows of 1,000,000 tokens for Qwen,
1,048,576 for GLM,
and 512,000 for MiniMax,
plus complete canonical catalog-row digests.

A fresh download from that revision matched the harness digest.
Its final no-key run reached absent-key failure digest
`5e84ae43d4940471c17dded79af1e4c64f031f1099d76d818cf776a793f07ca2`,
emitted no stack or local path,
and left the calibration output root absent.
It pinned the prototype commit,
complete built MJS tree,
entry artifact,
source,
archive,
image,
full catalog rows,
manifest,
review plan,
provider routes,
14 exact node bindings,
and deterministic fixture candidates.
An independent final review found no remaining launch blocker when the live invocation omits the already-used preflight
output path.

The live run must set `umask(0o077)`,
require directory mode `0700` and file mode `0600`,
and verify those modes recursively on success or failure.
It is authorized for one spend only.
If Candidate M fails,
all further implementation stops and the redesign moves directly to the timestamped retrospective and complete takeover
documentation.

### Candidate M calibration result

Candidate M is rejected after its single pinned-Carena live calibration.
The exact GitHub harness,
prototype,
manifest,
corpus,
built tree,
source,
archive,
image,
catalog,
route,
schema,
and node bindings matched the preflight pins.
No non-default reasoning,
thinking,
effort,
temperature,
or retry parameter was sent.
Every request carried the page image.

The run reached all 14 terminal static nodes:

- eight provider exchanges;
- four completed nodes;
- four spent-unusable nodes;
- six deterministic skips.

Qwen produced the sole admitted candidate.
MiniMax's author stopped at 32,000 output tokens.
Qwen's fidelity challenge completed clean but was self-clean and could not qualify.
Qwen's publication-language challenge failed exact anchor admission.
Both GLM challenges stopped at 32,000 output tokens.
Both MiniMax challenges completed clean.

Only MiniMax supplied clean nonself evidence for each role.
The selected private fallback therefore recorded
`evidenceFloorMet: false` and `productionEligible: false`.
It had no admitted dissent,
with Qwen and GLM recorded as abstaining verifier identities.

The run's own restart and one independent offline restart each made zero transport calls and reproduced the persisted
result.
The independent replay left the 43-file pre-post-audit runtime tree byte-identical.
All private output-root directories and files are mode `0700` and `0600`,
respectively.

Complete reading covered all 59 source lines,
61 archive lines,
57 candidate lines,
and the 2,048 by 2,048 page image.
Front matter,
contributor identity,
link,
media reference,
and footnote destination survived.
The candidate was independently rejected for publication-language,
source-structure,
fidelity-omission,
actor-attribution,
and unsupported-emphasis defect classes.
The evidence-floor failure alone already made Candidate M a failed calibration under its settled contract.

The full timestamped disposition,
A through M retrace,
private evidence paths,
and future hypotheses are in
[`translation-repair-redesign-failure-2026-09-01.md`](../audit/translation-repair-redesign-failure-2026-09-01.md).
No further implementation is authorized.
Candidate M and every prior tested candidate remain ineligible for production.
No spent or skipped Candidate M prompt may be dispatched later.

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

[candidate-m-calibration-gist]: https://gist.github.com/Aquaticat/6ff4fd2f600fc257064aa32eee4c9753/b6c9fb5ebf943a5cd8cfeebbb4c6a2fbbc1e6654
