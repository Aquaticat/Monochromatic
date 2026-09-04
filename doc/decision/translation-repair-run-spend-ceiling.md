# A run stops starting entries once it has spent its allowance on OpenRouter

Decided by the owner on 2026-09-04 ("Add a per-run USD ceiling"), asked with two options after the
OpenRouter fallback landed and the only spend guard was the credits meter.

## The rule

- Every call's `cost=` (the USD the OpenRouter wire reports, the same figure the `SPEND` line carries and
    `spend-report` sums) is added to a process-wide meter (`run-spend-meter.ts`) as the line is written.
- Before the scheduler starts each entry it asks whether the run's OpenRouter spend is at or past the
    ceiling (`corpus-run/spend-ceiling.ts`, through the queue's `stopBeforeNext`). Past it, the run prints
    `SPEND CEILING reached: <spent> of <ceiling> USD spent on openrouter this run; not starting new
    entries` and starts nothing more; entries already running finish.
- The built-in ceiling is 20 USD: the 2026-09-03 planning record priced a day of three to four entries on
    OpenRouter alone without Kimi-K3 at about that, and the recommended auto top-up threshold is the same.
- `TRANSLATION_REPAIR_RUN_SPEND_CEILING_USD` overrides it for one launch and prints `SPEND CEILING
    OVERRIDDEN`; unset and blank are the built-in; anything else unreadable or negative is refused at
    launch, as the entry ceiling's override is (`cap-override.ts`); zero is allowed and means start nothing,
    which is how the guard is shown to fire live at no cost.
- The total is a floor, as the spend report's is: a cut stream reports no cost.

## Option rejected

- Meter and top-up amount only: no code, but auto top-up repeats, so a runaway spends every top-up until
    someone notices, and the meter only stops a pass at zero.

## What this is not

- Not a per-entry bound: an entry in flight finishes, so a run's worst case is the ceiling plus the entries
    that had already started. The entry ceiling in minutes (`TRANSLATION_REPAIR_HARD_CAP_MINUTES`) bounds
    those.
- Not a bound on Synthetic or Hyper: neither bills in USD per call.
