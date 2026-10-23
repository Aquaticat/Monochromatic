# Synthetic `/v2/quotas` renamed its weekly block to `planWeeklyLimit` and the meter read unreadable for hours

## Symptom

A corpus pass started on 2026-10-22 (`XingZ6020`) parsed Synthetic's quota body at its first read, 19:32:44 UTC
(421 characters).
From 22:21:58 UTC on, every read of that pass was refused with this warning,
copied from line 12621 of `/var/mnt/encrypted/temp/agent/corpus-pass-XingZ6020.log`
and wrapped here at spaces to fit the width (the log line is one line):

```text
[warn] [2026-10-22T22:21:58.964Z] [translation-repair] [XingZ60] [repair slice 73] [meterRecordOf]
synthetic: budget unreadable, treating as spendable
(Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object;
received subscription:object, search:object, planWeeklyLimit:object)
```

At 2026-10-23T04:12:28Z, `rg --count` of that message over the log counted 291 lines, and the pass was still running,
so the count grows.
The `METERS` line then printed `synthetic=unreadable`,
the seat reader printed `synthetic=unreadable-treated-as-spendable`,
and the router sent Synthetic calls as if it had budget.
The provider's weekly credit was in fact spent: the reading in the Root cause section says 0 percent remaining.

## Root cause

Synthetic renamed the weekly block of the `GET https://api.synthetic.new/v2/quotas` body.
The endpoint carries no version, so the evidence is dated readings.
A keyed read at 2026-10-23 03:28:16 UTC answered HTTP 200 with 269 characters.
Its top-level keys and their JSON types were:

- `subscription`: object with `limit` (number), `requests` (number), `renewsAt` (string)
- `search`: object with `hourly` (object)
- `planWeeklyLimit`: object with `nextRegenAt` (string), `percentRemaining` (number), `nextRegenPercent` (number)

The values of `planWeeklyLimit` were
`{"nextRegenAt":"2026-10-23T05:03:47.000Z","percentRemaining":0,"nextRegenPercent":2}`.
The body held no `weeklyTokenLimit` and no `freeToolCalls`.
The reading of 2026-10-19 at 14:35 UTC had `weeklyTokenLimit` and `freeToolCalls`
(`doc/troubleshooting/translation-repair-provider-concurrency.md`, section on the removed limits),
and the pass parsed a body at 19:32:44 UTC on 2026-10-22 that the old reader accepted,
so the rename happened between 19:32:44 UTC and 22:21:58 UTC on 2026-10-22.
Whether it came with the weekly credit reaching 0 percent or with a deploy is not known.

The reader looked the weekly block up under one key only.
At `0fa4950b88`, `package/translation-repair/provider-stream/src/synthetic-quota.ts`, in `parseQuotaSnapshot`:

```ts
// synthetic-quota.ts:549 and :558 at 0fa4950b88
    weeklyTokenLimit: weekly,
  } = parsed;
  ...
  if (!isJsonRecord(weekly,))
    throw shapeRefusal({
      detail: 'weeklyTokenLimit is not an object',
```

`QuotaShapeError` is a provider protocol failure, so the meter layer turns it into `unreadable`
and logs the warning of the Symptom section
(`package/translation-repair/provider/src/provider-meters.ts:201`):

