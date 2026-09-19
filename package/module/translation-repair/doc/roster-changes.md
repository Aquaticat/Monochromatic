# Current roster changes

Part of [the package README](../README.md).

Adding,
removing or changing a model is one card in `src/model-cards.ts` since 2026-09-16:
every provider catalog,
the completion-cap table,
the abandoned-spend ratios and every seat hold derive from the cards,
the served-id lists in `src/roster-id.ts` type them,
`mise run roster-card -- <provider> <served id>` prints a card fragment off the provider's live listing,
and the unit tests sit models by role-named seats from `src/roster-fixture.ts`.
The steps are
[the roster-change runbook](../../../../doc/runbook/translation-repair-roster-change.md)
and the reasons
[the model-card decision](../../../../doc/decision/translation-repair-model-cards.md).

DeepSeek V4 Pro 0813 and V4 Flash 0731 left the roster on 2026-09-16 at the owner's instruction
("DeepSeek V4.1 Flash is much better than both V4 Pro and V4 Flash");
both spellings on both providers are blocklisted,
and V4.1 Flash took the editor and refiner seats V4 Pro held,
unmeasured in those roles until the next editor calibration.
The roster is twelve models.

`deepseek-v4.1-flash` is routed off DeepInfra and Wafer since 2026-09-19
(`ignoredEndpoints` on its card):
on XingZ607 Morph answered its judge calls at 11 s median,
DeepInfra at 45 s with 89 of the 97 cut streams,
Wafer at 26 s with the rest,
and on DeepInfra the seat set the quorum time in 553 of 2,320 rounds
(the pass log's "deepseek-v4.1-flash routed off DeepInfra and Wafer" heading dated 2026-09-19).

`typesafe/jev-1.13` joined on 2026-09-18 as the first decision-only seat:
a model OpenRouter serves through its decisions endpoint
(typed `choice`,
`noul` and `score` answers over a state)
and not through chat.
Its card has a `decisions` side and no provider side,
it is off `RUN_ROSTER` and every chat bench,
and it sits on `RUN_SELECT_JUDGES` after every wide seat once measured.
The production judge fidelity probe on 2026-09-18 chose the reviewed reference on all 12 rows it was asked,
no damaged pick or decline,
level with DeepSeek V4.1 Flash and Mercury on the same rows,
so the judge hold came off in `c14c7f176`.
It votes only in the candidate-select stage,
the one stage with a typed question;
writer and reader holds stay because a typed decision writes and reads nothing.
The steps are the runbook's "Add a decision-only model" section.

DeepSeek V4.1 Flash was approved on Hyper and OpenRouter on 2026-09-11.
It has one distinct catalog identity,
`deepseek-v4.1-flash`,
served as that ID on Hyper and `deepseek/deepseek-v4.1-flash` on OpenRouter.
Both actual compiled clients passed the streamed structured-output probe.
V4 Flash 0731 was a separate version whose ratings,
writer exclusion and endpoint exclusions did not transfer,
and it is off the roster since 2026-09-16.

The new version retains the pooled completion cap of 13082.
Its reported image capability does not itself enable a reader seat.
The source-reviewed judge comparison on 2026-09-11 selected the reference on all fourteen distinct questions,
with no damaged pick or decline,
against a peer median of fourteen and maximum damaged count of one.
It now joins judge and general text/preparation seats once under its shared identity.
Writer and image-reader holds remain until their separate measurements.
Existing peer order,
writer/reader arrays and the reader-only Gemma 4 31B seat are unchanged.
The [admission record](../../../../doc/planning/translation-repair-deepseek-v41-flash-2026-09-11.md)
contains availability,
prices,
verification and remaining work.

Hyper-origin identity names and Synthetic-counterpart projections are now explicit:
`HYPER_ORIGIN_ROSTER_IDS`,
`HyperOriginRosterId`,
`NO_SYNTHETIC_COUNTERPART`,
`hyperModelsWithSyntheticCounterparts`
and `hyperModelsWithoutSyntheticCounterparts`.
These do not claim Hyper-exclusive serving;
`reachOf` owns actual provider reach.

`qwen3.8-max` was removed from roster and Charm Hyper allowlist on 2026-08-28 at owner's instruction.
Its metered cost was disproportionate and exceptionally expensive.
No replacement was selected,
so that cull left nine models.
Dated pricing remains only so historical run artifacts can still be accounted.

Synthetic `hf:zai-org/GLM-5.2` was replaced by `hf:zai-org/GLM-5.3-Flash` on 2026-08-29.
The live endpoint confirmed the successor;
the operational request reported Synthetic's plan to retire the older model.
Synthetic's live model endpoint reported the replacement as always-on beta,
with text and image input,
a 524288-token context,
a 65536-token output ceiling,
and the structured-output features this pipeline requires.
The old `glm-5.2` Charm Hyper route left the active allowlist because it is the superseded roster identity,
not a fallback for GLM-5.3-Flash.
Hyper's live catalog still listed `glm-5.2` but no GLM-5.3-Flash spelling on 2026-08-29.
That replacement left the roster at nine models.

Nemotron-3-Super left every active stage and the callable Synthetic catalog on 2026-08-29 at owner's instruction.
In adjacent required-correction reviews it first proposed concrete wording and then was sole reviewer rejecting that wording.
The roster now has eight models.
Broad-stage quorum consequently moves from five to four,
which equals entire Synthetic side;
a run with all four Hyper seats dark can reach exact-half quorum on four Synthetic seats.
Both-key startup refusal prevents missing credentials but not provider becoming unavailable later,
so any such run remains degraded evidence rather than readiness proof.
Kimi-K3 takes departed checker seat rather than shrinking below hard floor of three;
it participated in 231-round wide checker arm where added voices changed zero verdicts,
but fresh checker-seat calibration remains required before treating new narrow roster as independently optimal.
GPT-OSS takes departed default restoration-benchmark judge seat because it already checks and judges in production;
benchmark-specific calibration remains open.
Historical artifacts and measured narratives retain departed identity.

GLM-4.7-Flash remains blocked from every active stage,
roster type,
and callable catalog as it has been since 2026-08-24.
Interrupted schema-9 run started before Nemotron removal logged no GLM-4.7-Flash model label,
and no translation-repair process remained alive after run was stopped.
This establishes interrupted pass did not issue GLM-4.7-Flash calls;
it does not identify source or time window of calls visible outside package log.
A widened scan over same-day validation,
review,
replay,
and probe logs found zero GLM-4.7 call labels;
remaining mentions were provider catalog listings or historical stream-parser test names.

Same live catalog read showed `syn:large:text` now points to GLM-5.3-Flash,
while current Synthetic rate-limit documentation names Kimi-K3 as one-request baseline.
Planning denominator now follows Kimi-K3 input price and has GFP coverage;
live `/quotas` remains authoritative.
See `doc/troubleshooting/synthetic-rate-limit-default-drift.md`.
