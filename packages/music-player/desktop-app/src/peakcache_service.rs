//! The peak-cache service actor: the ONE async surface in the app.
//!
//! A dedicated `std::thread` owns a current-thread tokio runtime and the shared
//! `truepeak_core::DecisionCache` (a Turso-backed `decisions.db`). It drains two
//! request channels (reads and writes) in a `biased` `select!` that favors reads, so a
//! controller lookup never queues behind a cold sweep's thousands of upserts. Everything
//! else in the player stays synchronous and reaches this actor through the blocking
//! `CacheHandle` (see `peakcache_handle.rs`); the realtime audio callback and the engine
//! park/unpark loop never touch async. The cache's decision schema, its exact-over-probe
//! precedence, and every SQL statement live in the shared crate now; this actor is only the
//! sync-to-async bridge that owns the connection on one thread. If the database cannot be
//! opened the actor runs DEGRADED (reads answer `None`, the exact set stays empty, writes
//! drop) so callers never hang.

/// What:     `use std::collections::HashSet;`. A set of owned `u64` fingerprints.
/// Why:      The `Known` reply is the exact-decision fingerprint snapshot the sweep skips on.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HashSet = Set<bigint>;
/// ```
use std::collections::HashSet;

/// What:     `use std::path::PathBuf;`. Owned filesystem path buffer.
/// Why:      The actor thread owns the database path after the caller returns.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type PathBuf = string;
/// ```
use std::path::PathBuf;

/// What:     `use std::thread;`. OS-thread spawning.
/// Why:      The actor runs on its own thread so its runtime never blocks the engine.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // std::thread ~ a dedicated Worker
/// ```
use std::thread;

/// What:     `use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};`.
///           Many-producer, single-consumer unbounded channels. `send` is synchronous
///           (non-blocking), so sync callers can enqueue without an `await`; the actor
///           `recv().await`s.
/// Why:      Carry read and write requests from sync callers to the async actor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // an unbounded queue with sync push and async pull
/// ```
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};

/// What:     `use tokio::sync::oneshot;`. A single-value reply channel.
/// Why:      A read request carries a `oneshot::Sender` the actor answers on; the caller
///           blocks on the matching receiver.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a one-shot Promise resolve/await pair
/// ```
use tokio::sync::oneshot;

/// What:     `use truepeak_core::{CacheIdentity, Decision, DecisionCache};`. The shared cache
///           identity tuple, the cached value, and the Turso-backed store.
/// Why:      The actor opens a `DecisionCache`, keys every operation on the desktop's
///           `CacheIdentity`, and reads/writes `Decision`s.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { CacheIdentity, Decision, DecisionCache } from "truepeak-core";
/// ```
use truepeak_core::{CacheIdentity, Decision, DecisionCache};

/// What:     `pub(super) enum Read { Get { .. }, Known { .. } }`. The two read requests the
///           actor answers: one point lookup, one exact-decision fingerprint snapshot. Each
///           carries a `oneshot` reply sender. `pub(super)` so the sibling handle module can
///           build them.
/// Why:      Reads share one channel kept separate from writes, so `select!` can bias them
///           ahead of a write backlog.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Read =
///   | { kind: "get"; fingerprint: bigint; reply: Resolve<Decision | null> }
///   | { kind: "known"; reply: Resolve<Set<bigint>> };
/// ```
pub(super) enum Read {
    /// What:     `Get { fingerprint: u64, reply: oneshot::Sender<Option<Decision>> }`. Look
    ///           up one decision by its fingerprint.
    /// Why:      `peak_swap` reads the current track's cached decision.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "get", fingerprint, reply }
    /// ```
    Get {
        /// What:     `fingerprint: u64`. The cache key to look up.
        /// Why:      The actor binds it into the shared `get`.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// fingerprint: bigint;
        /// ```
        fingerprint: u64,
        /// What:     `reply: oneshot::Sender<Option<Decision>>`. Where the cached decision
        ///           (or `None` on a miss) is sent.
        /// Why:      The blocking caller awaits exactly one answer.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// reply: Resolve<Decision | null>;
        /// ```
        reply: oneshot::Sender<Option<Decision>>,
    },
    /// What:     `Known { reply: oneshot::Sender<HashSet<u64>> }`. Ask for a snapshot of every
    ///           fingerprint whose decision is already exact.
    /// Why:      The sweep seeds its skip-check from this set and re-scans only the rest.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "known", reply }
    /// ```
    Known {
        /// What:     `reply: oneshot::Sender<HashSet<u64>>`. Where the exact-fingerprint set
        ///           is sent.
        /// Why:      Hand the caller an owned snapshot it reads without locking.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// reply: Resolve<Set<bigint>>;
        /// ```
        reply: oneshot::Sender<HashSet<u64>>,
    },
}

