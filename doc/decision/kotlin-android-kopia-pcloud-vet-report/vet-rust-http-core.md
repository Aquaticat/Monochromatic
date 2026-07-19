# Vet: Rust HTTP core for the on-device S3 gateway (kopia -> pCloud)

> Scratch-path note:
> `/tmp/agent` paths in this document are historical.
> Use `~/temp/agent` for current work.

Scope:
 the local async HTTP server kopia targets (axum,
 on hyper/tower/tokio) plus the
async HTTPS client to the pCloud native API (reqwest),
 both with streaming bodies and no
full-object buffering.
 This core serves both the Slint+Rust and the Tauri v2 stacks.

Standard:
 choosing-technology skill,
 full-verification.
 No device;
 bounded podman container only.
Date:
 2026-06-07.
 Host:
 Fedora (kernel 7.0.
x),
 SELinux enforcing,
 podman 5.8.2.

## Verdict

Adopt axum (server) + reqwest (client) over hyper/tower/tokio.
 Both publish on crates.
io,
are actively maintained,
 and demonstrably stream a 256 MiB object end to end with a peak
process RSS of about 8.2 MiB (about 31x smaller than the object).
 No alternative offers the
streaming capability without a concrete regression (see rejections).

## 1. Source and ecosystem audit

Clones (shallow,
 `gh repo clone ... -- --depth 1`):

- `/tmp/agent/axum-vet` from tokio-rs/axum
- `/tmp/agent/reqwest-vet` from seanmonstar/reqwest

### hyper / tower / tokio relationship

axum is a thin routing and extractor layer over the same primitives reqwest uses,
 not a
parallel stack:

- `axum-vet/axum/Cargo.toml`:
   depends on `hyper = "1.4.0"` (resolved 1.10.1),
  `hyper-util = "0.1.4"` (0.1.20),
   `tower = "0.5.2"` (0.5.3),
   `tower-layer`,
   `tower-service`,
  `http-body = "1.0.0"`,
   `http-body-util = "0.1.0"`,
   and `tokio` (feature-gated).
- `axum-vet/README.md:17-24`:
   handlers are `tower::Service`s;
   axum "gets timeouts,
   tracing,
  compression ... for free" from tower/tower-http and interoperates with apps written in hyper.
- reqwest (`reqwest-vet/Cargo.toml`):
   `hyper = "1.1"` (1.10.1),
   `hyper-util = "0.1.12"`
  (0.1.20),
   `http-body = "1"`,
   `http-body-util = "0.1.2"`,
   `tokio`.

Both sides share hyper 1.
x + http-body 1.0 + tokio,
 so bodies are the same `http_body::Body`
abstraction on both the server and client edges.
 That is why the streaming types compose.

### Streaming APIs (cited)

Server (axum):

- Request body as a `Stream`:
   `Body::into_data_stream()` returning `BodyDataStream`,
   which
  `impl Stream for BodyDataStream` yields `Result<Bytes, Error>` frame by frame.
  Source:
   `axum-vet/axum-core/src/body.rs:103-105` (method),
   `:168-195` (the `Stream` impl).
  Re-exported at `axum-vet/axum/src/body/mod.rs:10`.
- Response from a stream:
   `Body::from_stream<S>(stream)` where `S: TryStream`,
  `S::Ok: Into<Bytes>`.
   Source:
   `axum-vet/axum-core/src/body.rs:83-95`.

Client (reqwest):

- Streaming response:
   `Response::bytes_stream(self) -> impl Stream<Item = Result<Bytes>>`,
  built on `http_body_util::BodyDataStream`.
   Source:
   `reqwest-vet/src/async_impl/response.rs:351-353`.
- Streaming request body:
   `Body::wrap_stream<S>(stream)` where `S: TryStream + Send + 'static`,
  `Bytes: From<S::Ok>`;
   wraps into a boxed `http_body_util::StreamBody`.
  Source:
   `reqwest-vet/src/async_impl/body.rs:85-113`.
   Gated behind the `stream` feature
  (`reqwest-vet/Cargo.toml:72`).

### Tests, CI, fuzzing (source-audited)

- axum:
   ~86 inline `#[test]`/`#[tokio::test]` plus integration tests;
   dev-dependency
  `quickcheck = "1.0"` and `quickcheck_macros` (`axum-vet/axum/Cargo.toml:185-186`) =
  property-based testing present.
   No cargo-fuzz harness found.
   CI (`.github/workflows/CI.yml`):
  `cargo clippy --all-targets --all-features -- -D warnings`,
   rustfmt check,
   `cargo doc`,
  `cargo hack` feature-combination checks,
   `check-external-types`,
   tests on stable + nightly
  + minimal-versions.