```ts
      `${name}: budget unreadable, treating as spendable (${
```

An unreadable meter routes as spendable, because only `dry` holds a provider out
(`provider-meters.ts:82-85`):

```ts
export function routesAsDry(
  { state, }: { readonly state: MeterState; },
): boolean {
  return state === 'dry';
}
```

So the refusal hid a provider that was dry.
`syntheticIsDry` (`package/translation-repair/provider/src/budget-routing.ts:369-378`) is true at zero,
and `provider-meters.ts:315` feeds it the snapshot, so a body that had been read would have been `dry`:

```ts
  const { percentRemaining, } = quota.weekly;

  if (percentRemaining <= 0)
    return true;
```

## Verification

Version under test: the endpoint has no version, so the subject is the parser,
at three commits of this repository: `0fa4950b88` (before), `a4a53c010d` (first fix),
and `FIX2SHA` (second fix, which adds instant validation, null-as-absent and drops `nextRegenPercent`).
The reading used is the one of 2026-10-23 03:28:16 UTC described in the Root cause section,
with invented numbers in the blocks other than `planWeeklyLimit`.

Reproduce the failure keyless, with no provider call, by running the red test file of `2376d5eb37` against the parser of
`0fa4950b88` in a scratch directory `$D` (the test file imports the built output, so its import is pointed at the copy):

```sh
# run from a checkout of this repository
git show 0fa4950b88:package/translation-repair/provider-stream/src/synthetic-quota.ts \
  > "$D/synthetic-quota.ts"
git show 2376d5eb37:package/translation-repair/provider-stream/src/synthetic-quota.unit.test.ts \
  | sed "s#'../dist/final/node/index.mjs'#'./synthetic-quota.ts'#" \
  > "$D/synthetic-quota.unit.test.ts"
ln --symbolic "$PWD/package/translation-repair/provider-stream/node_modules" "$D/node_modules"
env --ignore-environment PATH="$PATH" HOME="$HOME" node "$D/synthetic-quota.unit.test.ts"
```

Output at `0fa4950b88`: exit 1, `[FAIL]` 9 (eight cases and the suite line).
The first failing case parses the measured body and fails with the message the pass logged:

```text
QuotaShapeError: Synthetic /quotas body violated expectations: weeklyTokenLimit is not an object;
received subscription:object, search:object, planWeeklyLimit:object
```

At `FIX2SHA` the cases pass under `mise run //package/translation-repair/provider-stream:test:unit`
and `mise run //package/translation-repair/provider:test:unit`.

Bodies that read cleanly:

- the 2026-07-16 shape with both blocks,
- the 2026-10-19 shape with `weeklyTokenLimit` and no five-hour block,
- the 2026-10-23 shape with `planWeeklyLimit`, which a real client reads as `dry` at 0 percent
  (with `syntheticWeeklyReturn=2026-10-23T05:03:47.000Z`) and as `wet` with budget left (no return field),
- a deprecated key kept as `null` beside a valid block under the other name, in either direction,
- a block carrying `nextRegenPercent` of any type, which is ignored.

Bodies that are refused, each naming the field and the block's own keys and never a value:

- no weekly key under either name, or only `null` ones,
- a weekly key that holds neither `null` nor an object,
- a weekly field of the wrong type,
- a `nextRegenAt` that is not an instant spelled the way `Date.prototype.toISOString` writes one
  (`isIsoStampText`, `package/translation-repair/markup/src/iso-stamp-text.ts`): a value with a space and a newline,
  an empty one, a date-time with no zone, and one with no milliseconds,
- both names present with blocks that read differently.

## Verified workarounds

The reader takes both names (`weeklyWindowFromBody`, `synthetic-quota.ts:597`):

```ts
  const readings = WEEKLY_BLOCK_NAMES.flatMap(function readCarried(blockName,): readonly WeeklyReading[] {
```

It validates `nextRegenAt` as an instant in `weeklyWindowOf` (`synthetic-quota.ts:538`):

```ts
  if (!isIsoStampText({ text: nextRegenAt, },))
```

The meter prints the return of a spent weekly budget as `syntheticWeeklyReturn=<nextRegenAt>` in its `METERS` fields
(`syntheticMeterLevel`, `budget-routing.ts:752-760`), and `unreadable` where the value is not an instant.

The lead's rulings of 2026-10-23, open to the owner's veto:

- `nextRegenAt` is validated at parse because the meter prints it into a log line,
  where a space or a newline would forge a field or a line.
- `nextRegenPercent` is not modeled, because nothing reads it and the parser models only the fields a decision reads.
- A `null` weekly key counts as absent, so a deprecated key kept as `null` does not blind the meter.

Tradeoffs:

- A `nextRegenAt` that is a valid time in another spelling (no milliseconds, an offset) is refused,
  and a refused body reads `unreadable`, which routes as spendable.
  That is the failure this document is about, kept for a field whose only use is a log line;
  the refusal names the field, so the next reading shows it.
- Two blocks that differ are refused. No body is known to carry both.
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

Filing upstream is out of scope: the owner ruled that upstream filing for this provider is not done.
That ruling is not recorded in a file of this repository.
The `.out-of-scope/` directory was checked and no entry names Synthetic,
so the exemption rests on the owner's ruling alone.
The six constraints and the duplicate search were therefore not walked, and no draft issue is kept.
Synthetic's `/v2/quotas` shape is not documented in a contract that promises key names,
and the repository records it from live readings only.
The next live reading that changes a key name again is refused with the body's keys and types,
which is what this reader keeps for the next investigator.
