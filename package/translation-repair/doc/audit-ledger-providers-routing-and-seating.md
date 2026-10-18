# Audit ledger: providers, routing and seating

Findings in the provider clients,
the router and the seating of models.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## Providers, routing and seating

Probes and full report:
`~/temp/agent/audit-providers/report.txt`.

### P1: the Bedrock ledger records completed calls only

Status:
fixed 2026-09-28,
each part guarded red first and mutation-checked.
The ledger is the only guard on the owner's card,
and it noted completed calls with usage only;
`bedrockIsDry` read dry at zero while the meter is read once a 60 s freshness window.

- Every billed attempt:
  `2a108dfb3` (guard `e33396294`).
    The retry ladder tells its caller of every attempt that delivered something and failed,
    retried ones included,
  before any rethrow (`onAbandonedAttempt`,
  `transient-retry.ts`):
    a reply the whole-message check refused counts its whole body,
    a stream that ended early what its error says it read.
    Bedrock writes each at its bound
    (no more prompt tokens than body bytes,
  no more completion tokens than `max_tokens`),
    marked `abandoned-bound`,
  on the `SPEND` line and in the ledger (`bedrock-bound-ledger.ts`),
    since whether Bedrock bills output past a cancel is unmeasured and an under-read is the failure.
    OpenRouter writes its reckoned line per attempt;
  it wrapped the whole ladder,
    so an attempt refused and retried inside it left no line.
- No usage:
  `107763dbb` (guard `2770e9ce7`).
    A whole call whose stream carried no usage block is written at its bound,
  marked `unreported-bound`.
    Latent:
  none of 190,009 logged Bedrock calls lacked usage.
- Margin:
  `7cfd5ae4b` (guard `73e70bfab`).
    Bedrock reads dry with 1.33 USD left:
  the most spend any span of one freshness window
    plus the longest Bedrock stream on record (363,790 ms) held over every pass-run log
    (`p1-window-measure2-runs.mjs`) is 1.3245 USD over 822 calls (XingZ628).
    Per-call reservations were considered and not taken:
    the cached reading,
  not the calls in flight,
  is what lets a run spend past zero.
- Reckoned share:
  `a88a87b11` (guard `4364caf88`).
    The reading carries `reckonedUsd` and the `METERS` line `bedrockReckonedUsd`,
    so a reader sees how much of what is left rests on reckoning.
- One-time correction of the live ledger,
  2026-09-28 (`p1-ledger-correction.ts`).
    1,055 Bedrock streams in pass-run logs never reached it
    (344 on gemma-4-26b-a4b,
  693 on gemma-4-e2b,
  14 on gpt-oss-120b,
  4 on gemma-4-31b):
    cut,
  overrun,
  or completed with no `SPEND` line after,
  an attempt the whole-message check refused.
    Each is reckoned at its model's 99th-percentile prompt over paired calls,
    and its generated characters at the model's 10th-percentile characters per token.
    1.3184 USD,
  four lines marked `abandoned`;
  remaining 6.3413 to 5.0229 USD.
    The file before is kept beside it (`bedrock-spend.jsonl.before-p1-correction-2026-09-28T141153.313Z`).
    A conservative reckoning,
  not a bound:
  request bodies are not stored,
  so no byte count exists for them.

Mutation check (`p1-mutants.json`,
`p1b-mutants.json`):
the ladder never telling,
ignoring a refused body,
telling only after the self-ended rethrow,
OpenRouter not reporting,
Bedrock not ledgering an abandoned attempt or a call without usage,
the bound's prompt at a quarter of the bytes or its completion at zero,
the ledger not summing the reckoned share or accepting any mark,
and dryness at zero are each caught;
the control survives.
The first run's verdict on the no-usage mutant was a false survival (see the mutation harness in the process mistakes).
Cache:
the margin moves a Gemma call to OpenRouter sooner as Bedrock nears its credit,
the class P9 accounted;
rides inside all six versions with an account in each;
same slice-cache check,
same result.

### P2: the recovery round never re-asks a seat that answered unreadably before the last round

