# cargo-fuzz 0.13.2 default ASan still emits nightly-only -Zsanitizer on stable Rust

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

## Symptom

Running the default cargo-fuzz command through stable Rust still fails before the fuzz target builds:

```text
$ cargo +stable fuzz run --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
error: failed to run `rustc` to learn about target-specific information

Caused by:
  process didn't exit successfully: `/home/user/.rustup/toolchains/stable-x86_64-unknown-linux-gnu/bin/rustc ... -Zsanitizer=address ... --target x86_64-unknown-linux-gnu ...` (exit status: 1)
  --- stderr
  error: the option `Z` is only accepted on the nightly compiler

  help: consider switching to a nightly toolchain: `rustup default nightly`

  error: 1 nightly option were parsed
```

The same failure happens even when the stable ASan target is selected,
 unless cargo-fuzz is told not to add
its own sanitizer flag:

```text
$ cargo +stable fuzz run --target x86_64-unknown-linux-gnuasan fuzz_target_1 -- -runs=0
... -Zsanitizer=address ... --target x86_64-unknown-linux-gnuasan ...
error: the option `Z` is only accepted on the nightly compiler
```

## Root cause

The current upstream source under test is `rust-fuzz/cargo-fuzz` commit
`984c861c8dfea28055254c5f1d2659ab2cd63f76`,
 released as cargo-fuzz 0.13.2.
The README still documents the nightly requirement:

```md
# rust-fuzz/cargo-fuzz README.md:13-15
Note: `libFuzzer` needs LLVM sanitizer support, so this only works on x86-64 and Aarch64,
and only on Unix-like operating systems (not Windows). This also needs a nightly compiler since it uses some
 unstable command-line flags. You'll also need a C++ compiler with C++11 support.
```

Default builds request AddressSanitizer:

```rust
// rust-fuzz/cargo-fuzz src/options.rs:82-84
    /// Use a specific sanitizer
    #[arg(short, long, value_enum, default_value = "address")]
    pub sanitizer: Sanitizer,
```

The default `BuildOptions` value is also `Sanitizer::Address`:

```rust
// rust-fuzz/cargo-fuzz src/options.rs:313-318
            all_features: false,
            features: None,
            build_std: false,
            careful_mode: false,
            sanitizer: Sanitizer::Address,
            triple: String::from(crate::utils::default_target()),
```

When a sanitizer is enabled,
 cargo-fuzz chooses between the old nightly-only `-Zsanitizer` spelling and a future
stable sanitizer spelling:

```rust
// rust-fuzz/cargo-fuzz src/project.rs:221-239
        if !matches!(build.sanitizer, Sanitizer::None) {
            // Select the appropriate sanitizer flag for the given rustc version
            let rust_version = RustVersion::discover()?;
            let sanitizer_flag = match rust_version.has_sanitizers_on_stable() {
                true => "-Csanitizer",
                false => "-Zsanitizer",
            };

            // Set rustc CLI arguments for the chosen sanitizer
            match build.sanitizer {
                Sanitizer::None => {} // needs no flags
                Sanitizer::Memory => {
                    // Memory sanitizer requires more flags to function than others:
                    // https://doc.rust-lang.org/unstable-book/compiler-flags/sanitizer.html#memorysanitizer
                    rustflags.push_str(&format!(
                        " {sanitizer_flag}=memory -Zsanitizer-memory-track-origins"
                    ))
                }
                _ => rustflags.push_str(&format!(" {sanitizer_flag}={}", build.sanitizer)),
```

That future-stable detection is deliberately disabled because the stabilizing Rust release is not known:

```rust
// rust-fuzz/cargo-fuzz src/rustc_version.rs:87-102
/// Checks whether the compiler supports sanitizers on stable channel.
/// Such compilers (even nightly) do not support `-Zsanitizer` flag,
/// and require a different combination of flags even on nightly.
///
/// Stabilization PR with more info: <https://github.com/rust-lang/rust/pull/123617>
impl RustVersion {
    pub fn has_sanitizers_on_stable(&self) -> bool {
        // TODO: the release that stabilizes sanitizers is not currently known.
        // This value is a PLACEHOLDER.
        let release_that_stabilized_sanitizers = RustVersion {
            major: u32::MAX,
            minor: u32::MAX,
            nightly: false,
        };
        self >= &release_that_stabilized_sanitizers
    }
}
```

So cargo-fuzz will not stop requiring nightly for its default ASan path until both of these are true:

- Rust stabilizes the sanitizer path cargo-fuzz needs,
   or provides target-level sanitizer standard libraries that
  cargo-fuzz can drive without `-Zsanitizer`.
- cargo-fuzz releases a change replacing the placeholder with the real stable-version or target-aware behavior.

Rust-side status checked on 2026-06-28:

- `rust-lang/rust#123617`,
   `sanitizers: Stabilize AddressSanitizer and LeakSanitizer`,
   is still open.
