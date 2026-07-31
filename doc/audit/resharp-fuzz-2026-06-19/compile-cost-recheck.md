# Compile-cost recheck: full-Unicode \w{N} (bug-06), bug-09 fixed

The one perf finding the maintainer acknowledged and deferred ("This one is
slightly better but not fixed,
 will need a separate builder optimization pass";
"the several seconds of compile time for full UTF-8 support with `\w{24}` is to be
expected").
 Re-measured on 0.6.13 to characterize the curve precisely,
 because the
06-11 note implied open-ended scaling toward the `{0,500}` cap;
 the measured shape
is more bounded than that.

## Curve (x86_64, release, `perf` binary, 30s budget per compile)

Full-Unicode `\w{N}` exact repeat vs ascii vs the optional form `\w{0,N}`:

```text
   N     full \w{N}   ascii \w{N}   full \w{0,N}
   4        0.854s        0.000s         0.073s
   8        1.783s        0.000s         0.122s
  12        2.457s        0.000s         0.106s
  16        3.402s        0.000s         0.140s
  20        4.082s        0.000s         0.092s
  24        4.710s        0.000s         0.122s
  32        0.375s        0.000s         0.080s
  48        0.316s        0.000s         0.121s
  64        0.400s        0.000s         0.091s
```

Three facts,
 all consistent with the maintainer's account:

- The cost is a bounded hump,
   not open-ended growth.
   It rises to ~4.7s near
  N=24 then cliffs to ~0.4s at N>=32.
   The cliff is a strategy switch (above an
  upper limit the engine stops using the expensive left-to-right `bdfa.rs` path);
  ieviev flagged exactly this lever ("adjust the upper limit of which patterns use
  the left-to-right matching path,
   `bdfa.rs` is much more expensive state space
  wise").
   So the worst case within the `{0,500}` repeat cap sits in the N~20-31
  band at a few seconds,
   not a 10s+ DoS at large N.
- The optional form is cheap and flat (~0.1s for all N),
   confirming "optional
  loops are generally MUCH cheaper in RE#,
   eg `\w{0,50}` is vastly smaller than
  `\w{50}`;
   the high lower bound is an achilles heel of all automata engines".
- ASCII and Default modes are instant;
   the cost is specific to full UTF-8 `\w`.

`\b\w{N}` full sits in the same band (0.4-0.5s at N=8..24).

## bug-09 (dot-literal concat compile blowup) is fixed

06-11 measured 40s+ (71s for the fuzzer unit) for `.n.................  n.` under
full/javascript.
 On 0.6.13:

```text
  full       = 0.286s
  javascript = 0.377s
  ascii      = 0.000s
```

Fixed.

## Fuzzer corroboration

The only artifact produced by the in-tree libFuzzer lanes across both arches was
a single `compile` slow-unit (not a crash):

```text
fuzz/artifacts/compile/slow-unit-574e73b6...  (18 bytes)
bytes: 5d 00 00 7c 00 77 09 7d 62 60 5c 77 40 5c 62 3f 24 06
       contains \w (5c 77), \b (5c 62), $ (24), ? (3f), } (7d), | (7c)
```

A `\w`/`\b`/bounded-repeat shape,
 i.e. the same compile-cost family.
 libFuzzer's
`compile` timeouts are dominated by this family,
 exactly as in 06-11.

## Adjudication

Known and acknowledged;
 tier "perf,
 not crash,
 not wrong-answer".
 It is a compile
(lazy-compilation) cost,
 not a match-time cost;
 RE#'s stated contract is fast warm
match time with cost shifted to compilation,
 and the maintainer's mitigation
guidance is to pre-compile and serialize huge patterns.
 A consumer that bounds
untrusted pattern complexity,
 avoids `unicode=Full` on attacker-supplied `\w{N}`,
or stays under the cliff sidesteps it.
 Not a 0.6.13 regression;
 carried forward.
