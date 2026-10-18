# Selective `rust/no-anonymous-functions` through types and directive comments

Status: proposal of 2026-10-18, not accepted.
Nothing in `package/linter/monochromatic-lint` changes until the owner accepts it.

## Problem

`rust/no-anonymous-functions` reports every `CLOSURE_EXPR` node
(`package/linter/monochromatic-lint/src/rust_no_anonymous_functions.rs`).
It has no option besides severity and no inline suppression.
After the IDE closures branch, 1068 of 1135 findings in `package/desktop-app/ide` became named code,
and 67 remain.
Those 67 are closures that own state for a callee that keeps or runs the callable later:
17 thread bodies, 38 Slint `on_*` callbacks, 8 `Timer::start` bodies, 2 `catch_unwind` bodies,
and 2 `tree_house` callbacks.
A named `fn` item cannot own state, and stable Rust cannot implement `FnMut` or `FnOnce` for a named type,
so no named item can replace them.
The syntax-only rule cannot tell these from closures that a `for` loop or a `match` replaces.

## What the repository already has

- The linter already holds a semantic session on rust-analyzer
  (`ra_ap_hir`, `ra_ap_hir_ty`, `ra_ap_ide_db`, `ra_ap_load-cargo`, all `=0.0.336` in `Cargo.toml`;
  `src/rust_semantic_session.rs`; used by the explicit type and generic argument rules).
  The type resolution the owner asked about is not a new dependency.
- `ra_ap_hir` 0.0.336 exposes the exact capture set of a closure:
  `hir::Closure::captured_items` returns the minimal captures with their kind
  (`CaptureKind::Move`, `SharedRef`, `UniqueSharedRef`, `MutableRef`), and `Type::as_closure` reaches the closure
  from its expression (`ra_ap_hir-0.0.336/src/lib.rs`, lines 4931 and 5029 to 5060).
  A closure with no captures can always be a named function, so that case stays reported.
- `doc/planning/unified-linter.md` lists "Directive comments of any kind" under
  "Deferred until a consumer exists".
  The consumer now exists, so accepting this proposal lifts that deferral for one directive.

## Proposal

Two independent changes, each landing and releasing on its own.

### Change 1: directive comments

A line comment `// monochromatic-lint-disable-next-line <rule> -- <reason>` silences one rule for the next
code line.
The reason is mandatory; a directive without one is itself a finding.
A directive that silences nothing is a finding too, so stale ones cannot accumulate.
Scope is one line and one named rule; there is no file-wide or block form.
Findings keep their records in the JSONL output with a `suppressed` flag and the reason,
so a suppression stays auditable.

### Change 2: a semantic criterion for the closure rule

Report a closure unless both of these hold:

1. `captured_items` is not empty, so no named function can take its place.
2. The callee requires the callable to outlive the call: the closure is a direct argument whose parameter type
   carries a `'static` bound (`thread::spawn`, `Builder::spawn`, `Timer::start`, and the generated Slint `on_*`
   setters).
   Such a callee stores or runs the state later, so a `for` loop or a `match` cannot replace the closure.

A closure that captures nothing, a closure that only borrows for the duration of the call
(an iterator adaptor, `catch_unwind`), and a let-bound closure stay reported.

What this leaves in the IDE: 63 of the 67 would pass if every `'static` claim holds.
The 4 closures without a `'static` callee (`catch_unwind` twice, `tree_house` twice) take a directive comment
with a reason, which is the use the directive exists for.

### Evidence and gaps

- Verified in source: `Timer::start` takes `impl FnMut() + 'static` (`i-slint-core-1.18.1/timers.rs`, line 93);
  `std::panic::catch_unwind` takes `F: FnOnce() -> R + UnwindSafe` with no `'static`
  (`library/std/src/panic.rs`, line 358).
- Not verified: the generated Slint `on_*` setter bound (the generated source was not present in the build
  directory when this was written), and whether `ra_ap_hir` answers "the parameter type of this callee carries a
  `'static` bound" for a resolved call without extra work.
  A spike must settle both before the criterion is accepted; if the second fails, the fallback is an allow-list
  of callee paths as a rule option.
- Cost is unmeasured: a semantic rule needs the workspace load that the explicit-type rules already pay,
  and a syntax-only run would no longer be enough for this rule.
  The spike measures the added time on the IDE package.

## Rejected for now

- Allowing every `move` closure that is a call argument: coarse, and adding `move` is an easy escape.
- Allowing any closure that captures a local: it would have allowed most of the 1068 closures the IDE branch
  converted, since a loop replaces an iterator adaptor that captures a variable.
- Per-file `off` entries in `monochromatic-lint.config.jsonc`: the exemption sits away from the code and covers
  every closure later added to the file.

## Order of work if accepted

1. Spike on the two unverified points, with a positive control (a `thread::spawn(move || ..)` that must pass
   and a capture-free closure that must be reported).
2. Change 1 with tests, a release, and the config of this repository left unchanged.
3. Change 2 with tests that include the adversarial cases (shadowed names, nested closures, closures in macro
   token trees, which the syntax frontend does not see), a release, then a lint run over every Rust package to
   record how the count moves.
4. In the IDE: directive comments on the remaining sites, then the `warn` to `error` switch the owner scheduled
   on 2026-10-05 ("warn everywhere until no finding is left, then error").