- reqwest:
   ~268 `#[test]`/`#[tokio::test]` across `src/` and 25 integration files
  (`tests/`:
   badssl,
   redirect,
   retry,
   timeouts,
   gzip/brotli/zstd/deflate,
   multipart,
   proxy,
  cookie,
   http3,
   upgrade,
   ...).
   No proptest/cargo-fuzz harness found (absence reported).
   CI
  (`.github/workflows/ci.yml`):
   rustfmt,
   clippy,
   and a platform matrix (linux x86_64 +
  aarch64,
   beta,
   macOS,
   windows msvc/gnu across x86_64/i686/aarch64) with feature combinations.

### crates.io availability and versions

- axum 0.8.9 (also newest),
   axum-core 0.5.6,
   reqwest 0.13.4.
   All match the cloned HEAD.
- Downloads (crates.
  io API):
   axum 342M total / 85M last-90d;
   reqwest 515M total / 123M last-90d.
- Resolved transitive versions from the build:
   hyper 1.10.1,
   hyper-util 0.1.20,
   tower 0.5.3,
  tower-http 0.6.11,
   tokio 1.52.3,
   tokio-util 0.7.18,
   axum-core 0.5.6.
- Licenses:
   both MIT.

## 2. Maintenance signals (gh)

axum (tokio-rs/axum):
 26,176 stars,
 not archived,
 last push 2026-06-05.
 Releases on a regular
cadence (axum 0.8.9,
 axum-extra 0.12.6,
 axum-macros 0.5.1 all 2026-04-14).
 Recent merged PRs
through 2026-06-05.
 Open issues sampled show COLLABORATOR engagement (yanns,
 mladedav) and
CONTRIBUTOR design discussion on feature requests;
 issues get triaged and linked to PRs.
State:
 active releases with responsive,
 triaged backlog.

reqwest (seanmonstar/reqwest):
 11,654 stars,
 not archived,
 last push 2026-05-25.
 Monthly
release cadence (0.13.4 2026-05-25,
 0.13.3 2026-04-27,
 0.13.2 2026-03-16).
 Owner seanmonstar
personally answers and triages issues (samples dated 2026-05-13,
 2026-03-13,
 2026-03-11) and
authors release/maintenance PRs.
 State:
 responsive single-owner maintenance with steady releases.

Both are healthy.
 Neither shows abandonment signals.

## 3. Full verification: streaming round-trip (256 MiB)

Project at `/tmp/agent/streamtest` (`Cargo.toml`,
 `src/main.rs`).
 One process runs both the
axum server and the reqwest client so that a single peak-RSS number covers both directions:
if either side buffered the object,
 RSS would exceed 256 MiB.

- Server `PUT /obj`:
   `body.into_data_stream()` then write each frame to `/var/tmp/obj.bin`
  (no buffer).
   `GET /obj`:
   `Body::from_stream(ReaderStream::with_capacity(file, 64 KiB))`.
- Client:
   `PUT` a lazily generated 256 MiB stream via `reqwest::Body::wrap_stream`
  (`futures_util::stream::iter(0..4096).map(make_chunk)`,
   64 KiB chunks generated on demand);
  `GET` via `Response::bytes_stream()`,
   hashing each chunk on arrival.
- Equality:
   SHA-256 over generated bytes (fed chunk-by-chunk,
   never buffered) vs SHA-256 over
  received bytes.

Build command (bounded container,
 build on /var/tmp overlay,
 not tmpfs):

```bash
podman run --rm --memory=6g --cpus=4 \
  --volume /tmp/agent/streamtest:/work:z \
  --workdir /work \
  --env CARGO_TARGET_DIR=/var/tmp/target \
  --env CARGO_HOME=/var/tmp/cargo \
  docker.io/library/rust:1-bookworm \
  bash -c 'cargo build --release && cp /var/tmp/target/release/streamtest /work/streamtest.bin'
# rustc 1.96.0; Finished release in 21.01s; binary 3.28 MB
```

Measurement command and output (fresh container;
 GNU time):

```bash
podman run --rm --memory=6g --cpus=4 \
  --volume /tmp/agent/streamtest:/work:z --workdir /work \
  docker.io/library/rust:1-bookworm \
  bash -c 'apt-get install -y -qq time && /usr/bin/time -v /work/streamtest.bin'
```

```text
[server] listening on 127.0.0.1:36519
[server] PUT streamed 268435456 bytes to disk
[client] PUT status 200 OK
[client] GET status 200 OK
OK: 256 MiB streamed PUT->disk->GET, byte-equal, no full-object buffering
[client] GET streamed 268435456 bytes back
[result] expected sha256 = f4dddf45a68a9a595247bde5173a3ae854b1f8abc3f5e15ea736c6939e7b1262
[result] received sha256 = f4dddf45a68a9a595247bde5173a3ae854b1f8abc3f5e15ea736c6939e7b1262
	Command being timed: "/work/streamtest.bin"
	Elapsed (wall clock) time (h:mm:ss or m:ss): 0:01.49
	Maximum resident set size (kbytes): 8400
	File system outputs: 524288
	Exit status: 0
```