- `rust-lang/rust#123615`,
   the sanitizer stabilization tracking issue,
   is still open.
- `rust-lang/rust#149644` merged the `x86_64-unknown-linux-gnuasan` target,
   whose rustc book page says its goal is
  ASan-instrumented standard libraries through rustup without nightly `build-std`.
- `rust-lang/rust#152757` merged `x86_64-unknown-linux-gnumsan` and `x86_64-unknown-linux-gnutsan` targets for MSan
  and TSan.
- The 2026 Rust Project Goal for sanitizer support is accepted.
   It aims to stabilize MemorySanitizer and
  ThreadSanitizer over the year,
   and says AddressSanitizer and LeakSanitizer are close to stabilization rather than
  already stabilized.

## Verification

Environment:

```text
cargo-fuzz 0.13.2
cargo-fuzz source: rust-fuzz/cargo-fuzz 984c861c8dfea28055254c5f1d2659ab2cd63f76
stable rustc: 1.96.0, via stable-x86_64-unknown-linux-gnu
nightly rustc: 1.98.0-nightly (f28ac764c 2026-06-23)
host: x86_64 Linux
```

Disposable fixture:

```bash
rm --recursive --force /tmp/agent/cargo-fuzz-stable-repro
mkdir --parents /tmp/agent/cargo-fuzz-stable-repro
cd /tmp/agent/cargo-fuzz-stable-repro
cargo +stable new fuzzed
cd fuzzed
cargo +stable fuzz init
```

Patterns that fail:

```text
$ cargo +stable fuzz run --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
... -Zsanitizer=address ...
error: the option `Z` is only accepted on the nightly compiler
```

```text
$ cargo +stable fuzz run --target x86_64-unknown-linux-gnuasan fuzz_target_1 -- -runs=0
... -Zsanitizer=address ...
error: the option `Z` is only accepted on the nightly compiler
```

Patterns that build and run:

```text
$ cargo +nightly fuzz run --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
Finished `release` profile [optimized + debuginfo] target(s) in 8.08s
INFO: Loaded 1 modules   (295 inline 8-bit counters): 295 [...]
Done 2 runs in 0 second(s)
```

```text
$ cargo +stable fuzz run --sanitizer none --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
Finished `release` profile [optimized + debuginfo] target(s) in 5.72s
WARNING: Failed to find function "__sanitizer_acquire_crash_state".
WARNING: Failed to find function "__sanitizer_print_stack_trace".
WARNING: Failed to find function "__sanitizer_set_death_callback".
INFO: Loaded 1 modules   (151 inline 8-bit counters): 151 [...]
Done 2 runs in 0 second(s)
```

```text
$ rustup target add x86_64-unknown-linux-gnuasan --toolchain stable
$ cargo +stable fuzz run --sanitizer none --target x86_64-unknown-linux-gnuasan fuzz_target_1 -- -runs=0
Finished `release` profile [optimized + debuginfo] target(s) in 4.06s
INFO: Loaded 1 modules   (295 inline 8-bit counters): 295 [...]
Done 2 runs in 0 second(s)
```

## Verified workarounds

### Use nightly for the default cargo-fuzz path

```bash
cargo +nightly fuzz run --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
```

Tradeoff:
 keeps cargo-fuzz's default ASan behavior,
 but still depends on nightly Rust.

### Use stable without a sanitizer

```bash
cargo +stable fuzz run --sanitizer none --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
```

Tradeoff:
 coverage-guided fuzzing still runs,
 but sanitizer diagnostics are absent.
 libFuzzer also reports missing
sanitizer crash-state,
 stack-trace,
 and death-callback hooks.
 This is suitable for panic,
 assertion,
parser-invariant,
 and corpus-generation fuzzing,
 not for catching unsafe-code memory bugs.

### Use stable plus the ASan target while suppressing cargo-fuzz's sanitizer flag

```bash
rustup target add x86_64-unknown-linux-gnuasan --toolchain stable
cargo +stable fuzz run --sanitizer none --target x86_64-unknown-linux-gnuasan fuzz_target_1 -- -runs=0
```

Tradeoff:
 this avoids `-Zsanitizer` and uses Rust's ASan target,
 but cargo-fuzz sees `--sanitizer none`,
 so it also
skips cargo-fuzz's ASan-specific environment defaults.
 Treat it as a smoke-tested bridge,
 not full parity with the
nightly default path.

## What does not work

- Waiting for cargo-fuzz alone.
   The 0.13.2 source already has a stable-sanitizer branch,
   but the version gate is a
  placeholder until Rust stabilization lands.
- Omitting `--target` when testing stable workarounds.
   cargo-fuzz's default target is environment-dependent;
  in this verification it picked `x86_64-unknown-linux-musl`,
   which failed before the sanitizer question because that
  stable target was not installed.