Status:
fixed in `005692e11` (guard `3549b74be`;
mutation checked with a control).
A seat that answered unreadably now waits for the nudged recovery round,
which re-asks every seat still unreadable
whichever round it came in;
the retry rounds no longer re-send it the same prompt,
which the prompt-uniqueness client answers from memory or disk with the same bytes.
Two older cases scripted unreadable answers that cleared on a same-prompt re-ask,
which no run can do,
and now script the retry rounds' weather as transport failures.
Rides inside all six cache versions.
`stage-quorum.ts` overwrites the unreadable list each round and returns the seat to `pending`,
where the prompt-uniqueness cache answers it with the same bytes;
TianqiChen66620 slice 15's gate settled on neither 2 to 2 with one such voice lost.

### P3: seats the phase knows are unreachable fill the round-0 window

Status:
fixed with guard `9466786dc`,
fix `84a6caa02`.
Every retry round 1 had one or two refused seats in round 0.
The first reading of this entry said rounds then ran to the 360 s deadline;
that was wrong:
no round in TianqiChen66619 or TianqiChen66620 ran past 181 s.
The real cost:
a seat refused in the same millisecond spent the round's spare place,
so the round waited for its slowest reachable voice with no grace or fell through to a retry round.
TianqiChen66620 closed 269 of 421 rounds a seat short with no grace,
2,852 s of the 4,575 s its rounds took.
A refused window seat now hands its place to the next pending seat within the round
(`runGatherRound` `reserve`),
and the seat stays on the bench as the 2026-09-09 rule has it.

### P4: the recall benchmark still seats gpt-oss-120b

Status:
fixed 2026-09-28,
each part guarded red first and mutation-checked.
The owner's cull of 2026-09-24 held on every derived bench,
and nothing stopped a path that named the seat itself.

- Recall judges:
  `460ceb8f4` (guard `b522c3e83`).
    `DEFAULT_JUDGE_MODEL_IDS` listed three judges by hand and still named `hf:openai/gpt-oss-120b`.
    The benchmark now takes its judges from its caller (`judgeModelIds` is required),
    and the recall benchmark passes `RECALL_JUDGE_MODEL_IDS`,
  the wide seats the run derives,
    which every seating rule and the cull reach.
- The run client:
  `9fd80fb28` (guard `6e935644b`).
    `refusingCulledSeats` (`culled-seat-guard.ts`) wraps the routed client
    and throws the `NoProviderForModelError` a round reads as an unreachable seat,
    before any provider is asked,
  on `chatText`,
  `chatJson` and `decide` alike.
    Catalog reach is unchanged:
  the card stays for the catalogs and fixtures,
  and `reachOf` reports what serves a model,
    while the refusal says the owner does not seat it.

Mutation check (`p4-mutants.json`):
the guard never refusing,
the run client unguarded,
and the recall bench naming the culled model are each caught;
the control survives.
No cache moves:
no derived bench seated the culled model since the cull,
so no cached answer came from it.

### P5: the archive-block-review guard rejects a shape its prompt never forbids

Status:
fixed in `8e994bc77` (guard `930096761`;
mutation checked with a control).
All 11 guard rejections in five runs are editorial-context with a non-empty `sourceQuote`.
The prompt asks for "exact source support or empty" and never ties the empty value to that disposition,
and nothing reads an editorial-context quote:
the stage checks the block itself.
`dc51b02d9` fixed the same slip for `revise` on 2026-09-09 and left this one,
the guard-stricter-than-its-prompt family.
Only source-supported retention now needs an anchor.
Archive-block reviews are not cached,
so no version moved.

### P6: the seat tally cannot see an unusable reply

Status:
fixed in `27bc9f951` (guard `a30b43761`;
mutation checked with a control).
`SEAT inception/mercury-2.5 asked=1007 usable=1007 unusable=0` beside 40 schema losses.
The tally sat inside `promptUniqueClient`,
which buys every JSON reply through `chatText` and reads it itself,
so the tally saw text arrive and counted it usable.
It now wraps the client callers hold and settles each JSON call as the outcome its caller gets:
the nudged re-ask elsewhere (P9) is inside that one call,
and a replayed payload counts as an ask,
since its answer is the run's evidence all the same.
The red guard read `asked 2, usable 1, unusable 0` for one unreadable answer:
the second ask was the nudged re-ask,
which the second provider refused,
counted as a seat that threw.
Mutation check (`p6-mutants.json`):
the tally back inside the wrapper,
and a tally reading every JSON outcome as usable,
are each caught.
No cache moves:
the tally reads outcomes and writes nothing a stage reads.

