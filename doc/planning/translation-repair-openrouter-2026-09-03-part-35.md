# Translation repair: OpenRouter as the paid fallback provider, part 35

Part 35 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## The calibration is read, the anchor judge loses a seat, and two classes open, 2026-09-09, 21:00 UTC

THE MERCURY CALIBRATION printed `STANDING over 40 rounds` at 20:02 UTC after 176 minutes
(pid 875801,
frozen `3224ff347`,
1.82 USD on OpenRouter,
every Mercury call itself billed `cost=0` by the Inception endpoint).
`inception/mercury-2.5` read 18 of 101 disinterested ballots,
z -0.43 against a 19.5 percent pooled null,
not separated from it,
so it takes the translator and consolidation seats (`028432713`);
`deepseek-v4-pro-0813` read z -3.18,
across the Bonferroni threshold below the null for the second calibration running,
so it leaves the translator seat (`a5e0efc7f`).
Both addenda are in `doc/decision/translation-repair-roster-seating-2026-09-01.md`.
Translators are eight either way,
so the stage quorum stays 4.

CLASS TWENTY-FOUR,
measured rather than assumed:
the price sort of `037d1f650` moved `deepseek-v4-pro-0813` from Parasail to NextBit and
`deepseek-v4-flash-0731` from Wafer and Inceptron to Sail Research,
and those endpoints serve the models WITHOUT their reasoning when no reasoning parameter is sent,
which the owner's standing instruction forbids sending.
Over the second `noname` pass Parasail reasoned on 57 of 57 deepseek-pro streams at a median of 1,397
completion tokens;
over the third `noname`,
the seventh `Mio` and the calibration,
NextBit reasoned on 0 of 342 at a median of 70 to 107,
with a third of its replies under 50 tokens.
Three fidelity probes over the same fourteen questions answered whether that costs fidelity:

- `deepseek-v4-pro-0813` on NextBit,
  no reasoning:
  11 of 14,
  no damaged pick,
  3 declines,
  0.017 USD.
- `deepseek-v4-pro-0813` on CoreWeave,
  reasoning on every stream:
  4 of 14,
  no damaged pick,
  10 declines,
  0.116 USD.
- `deepseek-v4-flash-0731` on Sail Research,
  no reasoning:
  5 of 14,
  no damaged pick,
  9 declines.

The cheap endpoint reads BETTER on this instrument,
and the expensive one declines two and a half times as often,
so the routing stands and no endpoint was ignored.
The measurement build that would have ignored NextBit and DeepInfra was reverted.

