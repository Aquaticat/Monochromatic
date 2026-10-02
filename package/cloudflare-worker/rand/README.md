# rand

Random-value HTTP service deployed as a Cloudflare Worker at
`https://rand.aquaticat.workers.dev`.
It serves version 4 UUIDs,
inclusive random integers,
and random alphanumeric strings of a requested length,
and refuses malformed input with a 400 that names the offending value.

## Why this exists

It replaces a Caddy site block that served the same values at
`rand.c.aquati.cat` from the Coolify host's self-managed Caddy.
That block existed only on that host and under no version control,
so it is committed here as `Caddyfile.origin` for provenance and as the porting spec.

Caddy's template functions can coerce but cannot refuse.
`atoi` turned `abc` into zero,
and repeated query parameters collapsed into one unparseable string that also became zero,
so the origin answered `GET /int?min=0&max=2&max=6` with a constant `0` and status 200.
Neither response told the caller anything was wrong.
This Worker validates instead,
and every refusal is a 400 that names the input and the domain that would have been accepted.

The origin is soft-deprecated:
it stays running,
and the owner will neither delete nor change it,
even if it breaks.
Nothing in this package depends on it.

## Routes

All paths are matched case-insensitively,
so `/UUIDV4` and `/INT` serve exactly as their lowercase spellings do.
Only `GET` and `HEAD` are served.

- `GET /uuidv4`:
  a lowercase canonical version 4 UUID,
  36 bytes.
- `GET /int?min=<integer>&max=<integer>`:
  an integer drawn uniformly from the closed interval,
  both bounds included.
- `GET /1` to `GET /64`:
  that many characters from `0-9A-Za-z`.
- `GET /`:
  64 characters from `0-9A-Za-z`.
- `HEAD` on any served path:
  the same status and headers a `GET` returns,
  including the real `Content-Length`,
  with no body.
- `OPTIONS` on any path,
  known or not:
  a 204 CORS preflight carrying `Allow` and `Access-Control-Allow-Methods`.

Served bodies carry no trailing newline,
so `Content-Length` equals the length of the value and
`$(curl --silent https://rand.aquaticat.workers.dev/32)` needs no trimming.
Refusal bodies do end with a newline,
because a human reads them in a terminal.

Every response,
including every refusal,
carries `Cache-Control: no-store, no-cache, must-revalidate` and
`Access-Control-Allow-Origin: *`.
A random value that a shared or browser cache may replay is a correctness bug,
and this is a public service with no rate limits,
so any origin may read it.

## Validation

`/int` accepts `min` and `max` only as canonical decimal integers:
an optional leading minus sign,
then either a single zero or a nonzero digit followed by more digits.
Both are required,
each must lie between `-9007199254740991` and `9007199254740991`,
`min` must not exceed `max`,
and neither name may appear more than once.
Names are matched case-sensitively,
so `MIN` is an unrecognized parameter rather than an alias.
Unknown extra parameters are ignored,
since an ignored `?utm_source=` still yields a correct value.

Every refusal is a 400,
never a 500:

- A non-canonical integer,
  which covers `+5`,
  ` 1`,
  `007`,
  `-0`,
  `1.5`,
  `0x10`,
  `1e3`,
  `abc` and any empty value.
- A magnitude beyond the safe integer range.
  The origin clamped these to `MaxInt64` instead.
- `min` greater than `max`.
  The origin panicked and returned an empty 500.
- A repeated `min` or `max`.
  The origin silently used zero.
- An interval too wide to draw from exactly.

A length path is a 400 when its single segment looks numeric but is not a
canonical integer between 1 and 64,
which covers `/0`,
`/65`,
`/007`,
`/-1` and `/1.5`.
Any other unmatched path is a 404 whose body lists the served routes,
because an unknown path is not a malformed request.
Every method other than `GET`,
`HEAD` and `OPTIONS` is a 405 carrying `Allow`.

## Design notes

### Widest accepted interval

The bound is on the difference,
not on the span:
`max - min` must be a safe integer,
so the widest accepted interval holds 9007199254740992 values.
That is one more than the "span at most `Number.MAX_SAFE_INTEGER`" wording the
design was agreed on,
and the difference is deliberate.
Subtracting two doubles that are both integers yields the true result whenever
that result is representable,
and every integer up to the safe limit is,
whereas adding one first can reach two raised to 53 and round.
A span of exactly two raised to 53 is itself exactly representable and is the
widest the 53-bit draw covers without rounding,
so testing the difference accepts everything that is actually correct and
refuses everything that is not.

### Unbiased draws

Both draws use rejection sampling,
because reducing a uniform source modulo a size that does not divide it
over-represents the low values.
`crypto.getRandomValues` yields bytes and 62 does not divide 256,
so `randomAlphanumeric` discards bytes from 248 upward,
248 being 62 times 4 and the greatest multiple of the charset size that fits in
a byte.
`randomIntInclusive` draws only as many bits as the interval needs and redraws
above the interval,
which rejects fewer than one draw in two.

The invariant behind the byte limit is asserted directly in
`src/random.unit.test.ts` rather than measured statistically,
because detecting a modulo bias would need more samples than a unit test should
draw and would still be flaky.

### Cryptographic randomness

Every draw comes from `crypto.getRandomValues` or `crypto.randomUUID`,
both CSPRNG-backed in workerd.
The Caddy original drew through Go's `math/rand`,
which is not cryptographically secure,
so this is a deliberate strengthening rather than a behaviour port.
The observable charset and lengths are unchanged.

### Why workers.dev and not the original hostname

`aquati.cat` keeps its authoritative DNS at Njalla,
and Cloudflare attaches a Worker custom domain only inside an active Cloudflare
zone.
The plan-tier gating behind that,
including the paid partial-setup and subdomain-setup paths and the off-label
Cloudflare for SaaS path,
is measured in `doc/troubleshooting/cloudflare-mirror-evaluation.md`.
Moving DNS was excluded there by the owner,
so this Worker serves a `workers.dev` hostname.
Adding a custom domain later needs no change to this code,
only a `routes` entry in `wrangler.toml` and DNS.

## Deploy

Deploy and dry run are mise tasks,
and each needs a prior `wrangler login`.
The operator procedure for that login is in `doc/runbook/lfs-r2-worker.md`,
which covers the same account and the same interactive browser OAuth step.

```sh
mise run //package/cloudflare-worker/rand:deploy
mise run //package/cloudflare-worker/rand:deploy:dry-run
```

There are no secrets and no bindings to provision,
so deploying is the whole operation.

## Develop

```sh
mise run //package/cloudflare-worker/rand:build
mise run //package/cloudflare-worker/rand:test:unit
mise run //package/cloudflare-worker/rand:lint
```

`src/worker.ts` is the wrangler entry and exports only the `fetch` handler,
because workerd rejects non-handler named exports on the main module.
`src/index.ts` is the library surface the tests import.
Tests run against the built artifact,
so `wrangler deploy` ships what the tests exercised.

The module split follows the boundary each file owns:
`src/random.ts` holds the draws,
`src/validate.ts` holds the refusals,
`src/respond.ts` holds the header policy,
`src/errors.ts` holds the two error classes the router maps onto statuses,
and `src/index.ts` routes.
