# Audit ledger: NeuralWatt replies cut at the default effort and the picture energy estimate

Calls to NeuralWatt that ran at the provider's default reasoning effort and were cut at the length cap,
the owner's lift of 2026-10-21 that sets the effort for the pictures and then the text of the GLM seat,
and the energy estimate that counted a picture as base64 text.

Part of [Audit ledger](audit-ledger.md),
which lists every file of this record.

## B718: a reply the length limit cut before any answer ended that reader's turn on the picture

Red `5dee1b41f9`,
fixed in `8423f77dc2`.

Found on 2026-10-21 (UTC) in the read of the corpus pass for `XingZ6016`,
and fixed in `w258`.

What the run showed:
the pass stopped incomplete because the entry's one picture had a single reading.
`glm-5.3-flash` on NeuralWatt answered `text:""` with `finishReason:"length"`,
having spent its whole completion cap (18316 tokens) reasoning at NeuralWatt's default effort `max`,
for 8188 prompt tokens.
The reader stage recorded `empty-reply` and went on,
and the second reader alone could not corroborate.

The rule the code broke:
`readPastRefusal` re-asked a refusal up to `REFUSAL_ASK_LIMIT` times and treated every empty reply as final.
An empty reply that ended on `stop` is a fact about the picture or the model.
An empty reply that ended on `length` is a fact about one call's budget,
and says nothing about whether the model can read the picture.

The fix:
`readImageAsset` marks an `empty-reply` whose finish reason was `length` with `cutByLength` and the provider that served it (`servedBy`).
`readPastRefusal` then asks once more.
It sends the ask with `otherThan` set to the provider that cut the reply,
so the router serves another wet provider that carries the same model.
Where the router has none (`NoProviderForModelError`) the ask goes again to the same provider.
Every other failure keeps its own handling.
The line names the picture,
the finish reason,
the provider and the route the second ask takes.
The second ask carries the next entry of `IMAGE_READING_PERSPECTIVES`.
The payload store keys a reply on the model and the message bytes,
so an ask with identical bytes would have replayed the stored empty reply.
A second empty reply stays `empty-reply`,
and an empty reply that ended on `stop` is asked once as before.

Cache versions:
the re-ask changes only the transient `unavailable` verdicts,
which are never resumed (`isResumableReading`),
and readings it produces enter the cache under the same key as any reading.
No key moves.
The audit (`cache-account-audit`) lists the commits among the source commits no account names,
which is the standing state of the package.

Not checked:
whether a second ask recovers on `glm-5.3-flash`.
No provider was called in writing this fix.

Open to the owner's veto:
one re-ask,
not more,
and the next perspective as the changed text.

Recurrence:
`design-commitments.md`,
"A reply the length limit cut is re-asked as cut,
not as off the shape" (ledger P10):
the picture readers now follow the same rule the stages' recovery round already holds.

## B719: a NeuralWatt picture call ran at the provider's default reasoning effort

Red `ae7ba82828`,
fixed in `127a8f6eb2`.
It revises P11 for NeuralWatt only.

Found on 2026-10-21 (UTC) in the same read as B718,
and fixed in `w258`.

What the run showed:
`glm-5.3-flash` is a reasoning-only model on NeuralWatt,
and the body carried no effort,
so the provider applied its default `max`.
That is the cause of the 18316-token reasoning run in B718.

What the documents say
(fetched 2026-10-21 from `docs.neuralwatt.com/api/chat-completions.md`,
`api/models.md` and `GET /v1/models`):
the model's reasoning is mandatory,
`supported_efforts` are `max`,
`high` and `low`,
`default_effort` is `max`,
and `reasoning_effort` is a documented string parameter.
`thinking_token_budget` is documented too,
but its support table (2026-08-26) does not name this model,
so it is not used.
NeuralWatt documents no image token accounting.

The owner's ruling of 2026-10-21 lifts the ban on passing parameters for NeuralWatt only
(two sentences of one message,
the dash between them left out here):
"NeuralWatt is a special case of all the providers:
It implements what it documents correctly,
almost always"
and
"I'm lifting the ban on passing params,
but only for NeuralWatt."
The standing rule of 2026-08-25 holds for every other provider and for NeuralWatt text calls.

The fix:
the type that makes a card a NeuralWatt card carries `pictureReasoningEffort` (`low`,
`high` or `max`),
and the GLM seat's NeuralWatt side names `low`.
The NeuralWatt client sends `reasoning_effort` only on a call that carries a picture,
read off the NeuralWatt card side.
No other provider's card type has the field,
so no other client can send it.
`neuralwatt-picture-effort.unit.test.ts` pins the value on the picture call,
none on a text call to the same seat,
none on a picture call to a seat whose card names none,
and that the only card sides naming an effort are NeuralWatt's.
`owner-body-rules.unit.test.ts` now sends a picture through the Synthetic,
Hyper,
OpenRouter and Bedrock clients and expects no forbidden key in any body.