### P7: abandoned-spend estimates mix units

Status:
fixed 2026-09-28.
`7a6635976` (guard `bd8e8ef86`):
overrun and degenerate endings carry `rawChars`,
the raw wire characters delivered,
which `deliveredCharsOf` now returns for every error;
they returned one channel's decoded count,
about a hundredth of it (`completion=5` for 1,633 content characters).
The reckoning never passes the `max_tokens` the call sent.
Card ratios re-measured (`1f5f5e47c`,
kept to pass-run logs in `63455c32b`,
`p7-openrouter-measure-runs.mjs`):
mercury carried 137 where it measures 0.9 over 37,120 streams (it bills far more tokens than it streams);
deepseek-v4.1-flash and mimo carried none (228 and 93);
kimi 140,
minimax 130,
glm-5.3-flash 302,
gemma-4-26b-a4b-it 292,
gpt-oss-120b 286;
the unmeasured default is their median, 184.
The OpenRouter meter stays authoritative;
the run spend meter now reads truer,
so the per-run spend ceiling (`corpus-run/pass-stop-before-next.ts`) can stop new entries sooner.
Mutation check (`p1-mutants.json`,
`p1b-mutants.json`):
a channel count in place of the raw one on either error,
the drain dropping the raw count,
and an uncapped reckoning are each caught.
No cache moves:
nothing a cached answer depends on reads the reckoning.

### P8: a complete JSON value followed by more text is lost

Status:
fixed in `cac097368` (guard `e86cd9f44`;
mutation checked with a control).
36 in five runs,
760 across all logs,
mostly mercury.
The stored TianqiChen666 replies of that shape trail a hyphen line,
a sentence or a stray fence,
every one with the stop reason.
`parseAnswerJson` now reads the whole answer,
then past a false start,
then the value the answer opens with.
Replayed over 587,102 stored replies:
919 recovered and none read differently.
A first ordering put the leading value before the false start and read 18 replies differently:
each held two whole objects,
the first empty or missing a field the second carries,
so the later object is the answer and the false start stays first.
Rides inside all six cache versions.

### P9: the router's cross-provider re-ask never runs in production

Status:
fixed in `7011d72cc` (guard `4d16f4318`);
owner ruled 2026-09-28,
"Enable with the nudge" (`design-commitments.md`).
`promptUniqueClient` buys every JSON reply through `chatText` and reads it itself,
so the router's `chatJson`,
where the re-ask lived,
was never called in a run.
The router now tags each reply with the provider that served it (`servedBy`)
and serves a request carrying `otherThan` on another wet provider serving the model
(`routedTextElsewhere`,
reusing the second-opinion routing,
the slot take and the budget-refusal handling),
throwing `NoProviderForModelError` where none can take it.
The uniqueness wrapper re-asks a reply that could not be used through its own claim path (`nudged-reask.ts`),
so the nudged exchange is claimed and stored like the first and a resumed run replays both;
the payload store replays the tag,
and a payload stored before it existed is not re-asked.
The first answer stands when the re-ask cannot happen or fails,
and the nudged prompt's claim is released.
Decided for quality,
recorded under the commitment:
the re-ask carries `CROSS_PROVIDER_NUDGE`,
worded apart from the recovery round's `RECOVERY_NUDGE`,
since a shared wording would make the round's prompt
this re-ask's digest,
answered from the claims with the reply that already failed;
and it fires on a refusal-shaped reply as on a schema mismatch,
as the router's never-run re-ask did,
with a nudge neutral on why the reply could not be used.
`NoProviderForModelError` moved to its own module so the re-ask can raise it without an import cycle.
Reach (`p9-reach.mjs`,
every log under the agent directory,
unit-test logs included):
157,945 unusable-reply lines,
122,593 on models another provider serves today;
the TianqiChen666 logs hold 134,
so the re-ask adds at most a few exchanges per run.
Mutation check (`p9-mutants.json`):
the re-ask bypassing the claims,
never re-asking,
sharing the recovery nudge,
dropping the hint,
the router ignoring the hint or dropping the tag,
and the store dropping the tag are each caught;
the comment-wording control survives.
Cache:
rides inside all six versions,
with an account in each.