/// What:     `pub(super) struct Upsert { fingerprint: u64, decision: Decision }`. One
///           fire-and-forget write request: store or upgrade a resolved decision.
/// Why:      Writes are a separate channel with no reply, so a worker never blocks on
///           persistence; the shared cache's precedence keeps an exact row from being
///           downgraded to a probe.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Upsert = { fingerprint: bigint; decision: Decision };
/// ```
pub(super) struct Upsert {
    /// What:     `fingerprint: u64`. The cache key.
    /// Why:      Part of the row's primary key.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// fingerprint: bigint;
    /// ```
    pub(super) fingerprint: u64,
    /// What:     `decision: Decision`. The gain decision to store.
    /// Why:      The cached value; `Decision` is `Copy`, so it moves cheaply over the channel.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// decision: Decision;
    /// ```
    pub(super) decision: Decision,
}

/// What:     `pub(super) fn spawn(path: Option<PathBuf>) -> (UnboundedSender<Read>, UnboundedSender<Upsert>)`.
///           Start the actor thread for the database at `path` (`None` => degraded, no
///           persistence) and hand back the read and write senders.
/// Why:      The handle's constructors call this once and wrap the two senders.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// function spawn(path: string | null): [Sender<Read>, Sender<Upsert>] { ... }
/// ```
pub(super) fn spawn(path: Option<PathBuf>) -> (UnboundedSender<Read>, UnboundedSender<Upsert>) {
    // What:     Create the two unbounded channels (reads, writes).
    // Why:      Separate queues let the actor bias reads ahead of writes.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [readTx, readRx] = channel(); const [writeTx, writeRx] = channel();
    // ```
    let (read_tx, read_rx) = mpsc::unbounded_channel::<Read>();
    let (write_tx, write_rx) = mpsc::unbounded_channel::<Upsert>();
    // What:     Spawn the detached actor thread: build a current-thread runtime (the Step-0
    //           spike confirmed it drives Turso's local futures) and block on `run`.
    // Why:      Keep all async off every other thread; the engine stays synchronous.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // startWorker(() => runtime.blockOn(run(path, readRx, writeRx)));
    // ```
    thread::spawn(move || {
        let runtime = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .inspect_err(|error| tracing::error!(error = %error, "could not build cache runtime"))
            .expect("music-player: build cache runtime");
        runtime.block_on(run(path, read_rx, write_rx));
    });
    // What:     Return both senders. Tail -> return.
    // Why:      The handle clones and holds them; dropping all of them closes the channels
    //           and the actor exits cleanly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [readTx, writeTx];
    // ```
    (read_tx, write_tx)
}