Cache versions:
a reading made at `low` differs from a reading made at `max`,
but a stored reading is not asked again,
and the key names the bytes,
roster,
instruction,
perspectives and threshold,
none of which moves.
New readings are produced under the new effort.
No key moves.

Not measured:
neither `low` nor `max` has a measured picture-reading quality on this seat.
The first keyed run at `low` is the measurement.

Open to the owner's veto:
`low`,
not `high`.

Widened on 2026-10-21 (UTC) by B807:
the lift covers the NeuralWatt text calls of the same seat too,
and the standing rule of 2026-08-25 now holds for every other provider only,
where this entry's ruling paragraph said "and for NeuralWatt text calls".

## B720: the NeuralWatt energy estimate counted a picture as base64 text

Red `7dfd70e7d5`,
fixed in `5d6c111206`.

Found on 2026-10-21 (UTC) in the same read as B718,
and fixed in `w258`.

What the run showed:
a 1271156-byte picture (2400 by 2616) made a 1.7 million byte body,
which the estimate read as 423985 prompt tokens and held at the top bucket,
0.9089 Wh for `glm-5.3-flash`.
The provider reported 8188 prompt tokens,
and the call measured 0.2311 Wh.
Two 576 by 1280 pictures read for 1156 reported prompt tokens each against 26957 and 32466 estimated.

The fix:
`promptTokensOfRequest` takes each inline picture out of the text bytes and counts it by its patches,
round(width / 28) times round(height / 28),
read off the file header
(`imagePixelSizeOf`:
WebP lossy,
lossless and extended,
PNG and JPEG).
2400 by 2616 is 86 by 93,
7998 tokens,
and 7998 plus 190 tokens of text and framing is the reported 8188.
576 by 1280 is 21 by 46,
966,
and 966 plus 190 is the reported 1156.
A picture whose size cannot be read,
or that is not inline,
is held at 8192 tokens,
a little above the largest count reported.
The bucket,
the margin (`NEURALWATT_ENERGY_MARGIN`,
one) and the settlement that replaces the estimate with the measured energy are untouched.

Limits:
the 28 pixel grid and the 190 are a fit to two pictures,
the second the check of the first,
and a guess for other sizes and for the DeepSeek seat,
which has never read a picture here.
NeuralWatt documents no image accounting.
The estimate only sizes the hold a call has in flight.

Cache versions:
the estimate feeds the in-flight hold and the ledger line only.
No cached stage result reads it.
No key moves.

Not done:
`openrouter-abandoned-spend.ts` estimates an OpenRouter body by the same bytes over four,
and a picture there has the same overcount.
The owner's ruling named NeuralWatt.

## B807: a NeuralWatt text call ran at the provider's default reasoning effort

Status:
fixed on 2026-10-21 (UTC),
red `b5fd3e9a3bd0ff7794ede7b1475b33167b69e891`,
fix `109f1b7a7eb927191776a92de8d3df151483ce1c`,
cache versions none.
Found in the read of the corpus pass for `zheermao22` (class K1) and fixed in `w263`.
It widens B719,
which built the owner's lift for pictures only.

What the run showed:
four `glm-5.3-flash` calls on NeuralWatt ran to the 18316-token cap with 0 content characters
(`zheermao22` log lines 514,
533,
1983 and 2209,
at 21:17:32 UTC,
21:20:36 UTC,
21:37:15 and 21:40:06 UTC),
12.0174 Wh,
29 percent of the run's NeuralWatt energy.
The Hyper re-ask of each ran to its own cap three times of four,
and two recovery rounds waited the full writer grace (180 s and 175 s) and heard nothing.
The same call on the letter block capped in `zheermao20` and `zheermao21`,
so it is the third run in a row.