THE SEVENTH `Mio` SETTLED at 20:16 UTC after 116 minutes on frozen `19b6043a3`,
15 slices,
`pageChanged=12`,
1,141 calls,
0.59 USD on OpenRouter and 0.19 on Bedrock,
33 abandoned streams reckoned at 0.08.
The three answers of 17:25 UTC and the reach fix all behaved:
zero Kimi-K3 calls on OpenRouter with `withheld=hf:moonshotai/Kimi-K3` on every dry-Synthetic seat line,
183 seat losses recorded as unreachable rather than as lost voices,
slice 3's ineligible standing replaced by its incumbent
("the incumbent passes it and stands in as the wording the slate may keep,
without contest endorsement"),
slice 14's incumbent failing too and the slice withheld from the slate,
no `select-short-bench` finding,
and no `COMMUNITY TERMS` line.
Correction during takeover:
this was not an empty glossary.
The committed file at `2cfad6236` already contains 自切 and 超天酱,
and a call through frozen `5b228736b` emits both for `yuki418330012` but none for `Mio`,
whose source contains neither term.
The seed was already built as the glossary decision records;
no source change or owner input is needed to make those entries available.

THE PAGE IS NOT CLEAN,
and the defect is CLASS TWENTY-FIVE.
The archive renders the two WeChat screenshots of section one as a 1,900-character `Translation:` blockquote;
the page ships without it.
The archive block review revised it away as
"a translator-added factual insertion not present in the original Chinese text",
which is true of the source TEXT and false of the section,
whose pictures carry exactly that conversation:
the review ran at 18:25 to 18:29 UTC inside preparation,
and the readers transcribed `photo6.webp` and `photo7.webp` at 18:30 UTC,
one phase later.
The second such block (`photo3.webp`,
"Quit my QQ groups") survived only because its section's source names the chat in prose.
Everything else on the page reads faithful:
`DESTINATIONS Mio source=4 page=4 dropped=0`,
front matter as the archive has it,
the horizontal rules in place (three,
against the archive's three),
the bare `space.bilibili.com` credit carried,
the memorial poem rendered where the archive carried only its one-line farewell,
straight quotes 0,
ellipses 3 against the archive's 4,
and ten spaced em dashes against the archive's two
(14 of the 93 archive pages use the spaced form,
68 occurrences in all).

CLASS TWENTY-SIX closed the same evening.
`hulicaijia` launched at 20:23 UTC on frozen `a5e0efc7f`,
Synthetic read wet at 0.04 percent of its week and dried two minutes later,
and the archive block review sized its quorum at 6 of an 11-seat bench,
heard 5,
re-asked the three refused seats over four rounds and threw `provider-unavailable` at 382 seconds:
INCOMPLETE with four seats able to answer.
Fixed in `40aba2fdb` (`stage-reachable-quorum.ts`),
which sizes every gather's quorum on the reachable bench with a two-voice floor and never re-asks a
refused seat;
the addendum is in `doc/decision/translation-repair-short-bench-share.md`.

## Measuring the two Bedrock-only sizes, 2026-09-07, 21:19 UTC

The probes ran the run roster and nothing else,
so a seat that needs a number before it is taken could never be asked for one.
Landed on `translation-repair-class12` at `abdb06c1b` and `35e0b1fad`
(the branch stays unmerged until `hakureico` settles,
under the kill-and-relaunch rule):
`--candidates a,b` names seatable ids that judge beside the seated roster in `judge-fidelity-probe`
and write and judge beside it in `producer-calibrate`,
for that run only;
`--candidates-alone` runs the named ids without the seated roster,
so a probe beside a production pass spends only at the candidates' provider.
An id the roster does not know is refused with the ids it does;
alone over nobody is refused.
Six guards bite (`probe-candidates.unit.test.ts`);
types and oxlint clean;
the full suite green.

### The instrument as it stands

`judge-fidelity-probe` over a throwaway runs dir holding the three settled artifacts on disk
(Huasheng from the fourth pass,
TLL1122,
yulianNyanner from the seventh),
`--cap 36`,
build `35e0b1fad`.
TLL1122 carries no slice of 400 characters;
neither remaining slice states a number the alteration fixture can move;
so the walk built one deletion and one insertion pair on each of two slices,
Huasheng/1 and yulianNyanner/3,
each put four ways:
16 rows.
Two of the four ways share one slate
(the same two texts in the same order,
differing only in which is called the incumbent),
and the select memo answers the second without a call:
7 of 16 rounds closed at 0 ms,
and every judge was asked 8 distinct questions.
The direction column of this probe measures nothing on a warm memo;
recorded,
not fixed here.

### The candidates alone, 21:19 UTC

Judges `google.gemma-4-e2b` and `google.gemma-4-31b`,
nobody else,
16 Bedrock calls,
0.0045 USD by the ledger.
Distinct questions answered with the complete text:

- `google.gemma-4-e2b`:
  7 of 8.
  Deletion 3 of 4,
  insertion 4 of 4,
  never declined;
  the miss chose the damaged text where it sat second on the Huasheng deletion,
  and it chose position two on 5 of 8.
- `google.gemma-4-31b`:
  4 of 8.
  Deletion 2 of 4,
  insertion 2 of 4,
  declined the other 4,
  every one on Huasheng/1,
  saying both candidates add imagery and emotional language the original lacks;
  it never chose the damaged text.

### The seated roster on the same questions, 21:20 UTC

The nine roster models,
72 calls,
`fidelity: 16 of 16 trials chose the complete text`;
per judge,
distinct questions answered with the complete text:

- 8 of 8:
  `hf:moonshotai/Kimi-K3`,
  `deepseek-v4-pro-0813`,
  `hf:zai-org/GLM-5.3-Flash` (no judge seat since 2026-09-02).
- 7 of 8:
  `deepseek-v4-flash-0731` (one damaged pick),
  `glm-5.3` (one decline),
  `hf:Qwen/Qwen3.8-27B` (one decline;
  no judge seat since 2026-09-03).
- 5 of 8:
  `hf:openai/gpt-oss-120b` (three declines),
  `minimax-m3` (one damaged pick,
  two declines).
- 4 of 8:
  `gemma-4-26b-a4b-it` (four declines,
  all on Huasheng/1,
  the family's reading).

Among the seven judges the wide seats hold,
the median is 7 of 8 and the floor 4 of 8.

### The rule, written before the next questions arrive

Two slices are eight questions,
which separates a family's habit of declining from a habit of choosing the damaged text
and not much finer.
The fourth settled artifact,
`hakureico`,
adds one slice when the pass settles,
and the probe is re-run over all four before any seat moves.
The rule for the wide seats,
pre-registered here as the 2026-09-01 rules were:
a candidate joins critic,
panel and judge when,
over the same distinct questions,
it chooses the complete text at least as often as the median seated judge
and chooses the damaged text no more often than the seated judge who chooses it most;
a candidate that declines its way below the floor stays out.
On the eight so far `google.gemma-4-e2b` meets both clauses
(7 against a median of 7;
one damaged pick against `deepseek-v4-flash-0731`'s one and `minimax-m3`'s one)
and `google.gemma-4-31b` meets neither
(4 against 7,
on declines).
The translator seat is `producer-calibrate`'s to give,
by the pooled null as on 2026-09-01,
run with `--candidates` over the whole roster once the pass is done with the meters.
Editor and refiner seats stay where the 2026-09-01 calibration put them;
no candidate is measured for them here.

### The candidates alone over four artifacts, 22:21 UTC

With the third hakureico artifact beside the three,
`--cap 48 --candidates google.gemma-4-e2b,google.gemma-4-31b --candidates-alone` on `752bf9a9b`:
four entries walked,
TLL1122 still too short,
three slices,
24 rows,
12 distinct questions per judge,
24 Bedrock calls.

- `google.gemma-4-e2b`:
  11 of 12.
  Deletion 5 of 6 with one damaged pick,
  insertion 6 of 6,
  never declined;
  position two on 7 of 12.
- `google.gemma-4-31b`:
  6 of 12.
  Deletion 2 of 6,
  insertion 4 of 6,
  declined the other 6,
  never chose the damaged text;
  position two on 3 of 12.

The seated roster's reading over the same twelve is bought after the fourth hakureico pass settles,
since its 108 calls would land on the Hyper quota the pass is spending;
the rule is applied then.

### The seated roster on the same twelve, 23:17 UTC, and the rule applied

The nine roster models over the same three slices,
108 calls (84 Hyper,
24 Bedrock,
no daily-limit refusal),
`fidelity: 24 of 24 trials chose the complete text`;
per judge,
distinct questions answered with the complete text:

- 12 of 12:
  `glm-5.3` (no judge seat since 2026-09-01),
  `hf:Qwen/Qwen3.8-27B` (none since 2026-09-03),
  `hf:moonshotai/Kimi-K3`,
  `hf:zai-org/GLM-5.3-Flash` (none since 2026-09-02).
- 11 of 12:
  `deepseek-v4-pro-0813` (one damaged pick),
  `minimax-m3` (one damaged pick).
- 8 of 12:
  `deepseek-v4-flash-0731` (one damaged pick,
  three declines).
- 7 of 12:
  `hf:openai/gpt-oss-120b` (five declines).
- 4 of 12:
  `gemma-4-26b-a4b-it` (eight declines).

The six judges the wide seats hold read 12,
11,
11,
8,
7 and 4:
median 9.5,
worst damaged count 1.
By the rule written before these numbers:

- `google.gemma-4-e2b`,
  11 of 12 with one damaged pick,
  meets both clauses and JOINS critic,
  panel and judge in both lanes,
  the late bench and the slate.
  It holds no writing seat,
  since no producer calibration has measured it:
  `RUN_WRITERS` names the consolidation writers and the translate lane leaves it out
  (`b0b48d6f4`,
  four guards bite).
  Bedrock serves it alone,
  so it is the third judge that answers while Hyper is held out.
- `google.gemma-4-31b`,
  6 of 12 on declines,
  meets neither and stays out.

Recorded as the addendum of 2026-09-07 in `doc/decision/translation-repair-roster-seating-2026-09-01.md`.

## Build plan, transport-independent layers first

In commit order,
each unit tested and committed before the next:

1. `provider-name.ts`:
`ProviderName` gains `openrouter`;
`PROVIDER_ORDER` states the routing preference (Synthetic,
    Hyper,
    OpenRouter);
    helpers over the record shape.
2. `openrouter-catalog.ts` and `roster-reach.ts`:
slugs,
`sharedWith` for all nine,
vision flags and output ceilings from the listing;
    `ModelReach` becomes a record keyed by provider;
    Gemini 3.8 Flash joins the blocklist.
3. `budget-routing.ts`:
`routeProviderFor` walks `PROVIDER_ORDER` over a dryness record and a saturation record;
    the two-provider dry error is renamed `EveryProviderDryError` (misleading name,
    CRN) and the old name goes to the local forbidden-strings appendix;
    `openRouterIsDry` and its meter fields.
4. `provider-budget.ts` and `budget-hold-wait.ts`:
a third meter,
`METERS` gains `openrouter=` and `openrouterUsd=`,
    a refusal hold moves traffic only while some other provider reads wet,
    the all-dry wait generalizes.
5. `provider-router.ts`:
callers keyed by provider,
a bounded re-route (one attempt per provider),
the re-ask asks the next wet provider serving the model;
    the re-ask path splits into its own file at the line budget.
6. `required-providers.ts`,
`run-config.ts`,
`budget-sample.ts`:
the third key,
optional and loud;
the run client exposes the dryness record for the seat reader.
7. `run-seats.ts`:
benches derive from where each model would be served (first provider in order that serves it and reads wet):
    Hyper-slow rules apply when served by Hyper,
    Kimi-K3 is withheld from every seat when served by OpenRouter,
    and `gemma-4-26b-a4b-it` takes the third checker seat there so both checker assertions hold per phase.
    Whether Qwen3.8-27B's rule is "served by Hyper" or "not served by Synthetic" is decided by its OpenRouter median in
    the probe.
8. `spend-line.ts`,
`spend-read.ts`,
`spend-cost.ts`:
a `cost=` field in USD from the wire,
an OpenRouter bucket in USD kept apart from hypercredits;
    `meter-sample-read.ts` and `meter-report.ts` accept the third field and its absence in older logs.
9. `openrouter-client.ts` and its credits parser,
on the transport the probe picks.
10. Live verification,
then the decision doc,
README and runbook.
