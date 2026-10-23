# Synthetic `/v2/quotas` renamed its weekly block to `planWeeklyLimit` and the meter read unreadable for hours

## Symptom

A corpus pass of 2026-10-22 (`XingZ6020`) read Synthetic's quota at its start and was then refused on every later read.
The first quota read, at 19:32:44 UTC, parsed (421 characters).
From 22:21:58 UTC on, each read logged this warning, 278 times by the time the log was read:

```text
[warn] [translation-repair] [meterRecordOf] synthetic: budget unreadable, treating as spendable
(Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object;
received subscription:object, search:object, planWeeklyLimit:object)
```

The `METERS` line then printed `synthetic=unreadable`, the seat reader printed
`synthetic=unreadable-treated-as-spendable`,
and the router sent Synthetic calls as if it had budget.
The provider's weekly credit was in fact spent: the measured reading below says 0 percent remaining.

## Root cause

Synthetic renamed the weekly block of the `GET https://api.synthetic.new/v2/quotas` body.
A keyed read at 2026-10-23 03:28:16 UTC answered HTTP 200 with 269 characters.
Its top-level keys and their JSON types were:

- `subscription`: object with `limit` (number), `requests` (number), `renewsAt` (string)
- `search`: object with `hourly` (object)
- `planWeeklyLimit`: object with `nextRegenAt` (string), `percentRemaining` (number), `nextRegenPercent` (number)

The values of `planWeeklyLimit` were
`{"nextRegenAt":"2026-10-23T05:03:47.000Z","percentRemaining":0,"nextRegenPercent":2}`.
The body held no `weeklyTokenLimit` and no `freeToolCalls`.
The reading of 2026-10-19 (14:35 UTC) had `weeklyTokenLimit` and `freeToolCalls`
(`doc/troubleshooting/translation-repair-provider-concurrency.md`, section on the removed limits),
so the rename happened between 2026-10-22 19:32 UTC and 22:21 UTC.
Whether it came with the weekly credit reaching 0 percent or with a deploy is not known.

The reader looked the weekly block up under one key only.
At `0fa4950b88`, `package/translation-repair/provider-stream/src/synthetic-quota.ts`, in `parseQuotaSnapshot`:

```ts
// package/translation-repair/provider-stream/src/synthetic-quota.ts:549 and :558
    weeklyTokenLimit: weekly,
  } = parsed;
  ...
  if (!isJsonRecord(weekly,))
    throw shapeRefusal({
      detail: 'weeklyTokenLimit is not an object',
```

`QuotaShapeError` is a provider protocol failure, so the meter layer turns it into `unreadable`
(`package/translation-repair/provider/src/provider-meters.ts`, `meterRecordOf`,
the warning `budget unreadable, treating as spendable`).
An unreadable meter routes as spendable (`routesAsDry` is true only for `dry`),
so the refusal also hid a provider that was dry:
`syntheticIsDry` (`package/translation-repair/provider/src/budget-routing.ts`) returns true at `percentRemaining <= 0`
and would have read this body dry, had the body been read.

## Verification

The fix reads the weekly block under either key.
Version under test: the commit that carries this document, on top of `0fa4950b88`.
The cases run through `mise run //package/translation-repair/provider-stream:test:unit`
and `mise run //package/translation-repair/provider:test:unit`:

- The measured body parses to `percentRemaining` 0, `nextRegenAt` `2026-10-23T05:03:47.000Z` and `nextRegenPercent` 2,
  with no five-hour window.
- A real Synthetic client over a recorded transport that replays the measured body reads dry through `readEveryMeter`,
  and through `createProviderBudgets` the routed view says Synthetic is dry and the meter state is `dry`.
- A body that carries both names is read when the two blocks read the same, and refused when they differ.
- A body that carries neither name is refused with `neither weeklyTokenLimit nor planWeeklyLimit is an object`
  and the keys it held.

Bodies that read cleanly:

- the 2026-07-16 shape with both blocks,
- the 2026-10-19 shape with `weeklyTokenLimit` and no five-hour block,
- the 2026-10-23 shape with `planWeeklyLimit`.

Bodies that are refused, each naming the field and the block's own keys and never a value:

- no weekly key under either name,
- a weekly key that is no object,
- a weekly field of the wrong type, including `nextRegenPercent` when it is present,
- both names present with blocks that read differently.

## Verified workarounds

The reader takes both names (`weeklyWindowFromBody` in `synthetic-quota.ts`)
and keeps `nextRegenPercent` when the block carries it.
The meter prints the return of a spent weekly budget as `syntheticWeeklyReturn=<nextRegenAt>` in its `METERS` fields
(`syntheticMeterLevel`), so a dry record states when it can end.
A reading with weekly budget left prints no such field.

Tradeoffs:

- Two blocks that differ are refused, which loses the reading while both names are in one body.
  No body is known to carry both; a refusal names both blocks' keys so the next live reading shows what they hold.
- The stated return is a field of the `METERS` line only.
  The router and the seat reader still decide on the dry bit and on refusal holds;
  a dry meter does not create a hold, so the seat reader says `no provider has named its return` for Synthetic.
  Deriving a hold from a meter's `nextRegenAt` would make a phase wait up to a regeneration period (202 minutes)
  and would change when a run ends on every provider dry, which the owner has not decided.

## What does not work

- Reading only `planWeeklyLimit` would break on the older shape, which an account may still receive.
- Treating a missing weekly block as dry would turn a renamed key into an outage, the opposite error.
- Waiting for the rename to be undone is not a plan: the body of 2026-10-23 still had the new name.

## Upstream filing decision

Filing upstream is out of scope by the owner's rule for this provider, so no issue or comment is drafted.
Synthetic's `/v2/quotas` shape is not documented in a contract that promises key names,
and the repository records it from live readings only.
The next live reading that changes a key name again is refused with the body's keys and types,
which is what this reader keeps for the next investigator.