/// What:     `async fn run(path, mut read_rx, mut write_rx)`. The actor body: open the
///           decision cache, compute the desktop identity once, then serve requests until
///           both channels close.
/// Why:      One place owns the cache, the identity, and the read-biased loop.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function run(path, readRx, writeRx) { ... }
/// ```
async fn run(
    path: Option<PathBuf>,
    mut read_rx: UnboundedReceiver<Read>,
    mut write_rx: UnboundedReceiver<Upsert>,
) {
    // What:     `let cache = open_cache(path).await;`. The open cache, or `None` when
    //           degraded (no path or open failure).
    // Why:      A degraded actor still answers every request (misses and drops).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const cache = await openCache(path);
    // ```
    let cache = open_cache(path).await;
    // What:     `let identity = super::cache_identity();`. The desktop's four-part cache key
    //           (policy, meter, decoder, schema), fixed for the run.
    // Why:      Every get/put/scan keys on it, so a policy or decoder change starts fresh.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const identity = cacheIdentity();
    // ```
    let identity = super::cache_identity();
    // The actor is ready; log whether it opened a cache or is running degraded.
    tracing::info!(degraded = cache.is_none(), "peak cache actor started");
    // What:     The serve loop. `biased;` polls the read arm first every iteration; a
    //           refutable `Some(..)` pattern disables a closed channel's arm, and
    //           `else => break` fires once BOTH are closed (all senders dropped).
    // Why:      Reads win over a write backlog; the actor shuts down cleanly when the last
    //           handle is gone.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { select reads-first; on both-closed break; }
    // ```
    loop {
        tokio::select! {
            biased;
            Some(request) = read_rx.recv() => serve_read(cache.as_ref(), identity, request).await,
            Some(request) = write_rx.recv() => put(cache.as_ref(), identity, request).await,
            else => break,
        }
    }
    // Both channels closed (all handles dropped); the actor shuts down cleanly.
    tracing::info!("peak cache actor stopped");
}

/// What:     `async fn open_cache(path: Option<PathBuf>) -> Option<DecisionCache>`. Open the
///           shared decision cache at `path`, creating parent dirs, or `None` on
///           absence/failure.
/// Why:      Centralize the open-or-degrade dance; any failure degrades to a no-op cache
///           rather than aborting the actor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function openCache(path) { ... }
/// ```
async fn open_cache(path: Option<PathBuf>) -> Option<DecisionCache> {
    // What:     `let Some(path) = path else { ...; return None; };`. Bail to degraded when
    //           there is no path (no config dir), logging the reason.
    // Why:      Run with no persistence when the platform gave us no path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!path) return null;
    // ```
    let Some(path) = path else {
        tracing::debug!("no cache path; running degraded (no persistence)");
        return None;
    };
    // What:     Ensure the parent directory exists; ignore the error (the open below surfaces
    //           a real problem).
    // Why:      First launch has no config dir yet.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // mkdirSync(dirname(path), { recursive: true });
    // ```
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent)
            .inspect_err(|error| tracing::debug!(error = %error, "could not create cache parent dir; open may still succeed"));
    }
    // What:     `let Some(path_str) = path.to_str() else { ...; return None; };`. The path as
    //           UTF-8; degrade on non-UTF-8, logging the path.
    // Why:      `DecisionCache::open` takes a `&str`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const pathStr = String(path);
    // ```
    let Some(path_str) = path.to_str() else {
        tracing::warn!(path = %path.display(), "cache path is not UTF-8; running degraded");
        return None;
    };
    // What:     `match DecisionCache::open(path_str).await { ... }`. Open (creating the
    //           schema); log and degrade on error.
    // Why:      A bad cache file must not crash the player.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return await DecisionCache.open(pathStr); } catch (e) { warn(e); return null; }
    // ```
    match DecisionCache::open(path_str).await {
        Ok(cache) => Some(cache),
        Err(error) => {
            tracing::warn!(error = %error, "cache open failed; running degraded");
            None
        }
    }
}

/// What:     `async fn serve_read(cache: Option<&DecisionCache>, identity: CacheIdentity,
///           request: Read)`. Answer one read request on its `oneshot`.
/// Why:      Keep the loop body small and the two read cases in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function serveRead(cache, identity, request) { ... }
/// ```
async fn serve_read(cache: Option<&DecisionCache>, identity: CacheIdentity, request: Read) {
    // What:     Branch on the request; each arm sends exactly one reply. `let _ =` ignores a
    //           send error (the caller may have stopped waiting).
    // Why:      A dropped receiver is normal (the caller moved on); never panic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (request.kind === "get") reply(await get(cache, identity, fp)); else reply(await known(cache, identity));
    // ```
    match request {
        Read::Get { fingerprint, reply } => {
            let _ = reply.send(get(cache, identity, fingerprint).await);
        }
        Read::Known { reply } => {
            let _ = reply.send(known(cache, identity).await);
        }
    }
}

