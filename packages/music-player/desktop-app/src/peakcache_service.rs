//! The peak-cache service actor: the ONE async surface in the app.
//!
//! A dedicated `std::thread` owns a current-thread tokio runtime and the single
//! Turso connection to `peaks.db`. It drains two request channels (reads and
//! writes) in a `biased` `select!` that favors reads, so a controller lookup
//! never queues behind a cold sweep's thousands of upserts. Everything else in
//! the player stays synchronous and reaches this actor through the blocking
//! `CacheHandle` (see `peakcache_handle.rs`); the realtime audio callback and the
//! engine park/unpark loop never touch async. If the database cannot be opened
//! the actor runs DEGRADED (reads answer `None`, the key set stays empty, writes
//! drop) so callers never hang, mirroring the old in-memory-only fallback.

/// What:     `use std::collections::HashSet;`. A set of owned `String` keys.
/// Why:      The actor keeps every known fingerprint in memory so the sweep's
///           bulk skip-check is a cheap clone, not a per-rescan table scan.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type HashSet = Set<string>;
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
///           Many-producer, single-consumer unbounded channels. `send` is
///           synchronous (non-blocking), so sync callers can enqueue without an
///           `await`; the actor `recv().await`s.
/// Why:      Carry read and write requests from sync callers to the async actor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // an unbounded queue with sync push and async pull
/// ```
use tokio::sync::mpsc::{self, UnboundedReceiver, UnboundedSender};

/// What:     `use tokio::sync::oneshot;`. A single-value reply channel.
/// Why:      A read request carries a `oneshot::Sender` the actor answers on; the
///           caller blocks on the matching receiver.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// // a one-shot Promise resolve/await pair
/// ```
use tokio::sync::oneshot;

/// What:     `use turso::{Builder, Connection, Database};`. The Turso embedded
///           database: `Builder` opens a local file, `Database` is the open handle,
///           `Connection` runs SQL.
/// Why:      The actor opens and queries the on-disk peak store.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// import { Builder } from "turso";
/// ```
use turso::{Builder, Connection, Database};

/// What:     `pub(super) enum Read { Get { .. }, Known { .. } }`. The two read
///           requests the actor answers: one point lookup, one full key-set
///           snapshot. Each carries a `oneshot` reply sender. `pub(super)` so the
///           sibling handle module can build them.
/// Why:      Reads share one channel kept separate from writes, so `select!` can
///           bias them ahead of a write backlog.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Read =
///   | { kind: "get"; fingerprint: string; reply: Resolve<number | null> }
///   | { kind: "known"; reply: Resolve<Set<string>> };
/// ```
pub(super) enum Read {
    /// What:     `Get { fingerprint: String, reply: oneshot::Sender<Option<f32>> }`.
    ///           Look up one peak by its fingerprint.
    /// Why:      `peak_swap` reads the current track's cached gain.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "get", fingerprint, reply }
    /// ```
    Get {
        /// What:     `fingerprint: String`. The owned cache key to look up.
        /// Why:      The actor binds it into the `SELECT`.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// fingerprint: string;
        /// ```
        fingerprint: String,
        /// What:     `reply: oneshot::Sender<Option<f32>>`. Where the measured peak
        ///           (or `None` on a miss) is sent.
        /// Why:      The blocking caller awaits exactly one answer.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// reply: Resolve<number | null>;
        /// ```
        reply: oneshot::Sender<Option<f32>>,
    },
    /// What:     `Known { reply: oneshot::Sender<HashSet<String>> }`. Ask for a
    ///           snapshot of every known fingerprint.
    /// Why:      The sweep seeds its skip-check from the actor's in-memory set.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// { kind: "known", reply }
    /// ```
    Known {
        /// What:     `reply: oneshot::Sender<HashSet<String>>`. Where the cloned key
        ///           set is sent.
        /// Why:      Hand the caller an owned snapshot it can read without locking.
        ///
        /// In TS you'd write (pseudocode):
        /// ```ts
        /// reply: Resolve<Set<string>>;
        /// ```
        reply: oneshot::Sender<HashSet<String>>,
    },
}

/// What:     `pub(super) struct Upsert { fingerprint: String, peak: f32 }`. One
///           fire-and-forget write request: store or replace a measured peak.
/// Why:      Writes are a separate channel with no reply, so the sweep's workers
///           never block on persistence.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// type Upsert = { fingerprint: string; peak: number };
/// ```
pub(super) struct Upsert {
    /// What:     `fingerprint: String`. The owned cache key.
    /// Why:      Primary key of the row.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// fingerprint: string;
    /// ```
    pub(super) fingerprint: String,
    /// What:     `peak: f32`. The measured true peak.
    /// Why:      The cached value, stored as SQLite `REAL`.
    ///
    /// In TS you'd write (pseudocode):
    /// ```ts
    /// peak: number;
    /// ```
    pub(super) peak: f32,
}

