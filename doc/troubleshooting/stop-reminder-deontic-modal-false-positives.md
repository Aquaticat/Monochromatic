# Stop reminder flags obligation modals as uncertainty

Observed 2026-08-13 over one long session,
 six firings,
 all false positives of
 the same shape.

## Symptom

`ccsr` refuses a stop with "Your response contains uncertain language" for
 sentences that express OBLIGATION or ABILITY rather than doubt:

```text
  "I should be straight about this cycle"          obligation
  "this conclusion should be re-taken"             recommendation
  "affects how every precision figure should be read"   recommendation
  "everything that could be done without you"      ability, scope
```

Each was written as a confident statement.
 None hedges a factual claim,
 which
 is what the check exists to catch.

## Cause

`uncertainty-phrases.ts` lists bare modal-plus-be forms among the trigger
 phrases:

```text
  'may be', 'might be', 'could be', 'should be'
```

Those forms carry at least three senses,
 and only one is epistemic:

-   EPISTEMIC,
     which the check wants:
     "the share should be about 3%".
-   DEONTIC,
     obligation or recommendation:
     "this should be re-taken".
-   ABILITY or scope:
     "everything that could be done".

The engine matches the phrase and has no notion of sense,
 so the two
 non-epistemic uses fire every time.

## Evidence that this is unhandled rather than intended

-   `uncertainty.unit.test.ts` contains no case with `should be` at all,
     in
    either sense,
     so neither behaviour is pinned.
-   Nothing in the handler mentions participles,
     obligation,
     or modal sense.
-   The package already has the concept of DISMISSING a matched phrase on
    context:
     `uncertainty-citations.ts` scopes a dismissal check to its own
    citation context.
     So a sense check has a natural home in the existing
    design rather than needing new machinery.

## A cheap discriminator, if one is wanted

Deontic and ability uses of these modals are overwhelmingly followed by a past
 participle,
 because they are passive:
 "should be read",
 "should be re-taken",
 "could be done",
 "may be dropped".
 Epistemic uses are followed by a quantity,
 an article,
 or an adjective:
 "should be about 3%",
 "could be a bug",
 "might be
 smaller".

Dismissing a match whose next word ends in `-ed` or `-en` would have cleared
 all six observations here,
 and would leave the epistemic cases the check is
 for.
 Whether that trade is worth making is a judgement about how noisy the
 hook should be,
 which is why this is recorded rather than changed.

## Not changed

The package belongs to the user's workflow and its sensitivity is a values
 choice:
 a hook that occasionally over-fires still does its job,
 which is to
 make the author re-read a sentence.
 Six false positives in a session of this
 length is a real cost but not obviously the wrong setting,
 and loosening it
 without being asked would be deciding that for them.