/// What:     `async fn get(cache: Option<&DecisionCache>, identity: CacheIdentity, fingerprint:
///           u64) -> Option<Decision>`. Point-read a decision, or `None` on
///           miss/degraded/error.
/// Why:      Serves `Read::Get`; a read failure is a cache miss, never a crash.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function get(cache, identity, fingerprint) { ... }
/// ```
async fn get(cache: Option<&DecisionCache>, identity: CacheIdentity, fingerprint: u64) -> Option<Decision> {
    // What:     `let cache = cache?;`. Degraded run has no cache.
    // Why:      Answer a miss without touching a database.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!cache) return null;
    // ```
    let cache = cache?;
    // What:     `match cache.get(fingerprint, identity).await { ... }`. Run the shared point
    //           lookup; an error collapses to a miss with a log line.
    // Why:      A read failure must degrade to a miss, never propagate as a crash.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return await cache.get(fingerprint, identity); } catch (e) { warn(e); return null; }
    // ```
    match cache.get(fingerprint, identity).await {
        Ok(decision) => decision,
        Err(error) => {
            tracing::warn!(error = %error, "cache get failed; treating as miss");
            None
        }
    }
}

/// What:     `async fn known(cache: Option<&DecisionCache>, identity: CacheIdentity) ->
///           HashSet<u64>`. Snapshot every exact-decision fingerprint, or the empty set on
///           degraded/error.
/// Why:      Serves `Read::Known`; an empty snapshot just means the sweep re-measures.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function known(cache, identity) { ... }
/// ```
async fn known(cache: Option<&DecisionCache>, identity: CacheIdentity) -> HashSet<u64> {
    // What:     `let Some(cache) = cache else { return HashSet::new(); };`. Degraded run has
    //           nothing cached.
    // Why:      Skip-check finds nothing; everything re-measures.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!cache) return new Set();
    // ```
    let Some(cache) = cache else {
        return HashSet::new();
    };
    // What:     `match cache.exact_fingerprints(identity).await { ... }`. Scan the exact rows;
    //           degrade to the empty set on error.
    // Why:      A scan failure just means an empty skip-check.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { return await cache.exactFingerprints(identity); } catch (e) { warn(e); return new Set(); }
    // ```
    match cache.exact_fingerprints(identity).await {
        Ok(set) => set,
        Err(error) => {
            tracing::warn!(error = %error, "cache scan failed; empty skip-check");
            HashSet::new()
        }
    }
}

/// What:     `async fn put(cache: Option<&DecisionCache>, identity: CacheIdentity, request:
///           Upsert)`. Store or upgrade one decision; no-op when degraded.
/// Why:      Serves `Upsert`; the shared cache's `WHERE` keeps an exact decision from being
///           downgraded, and one bad write must not stall the sweep.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function put(cache, identity, request) { ... }
/// ```
async fn put(cache: Option<&DecisionCache>, identity: CacheIdentity, request: Upsert) {
    // What:     `let Some(cache) = cache else { return; };`. Degraded run drops the write.
    // Why:      Nothing to persist to.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!cache) return;
    // ```
    let Some(cache) = cache else {
        return;
    };
    // What:     `if let Err(error) = cache.put(...).await { ... }`. Upsert the decision; log
    //           and continue on error.
    // Why:      One bad write must not stall the sweep; persistence is best-effort.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { await cache.put(request.fingerprint, identity, request.decision); } catch (e) { warn(e); }
    // ```
    if let Err(error) = cache.put(request.fingerprint, identity, &request.decision).await {
        tracing::warn!(error = %error, "cache put failed; write dropped");
    }
}
