# Decision: stay on the `turso` facade, do not drop to `turso_core`

Records why the peak cache keeps using the high-level `turso` crate (the async `Builder`/`Connection`
facade) instead of depending on `turso_core` directly to shed the protobuf and cloud-sync layer.
The question was "can we remove cloud-sync plus protobuf from turso,
 and is it worth it?
"
Answer:
 it is removable only by bypassing the facade,
 the savings are negligible,
 and the cost is a
rewrite against a rougher BETA API,
 so we leave it.
 Written so a future session does not re-run this
investigation.
 Companion to the manifest-level audit at `doc/audit/turso-cargo-toml-0.6.1.md`.

## Decision

Keep `turso = { version = "0.6", default-features = false }`
(`Cargo.toml`,
 the cache dep) and the tokio-backed cache-service actor
(`src/peakcache_service.rs`).
 Do not migrate to `turso_core`.
 Revisit only on the triggers below.

## Context

The cache actor opens `peaks.db` through the `turso` facade:
 `Builder::new_local(...).build().await`,
`db.connect()`,
 `conn.execute(sql, params).await`,
 `conn.query(sql, params).await`
(`src/peakcache_service.rs:336`,
 `:350`,
 `:364`,
 `:409`,
 `:464`,
 `:509`).
 That facade is a thin async
wrapper over the actual engine crate `turso_core`,
 which it re-exports as `turso::core`.

The facade pulls a sync and protobuf layer the player never calls:
 the `turso` crate declares
`turso_sync_sdk_kit` as a non-optional dependency,
 which pulls `turso_sync_engine`,
 which pulls `prost`
(protobuf).
 The `sync` cargo feature gates only the HTTP transport (`hyper` and friends),
 which
`default-features = false` already excludes,
 so the HTTP "cloud-sync" client is not even compiled.
 The
non-optional piece that remains is the protobuf codec plus the sync-engine state machine plus the
SDK-kit wrapper layers.
 No feature flag removes them.
 See the manifest audit for the per-entry breakdown.

## What was proven

Removing the protobuf and sync layer is possible only one way:
 depend on `turso_core` directly.
`turso_core`'s manifest has zero `prost`,
 `tokio`,
 `hyper`,
 or sync-engine dependencies;
 it is the pure
engine.
 A throwaway spike crate depending on `turso_core` alone ran the full peak-cache round trip
(`CREATE TABLE`,
 parameterized upsert with `ON CONFLICT DO UPDATE`,
 point read,
 fingerprint snapshot)
and `cargo tree` confirmed `prost`,
 `prost-derive`,
 `tokio`,
 `hyper`,
 the `turso` facade,
 and all three
SDK and sync kits were absent from its graph.

Two caveats surfaced in the spike:

-   `turso_core` is the lower-level synchronous,
     step-based engine.
     You open with
    `Database::open_file(Arc<dyn IO>, path)` (supplying a `PlatformIO::new()` yourself,
     no `Builder`),
    then `conn.prepare(sql)`,
     `stmt.bind_at(NonZero, Value::from_text(..))` / `Value::from_f64(..)`,
    and drive completion with `run_ignore_rows()` (writes) or `run_collect_rows()` (reads),
     reading a
    cell back with `Value::as_float()`.
     It is fully synchronous and self-driving,
     so migrating would
    also let us delete tokio and remove async from the whole app (the actor becomes a plain
    `std::thread`).
     No `Builder`,
     no auto value boxing,
     no `.await`.
-   `turso_core` has a feature-gating bug:
     `features = ["fs"]` alone fails to compile because
    `incremental/dbsp.rs` uses `uuid` unconditionally.
     The minimal viable set is
    `["fs", "uuid", "time", "json", "series"]`.

## Measured savings (the reason we declined)

All measured on this repo at turso 0.6.1,
 not estimated:

-   Shipped binary:
     negligible.
     The removable crates contribute roughly 63 KiB of code
    (`turso_sdk_kit` 32.1 KiB,
     `tokio` 16.6 KiB,
     the `turso` facade 13.7 KiB,
     sync kits under 1 KiB);
    `prost` and `prost-derive` do not appear in the binary at all,
     fully dead-stripped because nothing
    calls them.
     That is well under half a megabyte of a 31 MB stripped binary.
     By contrast `turso_core`
    itself is 6.7 MiB,
     the single largest crate in the binary,
     and we keep it.
     The protobuf was never
    costing binary size;
     the engine is.
-   Runtime and speed:
     zero change.
     The same `turso_core` engine runs either way.
-   Dependency graph:
     26 crates leave (539 down to 513,
     nothing added),
     measured by swapping the dep in
    a forked worktree and diffing `cargo tree`.
     This is the most real number,
     and it is a supply-chain
    hygiene point,
     not a footprint one:
     it stops compiling a BETA protobuf and networking stack we never
    invoke.
-   Compile time:
     the removable facade,
     SDK-kit,
     sync-engine,
     and protobuf layer builds in 7.58 s wall
    (20.79 s CPU) on this 16-thread machine,
     off a roughly 4-minute cold release build,
     plus a few more
    seconds for tokio.
     Only on cold builds;
     incremental builds recompile none of it.

## Cost of migrating

Rewrite `src/peakcache_service.rs` (and the channel types in `src/peakcache_handle.rs`) against the
lower-level BETA API above,
 then re-run full verification:
 the unit tests plus the user-boundary
indexing,
 playback,
 and durability checks.
 The cache feeds the audio gain path,
 so rewriting it against
a rougher API for ~0.1 MB and ~7 s of cold compile is a poor risk-reward.
 The actor and handle split
already isolates the cache,
 so the change would be contained,
 but contained is not the same as free.

## When to revisit

Reconsider only if one of these becomes true,
 since none are about footprint or speed:

-   You want the unused BETA protobuf and networking dependency out of the supply chain on principle.
-   You want async and tokio gone from the codebase entirely for architectural cleanliness (the cache
    is the only async surface;
     `turso_core` is synchronous,
     so dropping the facade drops the runtime).
-   A future turso release makes `turso_core` the recommended entry point,
     or makes the sync layer
    optional behind a feature.

## How this was measured (reproducible)

-   Crate delta:
     `git worktree add` at HEAD,
     swap `turso` for
    `turso_core = { version = "0.6", default-features = false, features = ["fs", "uuid", "time", "json", "series"] }`,
    remove the `tokio` dep,
     then diff `cargo tree --edges normal --prefix none` against the main tree.
    `cargo tree` resolves without compiling,
     so the not-yet-migrated code does not matter.
-   Binary bytes:
     `cargo bloat --release --crates` on the built binary,
     reading the per-crate `.text`
    contribution.
     The shipped binary is stripped,
     so `nm` symbol counts are meaningless (tokio reads
    zero too);
     use `cargo bloat`,
     which works from the unstripped analysis build.
-   Compile time:
     `cargo clean --release -p` the removable crates,
     then time rebuilding up to the facade
    (`cargo build --release -p turso`).