Result interpretation:

- 268,435,456 bytes (256 MiB) flowed PUT -> disk -> GET;
   SHA-256 identical both directions.
- Peak RSS 8,400 KB (about 8.2 MiB) for the combined server+client process while moving
  256 MiB each way:
   about 31x smaller than the object.
   Streaming is proven;
   neither side
  buffers the whole object.
- File system outputs 524,288 (512-byte blocks) = exactly 256 MiB written to disk,
   confirming
  the data path went through disk,
   not RAM.
   `/var/tmp/obj.bin` = 268,435,456 bytes;
   `/var/tmp`
  is overlay (disk),
   not tmpfs.
- cgroup `/sys/fs/cgroup/memory.peak` after the run reported 334,393,344 bytes (about 319 MiB),
  but the cgroup is read-only inside the container so it could not be reset;
   that figure
  includes the `apt-get install time` step and bash,
   not just the streaming binary.
   The
  per-process `/usr/bin/time -v` RSS of 8.2 MiB is the authoritative streaming number.

Note on TLS:
 the round-trip used HTTP over loopback to isolate the streaming mechanism.
 HTTPS
to pCloud is the same `Body`/stream path with a TLS backend feature enabled;
 reqwest provides
pure-Rust TLS via `hyper-rustls`/`tokio-rustls` (`reqwest-vet/Cargo.toml:141-143`),
 so no C
dependency is required for the production HTTPS client.

## 4. Alternatives with rejection reasons

Server alternatives:

- hyper directly (hyper 1.10.1).
   Rejected:
   it is the layer axum already sits on (axum depends
  on hyper 1.
  x + hyper-util),
   so it offers the identical streaming primitives with none of the
  routing,
   method dispatch,
   or extractor ergonomics.
   An S3 gateway needs PUT/GET routing and
  request plumbing that you would hand-write on top of hyper,
   reimplementing what axum gives
  over the same hyper.
   Lower level,
   more boilerplate,
   zero streaming gain.
- actix-web 4.13.0 (24.7k stars,
   active).
   Rejected:
   it carries its own runtime/ecosystem
  (actix-rt,
   actix-server,
   System/Arbiter) layered on tokio,
   and its streaming uses actix's
  own `web::Payload`/`Stream` types rather than the shared hyper + http-body 1.0 types that
  reqwest also speaks.
   For a tokio + hyper + reqwest core that must embed in Slint+Rust and
  Tauri v2 (both tokio-based),
   an actor runtime adds runtime-within-runtime friction and a
  second body abstraction for no streaming benefit.
   Lower ecosystem gravity for this stack
  (about 9M last-90d downloads vs axum's 85M).

Client alternatives:

- ureq 3.3.0.
   Rejected:
   synchronous/blocking.
   crates.
  io dependency check shows no tokio and
  no async/futures crates in its tree,
   confirming a blocking model.
   The gateway core is async
  (axum/tokio);
   a blocking client cannot share the tokio reactor and would tie up a worker
  thread per in-flight transfer,
   and it has no async `bytes_stream`/`wrap_stream` equivalent
  integrated with tokio.
   Incompatible with the streaming async core.
- isahc 2.0.0.
   Rejected:
   async,
   but built on libcurl.
   crates.
  io shows normal dependencies on
  `curl ^0.4.43` and `curl-sys`,
   i.e. a C native library.
   That complicates static linking and
  cross-compilation and undercuts the pure-Rust + rustls portability that reqwest + hyper-rustls
  provide;
   far lower adoption (about 1.4M last-90d).
   reqwest delivers the same async streaming
  with no C dependency.

## Appendix: exact commands

```bash
# clones
gh repo clone tokio-rs/axum /tmp/agent/axum-vet -- --depth 1
gh repo clone seanmonstar/reqwest /tmp/agent/reqwest-vet -- --depth 1

# crates.io versions (User-Agent required)
curl -s -H "User-Agent: ..." https://crates.io/api/v1/crates/axum     # 0.8.9
curl -s -H "User-Agent: ..." https://crates.io/api/v1/crates/axum-core # 0.5.6
curl -s -H "User-Agent: ..." https://crates.io/api/v1/crates/reqwest  # 0.13.4

# maintenance
gh repo view tokio-rs/axum --json stargazerCount,pushedAt,isArchived
gh release list --repo tokio-rs/axum --limit 3
gh issue list --repo seanmonstar/reqwest --state open --limit 10 --json number,comments,updatedAt

# build + measure: see section 3
```