### P10: the deepseek-v4.1-flash card is stale against its own measurement rule

Status:
fixed 2026-09-28:
the card,
the nudge and the census,
each guarded and mutation-checked.
The card named the pooled 99th percentile as "no completed-call distribution of its own yet" after 67,353 calls,
and the recovery round told a model whose reply the cap cut that its shape was wrong.

- The cap:
  `4943d74d5`.
    Re-read over pass-run logs alone (`p10-cap-measure.mjs`,
  `p10-cap-cuts.mjs`),
  499,820 completed calls.
    By the rule (the highest provider p99 with at least 100 calls,
  floored at the pooled 90th),
    deepseek-v4.1-flash reads 13,082 on Hyper,
  the cap itself:
  75 of 4,062 Hyper calls ran to it,
  74 with no content.
    OpenRouter reads 7,531 over 63,291;
  of its 237 calls at the cap,
  the 70 that pair with a stream line are
    69 runaways and one answer.
    The card now carries `13_082` as its own number;
  the runtime value does not move.
    Mimo keeps the pool with its 78 calls named,
  under the 100 the rule reads.
    Every other card's cap comment now says it is the 2026-09-09 reading.
- Why the caps stand (`completion-cap.ts`,
  re-read paragraph).
    Every call since 2026-09-09 carries its cap,
  so a re-read can confirm or lower a cap and never shows a longer answer.
    Seven seat and provider pairs run to their cap on more than one percent of calls since then,
    against the table's "under one percent",
  and where a cut call pairs with its stream nearly every one streamed no content.
    The re-read's pool (p90 2,607,
  p99 10,822) is mostly capped calls,
  nearly a third of them Bedrock Gemma,
    so the pooled constants stay.
    The re-read's scope differs from the 2026-09-09 table's (pass-run logs only,
  where the table read every log),
    which is why Kimi-K3 on Hyper reads 8,496 against the table's 10,921 and minimax-m3 on Hyper 12,207
    (pre-cap calls) against 10,822;
  neither is a defect,
  and no cap moves on them.
- The nudge:
  `ce0ef7b51` (guard `0be7b4437`),
  decided for quality (`design-commitments.md`).
    A lost voice that answered carries its cause (`cut-short` for `truncated-completion` or `truncated-thinking`,
    `off-shape` otherwise),
  and the recovery round asks each cause with its own wording (`recovery-nudge.ts`),
    both groups in one window.
    The off-shape wording is unchanged,
  so a stored payload for it still replays.
    The red guard's probe read both seats re-asked and heard with the same nudge.
    The cross-provider re-ask keeps its neutral wording,
  which is true of a cut reply too.

Mutation check (`p10-mutants.json`):
one wording for both causes,
a cause that never reads cut,
one blind to cut thinking,
the stage call dropping the cause,
the round ignoring it or dropping the cut group,
the deepseek card back on the placeholder,
and the all-dry refusal without its split sentence are each caught;
the control survives.
Cache:
the cut-short nudge changes what such a seat is asked,
so it rides inside all six versions
with an account in each (`dd2d454ab`);
same slice-cache check,
same result.
The census:
`89f642614`,
since a unit test cannot read the logs and a dated test would be a time bomb.
`mise run cap-census -- <logs or directories>` re-reads the rule over pass-run logs per seat and provider,
counts the capped calls that ran to the cap by whether their stream carried content,
and flags a card on the pooled 99th that the rule can now read,
a rule reading off the card,
and cuts over one percent on a provider with enough calls to say.
Its first run matched the scratch measurement (499,820 calls;
deepseek on Hyper 75 of 4,062 at the cap,
74 with no content),
and showed two flag defects before commit:
the placeholder flag fired on the pooled 90th,
which is a measured floor,
and the cut flag fired on Kimi-K3's 20 OpenRouter calls;
both fixed with cases.
Setup step 6 of the corpus-pass runbook runs it,
and its filter was run on the real output.
Mutation check (`p14-mutants.json`):
a wide pairing window,
pairing any stream outcome,
keeping reckoned lines,
the rule ignoring the call minimum or the floor,
cuts counted from before the caps,
the placeholder read off any pool,
and the cut flag on a thin sample are each caught;
the control survives.

### P11: owner-rule enforcement relies on absence rather than a guard