What the code did:
`neuralwatt-client.ts` took the card's `pictureReasoningEffort` only when the request carried a picture,
and sent `reasoning_effort` only then.
B719 had read the owner's two sentences of 2026-10-21
("NeuralWatt is a special case of all the providers:
It implements what it documents correctly,
almost always"
and
"I'm lifting the ban on passing params,
but only for NeuralWatt")
as covering the call kind that had failed that day.
The words name the provider,
not the kind of call.

What was measured,
keyless,
from the `SPEND provider=neuralwatt` lines of every pass log in the agent directory except `XingZ6017`,
which was still being written when this was counted
(`~/temp/agent/tr-fan/w263-scratch/nw-spend2.ts`,
outside the repository;
a picture read is left out by its `read photo` line right after the spend line;
the cap of each model is `model-cards.ts`):

- `glm-5.3-flash`,
  288 text calls at the default effort `max`.
  Cap 18316.
  Capped:
  11 (3.8 percent),
  7 of them on prompts of 11509 to 13908 tokens (the size of the letter block's review,
  which the reads of `zheermao20` to `zheermao22` name) and 4 on prompts of 7064 to 9451 tokens,
  and none a picture (the capped call of `XingZ6016` is the picture of B718,
  8188 prompt tokens,
  not counted).
  Uncapped,
  277 calls:
  p50 2125,
  p75 3950,
  p90 7573,
  p95 10778,
  p99 15731,
  largest 18262.
  Of the uncapped,
  9 passed 12000,
  5 passed 14000 and 2 passed 16000.
  Of the 31 calls past 9158 (half the cap),
  11 capped.
- `deepseek-v4.1-flash`,
  819 text calls at its default effort `high`.
  Cap 13082.
  Capped:
  12 (1.5 percent).
  Uncapped,
  807 calls:
  p50 802,
  p90 2840,
  p99 9121,
  largest 11591.

The choice:
`low` on the GLM seat's text calls.
The brief's test is whether the uncapped calls sit well under the cap or crowd it.
The bulk sits well under (p90 at 41 percent),
but the tail does not:
p99 is at 86 percent of the cap,
the largest uncapped call is 54 tokens short of it,
and a call that reaches half the cap capped in 11 of 31 cases.
`high` is the other candidate.
DeepSeek runs at `high` by default and capped on 1.5 percent of its calls,
so `high` is not shown to cure the runaway.
No measurement exists at `high` or at `low` for text on this seat;
the first keyed run at `low` is the measurement,
and a shallower effort may cost editing quality that the cap-outs never showed.

DeepSeek V4.1 Flash:
no effort is sent.
The repo records its default (`high`,
`neuralwatt-catalog.ts`) and that reasoning is on by default
(`doc/decision/translation-repair-neuralwatt-provider.md`),
and records no `supported_efforts` list for it.
B719 lists the supported efforts for GLM-5.3-Flash alone.
Nothing the repo holds documents a value to send.

The fix:
`NeuralWattCard` carries `textReasoningEffort` beside `pictureReasoningEffort`,
the catalog row copies it,
and the client sends the picture effort for a request that carries a picture and the text effort otherwise.
Only the GLM seat's NeuralWatt side names one.
No other provider's card type has the field.
`neuralwatt-text-effort.unit.test.ts` pins `low` on a plain and on a schema call to the GLM seat,
none on the DeepSeek seat,
and that the only card sides naming a text effort are NeuralWatt's GLM side,
at a level the listing documents.
`neuralwatt-client.unit.test.ts` pins the body of both seats,
and `owner-body-rules.unit.test.ts` still expects no forbidden key in the body of any other provider.
The red cases failed with `expected undefined to equal 'low'` and an empty list of naming card sides.

The retry at `low` before the next-seat re-ask was checked and not built:
B718 re-asks a picture reading once with the next perspective,
which changes the message bytes.
A text call has no such text to change.
The payload store keys a reply on the model and the message bytes alone
(`prompt-uniqueness-client.ts`),
so a second ask of the same bytes returns the stored empty reply,
and the nudged re-ask goes to another provider on purpose
(`nudged-reask.ts`:
"the same bytes asked again would be the same sample").
With `low` sent from the first ask,
a retry at `low` would repeat the first ask.

Cache versions:
none moves.
No slice-cache key hashes a request parameter:
the keys hash the version,
the shape of the run and the texts,
and the reasoning for the call deadline (`perCallTimeoutMs`,
"changes how long a voice has to answer,
not what it is asked") holds for an effort.
The payload store sits under the run's own runs directory (`runs-layout.ts`,
`PROMPT_PAYLOADS_DIR`),
so a new run starts with none,
and a resume of a run begun before the change reads replies already paid for at the old effort,
which is wanted.
This is the reading B719 took for the picture effort ("No key moves").

Limits:
the energy matrix the meter estimates from was drawn at the default efforts,
so a call at `low` holds more than it uses;
the settlement replaces the hold with the measured energy.
The hold is larger than needed,
never smaller.

Open to the owner's veto:
`low`,
not `high`,
for text.
Changing it is the value in `neuralwatt-card-sides.ts`.

Recurrence:
`mistake-prevention-inputs-defaults-and-values-read-from-text.md`,
"Provider fields read by their documentation":
an owner's lift is built at the scope its words name.