/// What:     `pub(super) fn spawn(path: Option<PathBuf>) -> (UnboundedSender<Read>, UnboundedSender<Upsert>)`.
///           Start the actor thread for the database at `path` (`None` => degraded,
///           no persistence) and hand back the read and write senders.
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
    // What:     Spawn the detached actor thread: build a current-thread runtime
    //           (the Step-0 spike confirmed it drives Turso's local futures) and
    //           block on `run`.
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
            .expect("music-player: build cache runtime");
        runtime.block_on(run(path, read_rx, write_rx));
    });
    // What:     Return both senders. Tail -> return.
    // Why:      The handle clones and holds them; dropping all of them closes the
    //           channels and the actor exits cleanly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [readTx, writeTx];
    // ```
    (read_tx, write_tx)
}

/// What:     `async fn run(path, mut read_rx, mut write_rx)`. The actor body: open
///           the database, seed the key set, then serve requests until both
///           channels close.
/// Why:      One place owns the connection, the key set, and the read-biased loop.
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
    // What:     Open the database; keep the `Database` handle alive alongside the
    //           `Connection` for the actor's whole life. `None` => degraded.
    // Why:      Dropping the `Database` would close the connection; binding `_db`
    //           holds it open.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const opened = await open(path);
    // ```
    let opened = open(path).await;
    let (_db, conn): (Option<Database>, Option<Connection>) = match opened {
        Some((db, conn)) => (Some(db), Some(conn)),
        None => (None, None),
    };
    // What:     Seed the in-memory key set from the table, or empty when degraded.
    // Why:      `Known` answers from this set; it grows as upserts land.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let known = conn ? await seedKnown(conn) : new Set();
    // ```
    let mut known: HashSet<String> = match conn.as_ref() {
        Some(conn) => seed_known(conn).await,
        None => HashSet::new(),
    };
    // What:     The serve loop. `biased;` polls the read arm first every iteration;
    //           a refutable `Some(..)` pattern disables a closed channel's arm, and
    //           `else => break` fires once BOTH are closed (all senders dropped).
    // Why:      Reads win over a write backlog; the actor shuts down cleanly when
    //           the last handle is gone.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // while (true) { select reads-first; on both-closed break; }
    // ```
    loop {
        tokio::select! {
            biased;
            Some(request) = read_rx.recv() => serve_read(conn.as_ref(), &known, request).await,
            Some(request) = write_rx.recv() => {
                upsert(conn.as_ref(), &request.fingerprint, request.peak).await;
                known.insert(request.fingerprint);
            }
            else => break,
        }
    }
}

/// What:     `async fn serve_read(conn: Option<&Connection>, known: &HashSet<String>, request: Read)`.
///           Answer one read request on its `oneshot`.
/// Why:      Keep the loop body small and the two read cases in one place.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function serveRead(conn, known, request) { ... }
/// ```
async fn serve_read(conn: Option<&Connection>, known: &HashSet<String>, request: Read) {
    // What:     Branch on the request; each arm sends exactly one reply. `let _ =`
    //           ignores a send error (the caller may have stopped waiting).
    // Why:      A dropped receiver is normal (the caller moved on); never panic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (request.kind === "get") reply(await get(conn, fp)); else reply(clone(known));
    // ```
    match request {
        Read::Get { fingerprint, reply } => {
            let _ = reply.send(get(conn, &fingerprint).await);
        }
        Read::Known { reply } => {
            let _ = reply.send(known.clone());
        }
    }
}

/// What:     `async fn open(path: Option<PathBuf>) -> Option<(Database, Connection)>`.
///           Open `peaks.db` (creating parent dirs and the schema), or `None` on
///           absence/failure.
/// Why:      Centralize the open-and-ensure-schema dance; any failure degrades to
///           an in-memory-only run rather than aborting the actor.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function open(path) { ... }
/// ```
async fn open(path: Option<PathBuf>) -> Option<(Database, Connection)> {
    // What:     Bail to degraded when there is no path (no config dir).
    // Why:      Same behavior as the old cache: run in memory, persist nothing.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!path) return null;
    // ```
    let path = path?;
    // What:     Ensure the parent directory exists; ignore the error (the open
    //           below will surface a real problem).
    // Why:      First launch has no config dir yet.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // mkdirSync(dirname(path), { recursive: true });
    // ```
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    // What:     Open the local database; log and degrade on error.
    // Why:      A bad cache file must not crash the player.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let db; try { db = await Builder.newLocal(path).build(); } catch { return null; }
    // ```
    let db = match Builder::new_local(path.to_str()?).build().await {
        Ok(db) => db,
        Err(e) => {
            eprintln!("music-player: cache open failed: {e}");
            return None;
        }
    };
    // What:     Open a connection on the database; log and degrade on error.
    // Why:      Without a connection there is nothing to query.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const conn = db.connect();
    // ```
    let conn = match db.connect() {
        Ok(conn) => conn,
        Err(e) => {
            eprintln!("music-player: cache connect failed: {e}");
            return None;
        }
    };
    // What:     Ensure the one table exists. `()` is the empty parameter list.
    // Why:      First launch starts from an empty schema.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // await conn.execute("CREATE TABLE IF NOT EXISTS peaks (...)", []);
    // ```
    if let Err(e) = conn
        .execute(
            "CREATE TABLE IF NOT EXISTS peaks (fingerprint TEXT PRIMARY KEY, peak REAL)",
            (),
        )
        .await
    {
        eprintln!("music-player: cache schema failed: {e}");
        return None;
    }
    // What:     Hand back both handles. Tail -> return.
    // Why:      `run` keeps the `Database` alive next to the `Connection`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return [db, conn];
    // ```
    Some((db, conn))
}

