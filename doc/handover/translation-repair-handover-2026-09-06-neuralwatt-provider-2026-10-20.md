# Translation repair handover 2026-09-06: NeuralWatt as a provider, 2026-10-20

NeuralWatt joined the pipeline on 2026-10-20 as its first provider:
the owner's terms,
the meter and the stop that was built and removed,
the day boundary and account-wide count the owner then ruled,
the move to the DeepSeek V4.1 Flash 1017 weights,
and the first run on it,
`zheermao19`.

Part of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
which lists every file of this record.

## The owner's terms

The owner added `TRANSLATION_REPAIR_NEURALWATT_API_KEY` on 2026-10-20 with
"550Wh of energy on DeepSeek V4.1 Flash and GLM 5.3 Flash per day"
and "we need to meter (using estimations) ourselves because overage eats into my normal plan".
The 550 Wh is the Max plan's 500 Wh plus the 50 Wh for product-news email
(`https://docs.neuralwatt.com/billing/daily-free-energy`).
That page says it resets at 00:00 UTC;
for this account the day starts at the quota's anchor instead
(the section "The day boundary,
the account-wide count and the key allowance").
It does not carry over,
covers each covered model's standard and flex lanes and not `-speed`,
and once spent requests bill the plan.

Served ids `deepseek-v4.1-flash` and `glm-5.3-flash`,
standard lane only;
first in the provider order,
by the rule that expiring money is spent first
and by the owner's ruling of 2026-10-20:
"Use the neuralwatt free energy front and center."
Every seat of the two models goes to NeuralWatt first in every role it already holds;
no new roles,
and the owner's 2026-09-02 unseating of GLM-5.3-Flash as a judge stands.
The meter's margin is kept as small as can be justified,
so free energy is not left unspent.
The encrypted store `.env.local.json` went to the branch worktree on 2026-10-20 (main's copy,
a strict superset of the old one by key names);
the scratch gate worktrees stay keyless.

## The meter as first built

No endpoint was then known to report what is left of the free energy
(`/v1/quota` reports the plan's `kwh_used`,
`/v1/usage/energy` the account's days),
so the pipeline keeps its own meter,
as the Bedrock ledger does:
reserve an estimate per call from the energy matrix's prompt-size buckets,
settle with the stream's `: energy` comment,
and read `/v1/quota` at start and end of a run.

It was built in keyless worktree w242
(base `7900a9a639`,
16 commits `8fca5003b7` to `ce1b710326`,
then docs and test commits to `0a4570d563`);
handback `/var/home/user/temp/agent/x15-fix/neuralwatt/handback.md`;
decision record `doc/decision/translation-repair-neuralwatt-provider.md`
(no cache version moves,
veto-open);
ledger P15 in `package/translation-repair/doc/audit-ledger-providers-routing-and-seating.md`.
Gate g129 on `ce1b710326`:
suite 2630 pass and 31 fail,
all 31 in `source-scan`'s scans finding the new code
(fixed in w242);
oxlint red in 21 packages on `prefer-readonly-parameter-type` alone
(105 errors),
tuple-destructured callbacks in files the branch never touched.
Main's TypeScript 7.1.0-beta move (`27b1cf2eec`) landed after the green gate g128,
and baseline gate g130 on main `a4987be78a` is red the same way:
the same 105 errors in the same 21 packages,
suite 2608 pass and 0 fail.
`doc/troubleshooting/typescript-is-tuple-type-tuple-reference.md` explains them:
7.1 hands the plugin the tuple reference,
so mutable tuples from `Object.entries` and `Map.entries` callbacks now surface,
and the offers are sound.
Landed as `1dde8c5cd6` after gate g131
(suite 2631 pass and 0 fail,
lint red only on the inherited 105).

## The first keyed call and the stop that was removed

`zheermao18` launched at 22:22 UTC on that build;
its first NeuralWatt call used 0.0167 Wh,
a tiny share of the day's 550 Wh,
yet reported a `request_cost_usd` of 0.000107.
The meter as built never looked at the energy here:
it took any cost above zero as proof that the free energy was spent and the plan was being charged,
so after that one call it marked NeuralWatt out of energy until 00:00 UTC.
That rule was the defect.
The run went on spending Hyper until it was stopped at 22:30 UTC after 21 Hyper calls.
The owner read the dashboard
("Your call only used 60.3J,
which isn't even 0.0%")
and ruled:
"From here on just use NeuralWatt normally,
I can tolerate some potential losses.
If it works wrongly I'll tell you."
The stop was removed
(red `265cb0d224`,
fix `05330e45c4`,
docs `1c4c10b4d1`;
legacy ledger lines that carry `billedUsd` read as plain energy lines),
landed as `5b5dca49a9` after gate g132
(suite 2648 pass and 0 fail,
lint red only on the inherited 105);
record and ledger P16 landed in `745b51e38d`.
The branch worktree's build digest matched w243's:
`sha256-tree-v1:f706c65f04541d1d043d5d39c4597ef034b537c8a73e827ef8c937da7c6d4ee9`.

The 105 `prefer-readonly-parameter-type` findings were fixed type-only in keyless worktree w246
(explicit deeply readonly entry types at the package's own boundaries,
never by loosening the rule;
the build digest unchanged),
folded into one `ReadonlyEntry` in `shared-contract` (`d390fd0f86`),
and landed as `506972d0e4` after gate g133
(2631 pass and 0 fail,
every lint step exit 0).
Four of its commit bodies claimed more than ran;
corrective comments 205886719,
205886729,
205886731 and 205886736 say what did.

## The day boundary, the account-wide count and the key allowance

The owner then ruled
(about 23:15 UTC):
`The stop logic should obviously count total free energy used per day. Every neuralwatt day starts at 15:15`.
Read-only calls confirmed both
(`/v1/quota` `current_period_start` `2026-10-20T19:15:08Z`,
which is 15:15 EDT;
`/v1/usage/by-model` account-wide covered energy 4.095 Wh against the ledger's 4.094 Wh;
record section "The day boundary and the account-wide count",
ledger P17).
The fix is being built in keyless worktree w247:
the day anchored at the quota's time of day,
spent energy the account-wide covered total since the anchor,
never below the ledger,
plus calls in flight.
`zheermao19` kept the old build;
its 00:00 UTC ledger reset would hand back about 20 Wh NeuralWatt still counts,
far inside the 550 Wh,
so it was not stopped.

The owner then set a 1 kWh daily limit on this key
("I've also just setup a 1kWh daily limit on this specific api key");
`/v1/quota` still reported `key.allowance: null` at 23:15 and 23:20 UTC,
and `/v1/usage/by-key` `budget_limit_usd: null` on both keys,
so w247 also reads the documented USD allowance (`blocked` makes NeuralWatt dry until `reset_at`)
and prints it on the `METERS` line.

## The DeepSeek V4.1 Flash 1017 weights

The owner asked:
"Migrate to deepseek v4 flash 1017 where possible."
Catalogs read at about 23:30 UTC:
NeuralWatt's `deepseek-v4.1-flash` already serves `deepseek-ai/DeepSeek-V4.1-Flash-1017`;
Hyper lists `deepseek-v4.1-flash-1017`,
OpenRouter `deepseek/deepseek-v4.1-flash-1017`
(Morph serves it at 0.158 and 0.6),
Synthetic `hf:deepseek-ai/DeepSeek-V4.1-Flash-1017`
(the card has no Synthetic side;
none is added).
Keyless worktree w248 moved the card's Hyper and OpenRouter served ids,
keeping the roster id `deepseek-v4.1-flash` as the card's name
(red `ad616b6a84`,
fix `dadeb42ba6`,
docs `1d610cd05e`),
landed as `d8cf1933f4` after gate g134 on the merge with main
(2648 pass and 0 fail,
every step exit 0).
`hyperIdFor` had matched on the Hyper id and would have read the seat as unserved,
so `HyperModelInfo` now carries `rosterId`;
`hyper-price.ts` gained a `deepseek-v4.1-flash-1017` row,
since the `SPEND` label is the wire id.

No cache version moves.
No cache key holds a served id,
and the weights behind the name changed,
but the slice cache lives inside each run's own directory
(`package/translation-repair/run/src/corpus-run/runs-layout.ts`),
so a new run starts with none of the old weights' decisions.
NeuralWatt's side served the 1017 weights before the migration too.

## The first run on NeuralWatt: zheermao19

`zheermao19` (entry zheermao101) ran from 23:00 UTC on 2026-10-20 on the digest of `5b5dca49a9`
and settled at 23:35 UTC in 35.6 min
(`TALLY zheermao101 status=SETTLED ... repairAccepted=13 ... pageChanged=9`);
its read is in the pass log of 2026-10-20,
the full draft at `/var/home/user/temp/agent/x15-fix/reads/zheermao19-read.md`.
NeuralWatt served 197 calls for 28.7 Wh measured,
every estimate running 2 to 6 times its measured figure;
the run-end `NeuralWatt PLAN ENERGY SPENT: 345.2 Wh` line is the owner's other key
(`mimo-v2.6-pro` rose 335 Wh between 23:15 and 23:36 UTC by `/v1/usage/by-model`).
Hyper reached `hyperBalance=0` and Synthetic `syntheticWeekly=0%` during the run;
Hyper is not recharged.

The Bedrock key has expired
(HTTP 401 "The security token included in the request has expired.",
already on `zheermao17`'s three Gemma seats),
and the owner ruled on 2026-10-20 to leave Bedrock off rather than issue a new key.
The run then withheld each Gemma seat for the whole run after 4 refused asks,
though `gemma-4-26b-a4b-it` and `google.gemma-4-31b` have OpenRouter sides with no holds
and OpenRouter was wet:
a credential refusal belongs to the provider,
not the seat.
Keyless worktree w249 makes it hold the provider out for the run and move each seat to its next provider
(red `5e07a8bb6d`,
fix `786013e4b7`,
guards `de44d19ea7`,
docs `7863b003b1`).
Withholding the seat was a default and not a ruling:
ledger B685 says "there is no rule for a 401".
A second round closed its four gaps
(red `987b4ef553`,
fix `e9d0c5cd6f`,
docs `d3c8727aad` and `f1f7c15d94`):
a 401 on the cross-provider re-ask holds the provider too,
the warn names only providers that can take the call,
reach and quorum readers read a held provider as dry,
and `corpus-pass` builds one router per run,
so its holds are shared across the run.
Landed as `624c5ff583` after gate g135
(2657 pass and 0 fail,
every step exit 0);
ledger P18 landed in `803c85d603`.
`google.gemma-4-e2b` is Bedrock-only and stays out.
The rotation waits for the combined build,
since a run now would lose those seats again and spend OpenRouter credit on a build about to change.

The account-wide count in w247 also had to take in tracking aliases:
a call to `nw-flash`
(which points at `deepseek-v4.1-flash`)
is listed in `products[]` under `requested_model` `nw-flash`
(`https://docs.neuralwatt.com/guides/tracking-aliases`),
and the first w247 filter counted only the served ids and their `-flex` twins.
The w247 agent was asked at 00:40 UTC on 2026-10-21 to count alias rows whose alias points at a covered model,
read from `GET /v1/models`.

## Next

The `zheermao19` read is recorded in the pass log of 2026-10-20:
SETTLED with no class traced to code,
on a short bench,
its page losing several intensifiers and small words zheermao17's had kept.
Done since:
w249 landed as `624c5ff583` (ledger P18);
the energy recalibration
(measured means for the 4,096 to 16,384 token bucket and a margin of 1,
ledger P19),
w247's account-wide day with its alias rows,
and the retry of an unknown day anchor
(ledger P17)
were merged in w252,
gated by g136
(2680 pass,
0 fail)
and landed as `31ce5369e1` on 2026-10-21 (UTC).
The branch worktree and w252 digest that build alike
(`sha256-tree-v1:e9eda9fe032032f4896f29b0c82099ae5b04084f209ce37144bb83d78eadcfcd`).
No cache version moved:
every commit since `5b5dca49a9` outside the provider package is a type-only change,
the credential hold
or the DeepSeek 1017 ids,
and `dadeb42ba6` found no cache key that reads a served id.
Its body left reusing decisions cached under the pre-1017 weights to the owner;
this session decided to keep them,
since a version bump discards every model's cached decisions of that stage,
not only DeepSeek's
(veto-open).

`zheermao20` (entry zheermao101) runs from 02:15 UTC on 2026-10-21 on that build.
Its log shows the anchor learned from the quota
(`NeuralWatt day starts at 19:15:08.000 UTC every day`),
the by-model usage read,
NeuralWatt wet
and DeepSeek and GLM calls settling on it.
It settled in 1,977,563 ms of pass
(`TALLY zheermao101 status=SETTLED slices=15 ... repairAccepted=13 ... pageChanged=8 ... selection=contested`),
and its end report read
`NeuralWatt plan energy: no plan energy was spent between the start and the end of the run`.
Its 215 settled NeuralWatt calls measured 31.33 Wh in all.
In the 4,096 to 16,384 token bucket the measured means
are DeepSeek 0.0819 Wh over 156 calls against 0.0758 Wh estimated
and GLM 0.3686 Wh over 49 calls against 0.3725 Wh,
so the bucket's recalibration holds;
the other buckets hold 2 to 4 calls each,
too few to recalibrate.
OpenRouter's reported cost was USD 0.498.

The page read is recorded in
[the pass log of 2026-10-21](../planning/translation-repair-openrouter-2026-09-03-2026-10-21.md):
no class traced to code;
the letter fell back toward the archive,
because the archive block review picks one whole revision
and only two narrow revisions reached it.
An investigation of two seating questions ran as a read-only Sonnet agent.
The seating questions:
why `glm-5.3` was seated at preparation though its every provider was out of budget,
and why `hf:Qwen/Qwen3.8-27B` stayed seatable,
and was re-seated as a checker under a hold,
after Synthetic ran dry,
when `hf:moonshotai/Kimi-K3` was withheld
(it threw 137 of 158 asks).
The investigation found the seating as documented.
`doc/decision/translation-repair-short-bench-share.md` keeps a seat no wet provider serves on the bench,
to be lost at call time.
The checker bench pads with unserved seats up to three.
Kimi-K3 was withheld by the owner's OpenRouter cost rule
(`OPENROUTER_WITHHELD`),
which does not name Qwen.
One defect stands,
checked against `package/translation-repair/stage/src/seat-tally.ts`:
`recordThrow` counts the router's own refusal (`NoProviderForModelError`) as an ask that threw,
where the decision says a refusal is not an ask.
So `glm-5.3` reads `asked=4 threw=4` though it was never sent a request,
Qwen's 137 throws are almost all such refusals,
and the tally withholds such a seat for the run even if a provider becomes wet again.
Neither `JUDGE SEATS` nor the re-seat line names a seated seat no wet provider serves.
The fix,
red first,
is queued in keyless worktree w254:
the refusal counts as `unreachable`,
`JUDGE SEATS` names the unserved seats,
and the re-seat line marks its padding.
`CuspariaKLSY20` (entry CuspariaKLSY) ran on the same build from 02:52 UTC on 2026-10-21
and settled in 690,310 ms of pass
(`TALLY CuspariaKLSY status=SETTLED slices=4 ... repairAccepted=21 ... pageChanged=4 ... selection=contested`),
again with no plan energy spent;
its read in the same pass log found no class
and a better page than CuspariaKLSY19's.
Its 80 settled NeuralWatt calls measured 21.19 Wh.
In the 4,096 to 16,384 token bucket its means were well over the estimates:
DeepSeek 0.1996 Wh over 62 calls against 0.0758 Wh,
GLM 0.5500 Wh over 16 calls against 0.3725 Wh.
So the bucket's mean moves a great deal from entry to entry,
and two runs are too few to recalibrate from.
What an estimate costs when it runs low is the energy of calls in flight at the daily boundary,
since every settled call counts its measured energy;
the day stood at about 52 Wh of 550 after these two runs.
Open:
whether the estimate should follow the measured mean of the run in progress,
decided once more runs have settled.

XingZ60 is held until w253 and w254 land:
a fix that lands changes the build,
the rotation then restarts at `zheermao101`,
and a read of XingZ60 on this build would not count,
while it would spend a large share of the day's free energy.
The B701 rotation sweep landed as `7c9d5fa35f` after gate g137
(2690 pass,
0 fail).

Two defects the w247 and w251 agents reported were fixed in keyless worktree w253,
red first:

- `createNeuralWattQuotaSession` (`package/translation-repair/provider/src/neuralwatt-quota-session.ts`)
  cached a failed first quota read as the run's baseline for good,
  so when the day-anchor retry later read the quota,
  the end report still said the starting reading could not be taken.
  It now tries the baseline again no sooner than `NEURALWATT_QUOTA_RETRY_SECONDS` (60 s) later,
  takes the first successful `readNow` after a failed baseline as the baseline,
  and the end report says the comparison starts late
  (`laterStartAt`;
  ledger P20).
- A failed rotation sweep printed a stack trace where an operator-facing refusal is meant.
  It now prints a refusal naming the failing cases and exits 6,
  and a bad option is refused the same way by `SweepOptionRefusalError`
  (ledger B710).
  The process-global writes guard
  (`package/translation-repair/source-scan/src/global-writes-sequenced.unit.test.ts`)
  gains a `PROCESS_ENTRIES` list naming only `source-scan/rotation-sweep/rotation-sweep-cli.test-fixture.ts`:
  that fixture is a process's own entry,
  so its `process.exitCode` write outside any case is allowed there and nowhere else;
  its other findings still count,
  and the package case fails if the named file is gone.
  This session accepted the exception after reading the diff
  (veto-open).

The seating defect was fixed in keyless worktree w254,
red first
(ledger B711):
the router's refusal counts as `unreachable`,
never as an ask or a throw,
so it moves no withholding threshold;
the `SEAT` line prints `unreachable=`;
`JUDGE SEATS` prints `unserved=`;
and the repair lane's re-seat line ends with `unserved-checkers=`.
This session accepted the agent's choices
(veto-open):
a refusal after the caller aborted counts `unreachable` rather than `abandoned`;
a seat the owner's cull refuses counts `unreachable` too;
and only the repair lane's re-seat line marks padding.
Both agents took B710 as the next free id;
w253 numbered first,
so w254's entry became B711 in the merge commit `22cd3e200c`,
and the subjects of `1ce1e851b0`
and `29ce2d9daa`
and `f239810f90` still say B710.
Gate g138 on that merge was green
(145 steps as in g137;
2693 pass,
0 fail),
and it landed as `3637592bd4` on 2026-10-21 (UTC).
Corrective commit comments name B711 on the three subjects
and the case count on `da0ec11dd6`.
The branch worktree was rebuilt at `3637592bd4`;
it and w254 build alike
(`sha256-tree-v1:06c97a69446dc452fa2c602da834c36febb7f0d7b4b1010b5dfa9fab81097eec`).
Since w254 added scripted cases that name seats,
the rotation sweep runs on w254 before the rotation restarts at `zheermao101`.

A read-only investigation of the zheermao20 letter
(recorded in the pass log of 2026-10-21)
found the archive block review as documented,
with three gaps,
and a fourth question.
This session decided to fix all four,
red first,
in keyless worktrees based on `22cd3e200c`,
with ledger ids assigned in advance so the merge does not collide again:

- B712:
  a composite candidate built from revisions that keep the block's line count and change disjoint lines,
  checked by the same shape and footnote gates,
  as the editor lane already builds
  (`package/translation-repair/repair/src/editor-candidates.ts`)
  (veto-open).
- B713:
  the review round gets the writer window
  (180000ms),
  since its revise replies are writer voices under the owner's writer rule;
  the select round keeps 120000ms
  (veto-open).
- B714:
  `repairArchiveBlocks` keeps the stage's findings in the artifact,
  so a block that lost a writer shows it.
- B715:
  trace why both `source-supported` replies on the letter were dropped as unanchored,
  and fix it if the anchor test refuses a valid quote.

B712 to B714 run in w255,
B715 in w256.
B715 is done in w256
(`4e0cbc1b5f` to `c9e9f735d9`;
not landed):
one of the two dropped replies was refused because the anchor compared a quote with a picture transcript's hard line breaks,
and now anchors through the whitespace-free `quoteIsIn` the reference attestation uses;
the other stitches three runs from two pictures and stays refused by design;
every dropped reply is now logged with its reason.
Accepted veto-open:
whitespace set aside entirely rather than line breaks only,
the sheet's wording unchanged,
and quotes spanning pictures still refused.
After landing,
post corrective commit comments on `4e0cbc1b5f` and `e0dbf84a38`:
their messages say the stitched quote also reaches photo3,
which the replay disproves.
B712 to B714 are done in w255
(`a38bc52e29` to `bfff357798`;
not landed),
each red first,
with the package units,
lint and source scans green and no cache version moving.
Accepted veto-open beyond the review round's 180 s window:
no composite when any changing revision differs in line count,
an identical change to one line counts as an overlap,
three revisions with only two disjoint build none,
a revision equal to the archive contributes nothing,
and the stage's findings travel verbatim,
reviewer reasons included.
After landing,
post corrective commit comments on `49194af623`
(16 cases,
15 of them red,
not fifteen)
and `96d9d0be32`
(five files pin the launch line,
not four).
w255 and w256 merged in w257 at `0818ca282a`
(two index-list conflicts,
both sides kept).
In w257,
red first,
before gate g139:
the composite reaches the judges with its contributors' assessments
(it reached them with none,
because evidence is matched by a voice's proposed text);
`archive-block-repair.ts` refuses a missed `archiveBlockSourceContexts` lookup
instead of anchoring against `''`;
and the launch line drops B713's dated veto note,
which belongs in the decision doc,
not in every run log.
Then gate g139 on w257,
land,
the corrective comments,
rebuild the branch worktree,
a new frozen digest,
the rotation sweep,
and the rotation restarts at `zheermao101`.
On the g138 build,
`zheermao21` and `CuspariaKLSY21` shipped SETTLED
(reads running),
and `XingZ6016` stopped INCOMPLETE:
its one picture got a single reading
(`minimax-m3`;
`GLM-5.3-Flash` replied empty,
Qwen's provider out of budget,
both Gemma readers on Bedrock),
so nothing corroborated it.
The rotation on that build is held there,
since it can no longer finish with every page SETTLED.
The two settled reads
(`zheermao21-read.md` and `CuspariaKLSY21-read.md` in the reads folder)
are being traced to causes before any of them is called a class:
a 2 to 2 polish gate keeping "was given to her" for 起的,
a repair correction accepted 4 to 0 lost when the translate lane won its slice,
已经,
一直,
观望 and 二次元 dropped,
the opening quote losing 有一天 and 你 to a minimum-weight rule,
the email's lines thinner than `zheermao20`'s,
two U+2014 dashes,
a probe that closed short,
and a 0.372 Wh gap between the meter and the account.
The 抢救 rendering "doctors fought to save her" is the glossary's on purpose.
Classes found there are fixed before gate g139 too,
since a restarted rotation would meet them again.

The owner rebooted the machine on 2026-10-21 with three agents halted mid-task,
each told to write its state down first;
no pass,
gate or sweep unit was running.
Resume each from its own handover:

- w257 follow-ups
  (composite evidence,
  the source-context lookup,
  the launch-line note):
  `/var/home/user/temp/agent/tr-fan/w257-notes/handover.md`,
  commits in w257 on top of `0818ca282a`.
- Picture bench investigation:
  the "Handover" section of `/var/home/user/temp/agent/x15-fix/reads/XingZ6016-pictures.md`.
- Tracing the two reads' findings:
  the "Handover" section of `/var/home/user/temp/agent/x15-fix/reads/rotation-21-classes.md`.

The reads themselves are `zheermao21-read.md` and `CuspariaKLSY21-read.md` beside them,
not yet recorded in the pass log of 2026-10-21.
An investigation of the picture bench runs
(why GLM replied empty,
which wet vision readers could replace the Bedrock seats);
its fix joins w257 before gate g139.
The rotation had restarted on the g138 build without waiting for them:
the day's free energy is spent either way,
and a read on that build still finds defects.

The sweep's salts covering a bench of at most nine seats is already recorded
(`package/translation-repair/doc/audit-ledger-output-decided-by-arrival-order.md`).