Status:
fixed in `0baa4cb41`;
green on arrival,
since every body already kept the rules,
so the mutation check is its proof.
Qwen3.8-27B and glm-5.3 stayed off OpenRouter only because their cards lacked an OpenRouter block;
the no-thinking,
no-budget,
always-`max_tokens` rules were read only on the Hyper and OpenRouter bodies.
`owner-body-rules.unit.test.ts` reads every request body all four clients send,
text and schema calls,
for `max_tokens` present and no `thinking`,
`budget_tokens`,
`reasoning_effort`,
`reasoning` or `include_reasoning` key at any depth,
and checks that every seat in `OPENROUTER_DROPPED_SEATS` has no OpenRouter block and no OpenRouter reach.
`reachOf` and the OpenRouter picture check now read `OPENROUTER_DROPPED_SEATS` too.
Mutation check (`p4-mutants.json`):
thinking on the Synthetic body,
a budget on the Hyper body,
a reasoning effort on the OpenRouter body,
and no `max_tokens` on the Bedrock body are each caught.
The mutant dropping the new reach condition survives by construction:
no card carries both an OpenRouter block and a drop,
and the card case fails first if one ever does.
No cache moves:
no dropped seat had OpenRouter reach,
so no route changed.

### P12: log lines that cannot be attributed

Status:
fixed 2026-09-28,
each code part guarded red first and mutation-checked;
A11 is its own entry.

- Retry lines never named the model:
  `dc156524b` (guard `db3dae27d`).
    The retry line and the stated-wait line open with the exchange label.
- "ms to quorum" printed when quorum never stood:
  `6d27dab11` (guard `f03900948`).
    Such a round now says `no quorum (heard of needed needed), every ask settled`,
    since its "quorum" mark was only when the last ask settled,
  and the grace after it was nothing.
- `EveryProviderDryError` omitted Bedrock:
  `dc6bd8321` (guard `0857bf052`).
    It lists Bedrock among the providers out of budget,
  says its credit is never topped up,
    and cites the meters the router decided on where it said "no reading cited".
    The first guard checked the whole message for "Bedrock",
  which the refill sentence also carries,
    and the mutant dropping Bedrock from the list survived (`p6-mutants.json`);
    `5cf2889ea` reads every provider in the clause before "Nothing further can be bought",
    and `p12b-mutants.json` catches that mutant and one dropping Hyper.
- `run-config.ts` said Qwen is withheld whenever Synthetic is dry:
  `ab923b266`,
  a comment.
    `run-seats.ts` withholds it while Hyper would serve it,
  Synthetic dry and Hyper wet;
    with both dry no provider serves it and a round reads it as unreachable.

Mutation check (`p6-mutants.json`,
`p12b-mutants.json`):
a round reading as quorate whatever it heard,
the list without Bedrock or Hyper,
the refill sentence without Bedrock,
the refusal without its reading,
and the reading with dry and wet swapped are each caught;
the controls survive.
No cache moves:
log lines and a refusal message only.

### P13: low items

Status:
closed 2026-09-28;
five sub-items fixed,
one refuted with evidence.

#### Retry backoff and caller abort

Fixed in `169b51e8a` (guard `b0cd02da1`;
mutation checked with a control).
The ladder slept its backoff on a timer no signal could end and read the abort after it,
so an aborted or timed-out call held its seat for up to the ladder's 16 s reach.
The sleep now takes the exchange signal and returns at once on its abort.
While there,
`9c10b0a6c` corrected the ladder's reach wording:
`longestBackoffMs` returns `baseMs * 2 ** limit` (16 s),
which its TSDoc,
call site,
test policy
and `31e67a100` all called the last retry's widest window (8 s).
The code value is what the suite pins;
277 of 57,803 logged backoffs slept a stated wait between the two,
and with no model on retry lines (P12) their outcome is unmeasured,
so the wording moved and the behavior stayed.

#### Payment refusal clearing on a downward meter move

Refuted,
recorded at the rule in `de673c843`.
Of 230 payment refusals in the run logs,
198 came from OpenRouter at a wet meter (0.01 to 1.94 USD),
refusing what the balance leaves after in-flight reservations:
8 bodies name `in_flight_budget_exhausted`,
the rest ask for up to 131,072 tokens and are told 1,844 to 84,651 are affordable.
A settling call lowers the balance while freeing its larger reservation,
so clearing only on a rise would hold OpenRouter dry for the rest of a run;
the rule's measured cost is 28 refusals after a downward move.