- Selecting `--target x86_64-unknown-linux-gnuasan` by itself.
   cargo-fuzz still defaults to `--sanitizer address`,
  so it still emits `-Zsanitizer=address` on stable.
- Assuming Rust's new sanitizer targets mean cargo-fuzz default mode is stable.
   They make a stable bridge possible,
  but cargo-fuzz needs either `--sanitizer none` today or an upstream change later.

## Upstream filing decision

`.out-of-scope/` checked on 2026-06-28.
 No cargo-fuzz,
 rust-fuzz,
 Rust sanitizer,
 or libFuzzer exemption exists.

Duplicate and status searches checked:

```bash
gh search issues --repo rust-fuzz/cargo-fuzz 'stable nightly sanitizer' --state open --limit 20
gh search issues --repo rust-fuzz/cargo-fuzz 'stable nightly sanitizer' --state closed --limit 20
gh search issues --repo rust-fuzz/cargo-fuzz 'Csanitizer OR -Csanitizer OR 123617 OR sanitizers on stable' --state open --limit 20
gh search issues --repo rust-fuzz/cargo-fuzz 'Csanitizer OR -Csanitizer OR 123617 OR sanitizers on stable' --state closed --limit 20
gh search prs --repo rust-fuzz/cargo-fuzz 'has_sanitizers_on_stable' --state open --limit 20
gh search prs --repo rust-fuzz/cargo-fuzz 'has_sanitizers_on_stable' --state closed --limit 20
gh issue view 123615 --repo rust-lang/rust
gh pr view 123617 --repo rust-lang/rust
gh pr view 149644 --repo rust-lang/rust
gh pr view 152757 --repo rust-lang/rust
```

No matching cargo-fuzz issue or pull request surfaced.
 Rust already has the active tracking issue and pull requests
listed above.

Constraint check:

- Is it upstream's fault?
   Not as a cargo-fuzz bug yet.
   cargo-fuzz documents the nightly requirement and the source
  explicitly points at the Rust stabilization PR while using a placeholder.
   Rust-side stabilization is still open.
- Can upstream fix it?
   Yes.
   Rust can stabilize sanitizer support or ship target-level sanitizer standard libraries;
  cargo-fuzz can then update the placeholder or add target-aware stable behavior.
- Are they supporting this use case?
   Yes.
   cargo-fuzz is a libFuzzer wrapper,
   and Rust's sanitizer goals explicitly
  target use without nightly toolchains and without local `build-std`.
- Would the repo welcome our contribution?
   Probably,
   but not enough to file now.
   The cargo-fuzz repository has no
  policy found in this pass that bans outside reports,
   but a report before the stabilizing Rust release would only
  restate the existing source TODO and Rust tracking issues.
- Will they likely fix it?
   Plausible.
   The Rust project has accepted sanitizer goals and merged sanitizer target
  groundwork.
   cargo-fuzz already contains the future branch.
   No schedule or release number is committed.
- Have we prototyped a minimal fix compatible with their architecture?
   No,
   because constraint one is not satisfied
  for a cargo-fuzz filing today.
   A cargo-fuzz patch would need the final Rust stabilization version or target policy.

Do not file as-is.
 Existing Rust tracking already captures the stabilization work,
 and a cargo-fuzz issue today would
add no missing reproduction or source trace beyond what the upstream source already says.
 Re-evaluate once
`rust-lang/rust#123617` merges or a stable release note names the sanitizer stabilization version.

Draft,
 kept for a future cargo-fuzz issue if Rust stabilization lands but cargo-fuzz is not updated:

~~~md
Title: Replace stable sanitizer placeholder after Rust stabilizes sanitizer support

cargo-fuzz 0.13.2 still treats stable Rust as lacking stable sanitizer support because
`src/rustc_version.rs` leaves `release_that_stabilized_sanitizers` at `u32::MAX`.
That is correct before Rust stabilization, but after the stabilizing Rust release lands,
default `cargo +stable fuzz run` will keep emitting `-Zsanitizer=address` until this placeholder
is updated or replaced with target-aware detection.

Reproduction after the stabilizing Rust release:

```text
cargo +stable fuzz run --target x86_64-unknown-linux-gnu fuzz_target_1 -- -runs=0
```

Expected: cargo-fuzz uses the stable sanitizer path or a stable sanitizer target.
Actual before the cargo-fuzz update: cargo-fuzz emits `-Zsanitizer=address` and stable rustc rejects it.

Relevant source:

- `src/rustc_version.rs:93-101`: `has_sanitizers_on_stable` compares against a placeholder max version.
- `src/project.rs:224-227`: sanitizer flag selection falls back to `-Zsanitizer` while the placeholder is active.
- `src/options.rs:82-84`: default sanitizer remains `address`.

Suggested fix: replace the placeholder with the stabilized Rust version or add target-aware behavior for stable
sanitizer targets such as `x86_64-unknown-linux-gnuasan`.
~~~