/// What:     `async fn seed_known(conn: &Connection) -> HashSet<String>`. Read every
///           fingerprint already in the table into a set.
/// Why:      The set seeds the sweep's skip-check; once seeded, upserts keep it
///           current without re-scanning.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function seedKnown(conn) { ... }
/// ```
async fn seed_known(conn: &Connection) -> HashSet<String> {
    // What:     Start an empty set.
    // Why:      Accumulate the keys into it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const set = new Set();
    // ```
    let mut set = HashSet::new();
    // What:     Query all fingerprints; degrade to the empty set on error.
    // Why:      A scan failure just means an empty skip-check (everything re-measures).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let rows; try { rows = await conn.query("SELECT fingerprint FROM peaks", []); } catch { return set; }
    // ```
    let mut rows = match conn.query("SELECT fingerprint FROM peaks", ()).await {
        Ok(rows) => rows,
        Err(_) => return set,
    };
    // What:     Drain the rows, inserting each text fingerprint. `while let Ok(Some(..))`
    //           stops at the end (`Ok(None)`) or any error.
    // Why:      Build the full key snapshot.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for await (const row of rows) set.add(row.get(0));
    // ```
    while let Ok(Some(row)) = rows.next().await {
        if let Ok(value) = row.get_value(0)
            && let Some(text) = value.as_text()
        {
            set.insert(text.clone());
        }
    }
    // What:     Return the seeded set. Tail -> return.
    // Why:      Hand the snapshot to the loop.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return set;
    // ```
    set
}

/// What:     `async fn get(conn: Option<&Connection>, fingerprint: &str) -> Option<f32>`.
///           Point-read a peak by fingerprint, or `None` on miss/degraded/error.
/// Why:      Serves `Read::Get`; the value width narrows `f64` (SQLite `REAL`) to the
///           `f32` the PCM path uses.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function get(conn, fingerprint) { ... }
/// ```
async fn get(conn: Option<&Connection>, fingerprint: &str) -> Option<f32> {
    // What:     Degraded run has no connection.
    // Why:      Answer a miss without touching a database.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!conn) return null;
    // ```
    let conn = conn?;
    // What:     Run the indexed point lookup; `?`/`.ok()?` collapse any error or
    //           empty result into `None`.
    // Why:      A read failure is a cache miss, never a crash.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const row = (await conn.query("SELECT peak ... = ?", [fp])).next(); if (!row) return null;
    // ```
    let mut rows = conn
        .query("SELECT peak FROM peaks WHERE fingerprint = ?1", (fingerprint,))
        .await
        .ok()?;
    let row = rows.next().await.ok()??;
    // What:     Read column 0 as a real and narrow to `f32`.
    // Why:      Hand back the gain input the controller expects.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return Number(row.get(0));
    // ```
    let value = row.get_value(0).ok()?;
    value.as_real().copied().map(|real| real as f32)
}

/// What:     `async fn upsert(conn: Option<&Connection>, fingerprint: &str, peak: f32)`.
///           Store or replace one measured peak; no-op when degraded.
/// Why:      Serves `Upsert`; `ON CONFLICT DO UPDATE` makes a repeated measurement
///           idempotent. The peak widens `f32 -> f64` for the `REAL` column.
///
/// In TS you'd write (pseudocode):
/// ```ts
/// async function upsert(conn, fingerprint, peak) { ... }
/// ```
async fn upsert(conn: Option<&Connection>, fingerprint: &str, peak: f32) {
    // What:     Degraded run drops the write.
    // Why:      Nothing to persist to.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (!conn) return;
    // ```
    let Some(conn) = conn else {
        return;
    };
    // What:     Autocommit upsert; log and continue on error. Per-statement commit
    //           is durable (the Step-0 spike survived a hard kill), and the write
    //           rate is low (one row per whole-file decode), so no batching.
    // Why:      One bad write must not stall the sweep.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // try { await conn.execute("INSERT ... ON CONFLICT DO UPDATE ...", [fp, peak]); } catch (e) { warn(e); }
    // ```
    if let Err(e) = conn
        .execute(
            "INSERT INTO peaks (fingerprint, peak) VALUES (?1, ?2) \
             ON CONFLICT(fingerprint) DO UPDATE SET peak = excluded.peak",
            (fingerprint, peak as f64),
        )
        .await
    {
        eprintln!("music-player: cache upsert failed: {e}");
    }
}