#### Bedrock stream bound across the retry ladder

Fixed in `b1a4f4b9e` (guard `684df9e91`,
with the `streamBoundMsOverride` test seam;
mutation checked with a control).
The bound is a one-stream measurement (class 148) but was armed once around `exchangeWithRetry`.
It now wraps each attempt inside the transport,
and the ladder rethrows a bound cut,
found through the cause chain,
so the router still holds Bedrock out for the model.
Latent:
all five run cuts ran a single attempt to 60 s.

#### Card prices against the endpoint bought

Fixed in `7ceffe055`,
with no guard (no offline oracle holds the live listing).
GLM-5.3-Flash carried DeepInfra's 0.075 and 0.25 while all 253 of its calls on the three latest TianqiChen666 runs went to Wafer,
listed 2026-09-28 at 0.9 and 0.5;
DeepSeek V4.1 Flash carried the catalog's 0.3 and 1.2 while 812 of 817 went to Morph,
listed at 0.12 and 0.468 and charged at 0.662 to 0.674 of that.
Only the abandoned-spend estimate reads these;
`configuration.md` now says a preferred-endpoint card carries that endpoint's price.

#### Decision seats past reach

Fixed in `a991ef1e1` (guard `cabfa82f4`;
mutation checked with a control,
five mutants caught):
decision-seat structural losses marked reachable,
and decision-seat prompts reaching 30,203 of a 32,000-token context
after `ce824d933` added the house rules with no size check.
The decisions reference documents a 413 for an oversized payload and nothing for a state past the context,
so the endpoint was probed on 2026-09-28 with cat-themed states (under a cent):
a 45,046-character state came back HTTP 400 `max_tokens_exceeded` with the evidence first and with it last,
never a decision on a truncated state.
The same probes measured the house rules at 4,085 tokens (17,493 characters),
Han text at one token a character and English at 4.2 characters a token;
4 of the 13,878 Jev prompts in the run logs would now pass the context.
Not a launch gate:
the largest TianqiChen666 Jev prompt was 4,779 tokens,
from a build before `ce824d933`.
The endpoint is the tokenizer,
so nothing estimates a state's size:
that refusal,
a stage with no typed question and a client with no decisions transport
now read as out of reach,
so the gather sizes its quorum without the seat and never re-asks it
(the 2026-09-09 short-bench rule and the owner's "Count as out of reach").
Rides inside the translate (15),
repair (33) and refine (5) cache versions with written accounts.

### P14: the spend report reads reckoned lines as measured calls

Status:
fixed in `44b392cb1` (guard `be030df79`;
mutation checked with a control),
found 2026-09-28 while scoping the P10 census.
`spend-read.ts` never reads the `estimated=` field,
so `spend-report` counts every reckoned `SPEND` line
(an abandoned OpenRouter attempt,
and since P1 a Bedrock attempt at its bound) as a call the provider reported,
with the reckoned tokens and cost summed in.
2,178 such lines sit in 138 top-level logs under the agent directory.
The writer changed under P1 and P7;
the reader did not,
though the writer's own TSDoc said the mark was there
"so a reader can total such lines beside the others or apart".
`readSpendLine` now reads the mark into `reckoning` (an unknown mark is a damaged record),
the tally counts `reckonedCalls` per seat,
and `spend-report` names them per seat and in a run line;
on shihai4h2 two of GLM-5.3-Flash's 207 calls were reckoned.
The marks live once in `spend-line.ts` (`SPEND_RECKONINGS`,
`isSpendReckoning`),
which the Bedrock ledger reads too,
so a mark added to the writer cannot go unread by either.
The red guard's probe read the reckoned line with no mark,
the seat with no reckoned count,
and a mark the package never writes as a clean record.
Mutation check (`p14-mutants.json`):
the reader ignoring the mark or accepting an unknown one,
and the tally ignoring it,
are each caught.
The shared list missing a mark survived,
since every case iterated the list or used one mark
and only the type check would have refused it;
`6b683e98e` lists the marks the writers pass apart from the list,
and the rerun (`p14b-mutants.json`) catches it.
No cache moves:
nothing a stage reads depends on the spend reader.
