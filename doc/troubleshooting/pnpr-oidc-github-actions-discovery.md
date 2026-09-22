# pnpr 0.1.0-alpha.11 rejects every GitHub Actions workload publish with HTTP 500 "OIDC provider unavailable"

## Symptom

A GitHub Actions job publishes to pnpr with a `pnpr_workload_`-prefixed ID token,
 as `pnpr/crates/pnpr/OIDC.md` documents,
 and npm prints:

```text
npm error 500 Internal Server Error - PUT https://pnpr.c.aquati.cat/~monochromatic-dev/@monochromatic-dev%2fconfig-typescript
```

pnpr logs:

```json
{"level":"ERROR","fields":{"message":"request failed","err":"Internal error: OIDC provider unavailable","error_kind":"internal","status":"500 Internal Server Error"},"target":"pnpr_error"}
```

Every token whose `iss` is `https://token.actions.githubusercontent.com` gets this response,
 including tokens with a forged signature,
 so the failure happens before pnpr looks at the signature or the claims.
It showed up in `pnpr-publish` run 34913557042 for every package that reached its publish step.

## Root cause

### pnpr parses GitHub's discovery document as full provider metadata

A request whose bearer token starts with `pnpr_workload_` goes to OIDC workload verification
 (`pnpr/crates/pnpr/src/server/authentication.rs:181`):

```rust
if let Some(jwt) = raw_token.strip_prefix("pnpr_workload_") {
    let workload = state.inner.identity.oidc
        .workload(jwt)
        .await?
```

Verification first loads the issuer's metadata
 (`pnpr/crates/auth/src/oidc/workload_verification.rs:37`):

```rust
pub(super) async fn verify_workload_token(
    &self,
    provider: &Provider,
    raw: &str,
) -> Result<bool> {
    let metadata = self.metadata(provider, false).await?;
```

`metadata` runs openidconnect discovery,
 and any discovery error becomes `unavailable()`
 (`pnpr/crates/auth/src/oidc.rs:352` to `354`):

```rust
let issuer = IssuerUrl::new(provider.config.issuer.clone()).map_err(|_| rejected())?;
let metadata =
    CoreProviderMetadata::discover_async(issuer, self).await.map_err(|_| unavailable())?;
```

`unavailable()` is an internal error,
 which pnpr answers with HTTP 500
 (`pnpr/crates/auth/src/oidc.rs:421`):

```rust
fn unavailable() -> RegistryError {
    RegistryError::Internal { reason: "OIDC provider unavailable".to_string() }
}
```

### openidconnect requires `authorization_endpoint`; GitHub Actions does not publish one

`CoreProviderMetadata` is openidconnect's `ProviderMetadata`,
 whose `authorization_endpoint` field is not optional
 (openidconnect-rs 4.0.1,
 `src/discovery/mod.rs:60` to `64`):

```rust
issuer: IssuerUrl,
authorization_endpoint: AuthUrl,
token_endpoint: Option<TokenUrl>,
userinfo_endpoint: Option<UserInfoUrl>,
jwks_uri: JsonWebKeySetUrl,
```

GitHub Actions' issuer only mints ID tokens for workflow jobs,
 so `https://token.actions.githubusercontent.com/.well-known/openid-configuration`
 lists `issuer`,
 `jwks_uri`,
 `subject_types_supported`,
 `response_types_supported` (`["id_token"]`),
 `claims_supported`,
 `id_token_signing_alg_values_supported`,
 and `scopes_supported`,
 with no `authorization_endpoint` (fetched 2026-09-15).
Deserialization therefore fails,
 discovery fails,
 and every GitHub workload token gets HTTP 500.

pnpr's own tests do not catch it:
 `verifies_rs256_workload_tokens` uses the GitHub issuer string
 but builds metadata from the `metadata` test helper,
 which always includes `authorization_endpoint`
 (`pnpr/crates/auth/src/oidc/tests.rs:67`):

```rust
fn metadata(issuer: &str) -> Value {
    json!({"issuer": issuer, "authorization_endpoint": format!("{issuer}/authorize"),
```

### Readings ruled out

- The Hetzner egress firewall (`package/config/tofu/hetzner.tf`) was the first suspect.
   It is not the cause:
   a local container with unrestricted egress returns the same 500,
   and `140.82.112.0/20`,
    which `token.actions.githubusercontent.com` resolved into (`140.82.114.22`),
    is in GitHub's `api.github.com/meta` ranges that the firewall allows.
- A claim,
   audience,
   or subject mismatch in `package/config/pnpr/config.yaml` would not return 500.
   Once metadata loads,
    a failed signature check refetches metadata at most once per 30 seconds
    and then returns `Ok(false)`,
    which ends in `rejected()`,
    an HTTP 401 (`pnpr/crates/auth/src/oidc/workload_verification.rs:43` to `48`).

## Verification

Versions under test:
 `@pnpm/pnpr@0.1.0-alpha.11` (npm dist-tag `next` on 2026-09-15,
 released from pnpm/pnpm `19eb39448649c926bc63b0e9fa16f0e340701460`),
 source read at pnpm/pnpm `8f20a3fd69748b1f6eb5c6a7c54d5917456a2013`,
 whose `pnpr/crates/auth/src` matches `f38f11ec1054255497148354ff97ef6ed2434c78`;
 openidconnect 4.0.1 (`b639b5d39eac6903238867aeb2b29326502e6b26`).
The discovery code in `oidc.rs` at the release commit differs from `8f20a3f` only in formatting and module layout.

### Registry harness

A GitHub-issuer JWT with a forged signature,
 sent as a workload publish
 (`probe-oidc-discovery.ts`,
 run with `node probe-oidc-discovery.ts <origin>`):

```ts
// probe-oidc-discovery.ts
const origin = process.argv[2] ?? 'https://pnpr.c.aquati.cat';
const encode = (value: object): string => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const jwt = [
  encode({ alg: 'RS256', typ: 'JWT', kid: 'probe' }),
  encode({
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'https://pnpr.c.aquati.cat',
    sub: 'repo:Aquaticat/Monochromatic:ref:refs/heads/main',
    iat: now,
    exp: now + 300,
  }),
  Buffer.from('not-a-signature').toString('base64url'),
].join('.');
const response = await fetch(`${origin}/~monochromatic-dev/@monochromatic-dev%2fprobe-nonexistent`, {
  method: 'PUT',
  headers: { authorization: `Bearer pnpr_workload_${jwt}`, 'content-type': 'application/json' },
  body: '{}',
});
console.log(response.status, await response.text());
```

Outcomes:

- `https://pnpr.c.aquati.cat` (Coolify,
   Hetzner egress firewall):
   `500 Internal Server Error`.
- `http://127.0.0.1:17677` (`mise run //package/config/pnpr:start:image`,
   unrestricted egress):
   `500 Internal Server Error`,
   logged as `Internal error: OIDC provider unavailable` after 550 ms,
   the time the discovery fetch took.

### Metadata parse harness

```toml
# Cargo.toml
[dependencies]
openidconnect = { version = "=4.0.1", default-features = false }
serde_json = "1"
```

```rust
// src/main.rs
use openidconnect::core::CoreProviderMetadata;

fn main() {
    let raw = std::fs::read_to_string("github-actions-openid-configuration.json").unwrap();
    match serde_json::from_str::<CoreProviderMetadata>(&raw) {
        Ok(_) => println!("as served: parsed"),
        Err(error) => println!("as served: {error}"),
    }
    let mut patched: serde_json::Value = serde_json::from_str(&raw).unwrap();
    patched["authorization_endpoint"] =
        "https://token.actions.githubusercontent.com/authorize".into();
    match serde_json::from_value::<CoreProviderMetadata>(patched) {
        Ok(_) => println!("with authorization_endpoint added: parsed"),
        Err(error) => println!("with authorization_endpoint added: {error}"),
    }
}
```

```bash
# harness directory, with GitHub's document saved beside Cargo.toml
curl --silent --output github-actions-openid-configuration.json https://token.actions.githubusercontent.com/.well-known/openid-configuration
podman run --rm --memory=2g --cpus=2 --volume "$PWD:/work:Z" --workdir /work docker.io/library/rust:1.97-bookworm cargo run --quiet
```

```text
as served: missing field `authorization_endpoint` at line 55 column 1
with authorization_endpoint added: parsed
```

### Documents that parse and documents that fail

Parse:

- Any document carrying `issuer`,
   `authorization_endpoint`,
   `jwks_uri`,
   `response_types_supported`,
   `subject_types_supported`,
   and `id_token_signing_alg_values_supported`,
   such as pnpr's `metadata` test helper
   or GitHub's document with `authorization_endpoint` added.

Fail with `missing field authorization_endpoint`:

- GitHub Actions' document as served.
- Any workload-only issuer that omits the login endpoints.

## Verified workarounds

### Patch pnpr: workload-only providers read only `issuer` and `jwks_uri`

[`pnpr-oidc-github-actions-discovery.patch`](pnpr-oidc-github-actions-discovery.patch)
 applies to pnpm/pnpm `8f20a3f`.
A provider with no `login` block now fetches the discovery document,
 reads only `issuer` and `jwks_uri`,
 checks that `issuer` matches the configured one,
 and fetches the key set;
 providers with `login` keep full openidconnect discovery.
The metadata cache holds the key set plus,
 for login providers,
 the full metadata,
 so refresh and rate-limit behavior is unchanged.
It adds `workload_discovery_accepts_issuers_without_login_endpoints`,
 whose mock issuer serves GitHub's shape.

Tradeoffs:

- A workload-only discovery skips openidconnect's content-type check on the discovery response;
   the body must still parse as JSON with the two fields,
   and the key-set fetch keeps openidconnect's checks.
- A provider configured with both `login` and `workloads`
   still needs an issuer that publishes `authorization_endpoint`.
- It is not released:
   using it means building pnpr from source instead of installing `@pnpm/pnpr@next`.

Verification (bounded container,
 3 GiB memory,
 2 CPUs,
 one build job,
 pnpm-managed cargo sources removed from `.cargo/config.toml` so cargo fetches from crates.io):

```bash
# disposable pnpm/pnpm clone at 8f20a3f
podman run --rm --memory=3g --cpus=2 --volume "$PWD:/work:Z" --workdir /work --env CARGO_BUILD_JOBS=1 docker.io/library/rust:1.97-bookworm cargo test --package pnpr-auth
```

Unpatched source,
 new test only:

```text
thread 'oidc::tests::workload_discovery_accepts_issuers_without_login_endpoints' (6571) panicked at pnpr/crates/auth/src/oidc/tests.rs:260:14:
called `Result::unwrap()` on an `Err` value: Internal { reason: "OIDC provider unavailable" }
test result: FAILED. 0 passed; 1 failed; 0 ignored; 0 measured; 44 filtered out; finished in 0.04s
```

Patched source,
 whole `pnpr-auth` package:

```text
test oidc::tests::workload_discovery_accepts_issuers_without_login_endpoints ... ok
test result: ok. 45 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out; finished in 2.14s
```

Patched `pnpr` binary (`cargo build --package pnpr --bin pnpr`,
 same bounds),
 run with this repository's generated `package/config/pnpr/config.yaml`
 and probed with the registry harness against live GitHub:

```text
401 Authentication required for OIDC credentials
```

pnpr logged the request as `"status":401,"latency_ms":825`:
 it fetched GitHub's discovery document and key set,
 then rejected the forged signature,
 where the unpatched release answers the same token with 500.
A genuine Actions token was not exercised,
 because GitHub issues one only inside a workflow run.

## What does not work

- Pointing pnpr at a local discovery shim.
   `issuer` is both the expected token `iss` and the discovery base URL
   (`OidcProvider` in `pnpr/crates/config/src/oidc.rs` has no separate discovery or key-set URL),
   so the shim would have to answer for `token.actions.githubusercontent.com`.
   Redirecting that name to a sidecar fails too:
    pnpr's OIDC client resolves through `PublicResolver`,
    which rejects any private address
    (`pnpr/crates/auth/src/oidc/network.rs:12` to `22`),
    and the sidecar would need a certificate for GitHub's hostname.
- Allowing more egress in `package/config/tofu/hetzner.tf`:
   discovery reaches GitHub and fails while parsing the response.
- Changing claims,
   subject,
   or audience in `package/config/pnpr/config.yaml`:
   the failure comes before any of them are compared.

## Upstream filing decision

`.out-of-scope/` has no pnpm or pnpr entry (checked 2026-09-15).

Duplicate search on pnpm/pnpm,
 issues and pull requests,
 open and closed:
 `pnpr oidc`,
 `pnpr workload`,
 `OIDC provider unavailable`,
 `authorization_endpoint`,
 and `token.actions.githubusercontent.com`.
Only pnpm/pnpm#14666 (the feature pull request)
 and pnpm/pnpm#14802 (the release) matched,
 and neither reports this failure.

1.   **Is it really upstream's fault?**
      Yes.
      OpenID Connect Discovery 1.0 lists `authorization_endpoint` as required,
       so GitHub's document is incomplete by the letter of the spec,
       but pnpr documents GitHub Actions as its workload issuer,
       and workload verification never uses the authorization endpoint.
2.   **Can upstream fix it?**
      Yes;
       the prototype confines the change to `pnpr/crates/auth/src/oidc`.
3.   **Are they supporting this use case?**
      Yes.
      `pnpr/crates/pnpr/OIDC.md` configures `issuer: https://token.actions.githubusercontent.com` for keyless publishing,
       and `verifies_rs256_workload_tokens` names the same issuer.
4.   **Would the repo welcome our contribution?**
      Yes,
       with disclosure.
      `CONTRIBUTING.md` "AI-assisted contributions" welcomes agent-assisted work,
       asks contributors to understand and test it,
       and requires a footer naming the agent and model.
5.   **Will they likely fix it?**
      Likely.
      OIDC publishing landed in pnpm/pnpm#14666 and shipped in `0.1.0-alpha.11`;
       no maintainer statement declines GitHub Actions support.
6.   **Have we prototyped a minimal fix compatible with their architecture?**
      Yes.
      [`pnpr-oidc-github-actions-discovery.patch`](pnpr-oidc-github-actions-discovery.patch)
       keeps the existing cache,
       refresh interval,
       and error mapping,
       adds a regression test that fails on `8f20a3f` with the production error,
       and passes the whole `pnpr-auth` suite (45 tests).
      Formatting with pnpm's rustfmt fork,
       clippy,
       and dylint were not run.

Decision:
 fileable,
 but the owner answered "Not now" on 2026-09-15,
 so nothing is posted;
 agents never post upstream themselves.

Upstream state checked the same day:
 `main` was `8f20a3fd69748b1f6eb5c6a7c54d5917456a2013`,
 every commit touching `pnpr/crates/auth/src/oidc.rs` or `pnpr/crates/auth/src/oidc/` after pnpm/pnpm#14666 is a style or size refactor
 (pnpm/pnpm#14730,
  #14760,
  #14792,
  #14804,
  #14872,
  #14875),
 no open pull request mentions OIDC discovery,
 and the regression test fails on that `main`.

~~~md
Title: pnpr: GitHub Actions workload publishes fail with 500 "OIDC provider unavailable"

Labels: pnpr, bug

`OIDC.md` configures `issuer: https://token.actions.githubusercontent.com` for keyless publishing,
but every workload publish with a GitHub Actions ID token gets HTTP 500:

    Internal error: OIDC provider unavailable

This includes tokens with a forged signature,
so the failure happens before signature or claim checks.

## Cause

`OidcState::metadata` (`pnpr/crates/auth/src/oidc.rs`) runs
`CoreProviderMetadata::discover_async` and maps any error to `unavailable()`.
openidconnect's `ProviderMetadata` requires `authorization_endpoint`
(openidconnect 4.0.1 `src/discovery/mod.rs:61`),
and GitHub Actions' discovery document has none:
https://token.actions.githubusercontent.com/.well-known/openid-configuration

Parsing that document with openidconnect 4.0.1 prints:

    missing field `authorization_endpoint` at line 55 column 1

The tests miss it because the `metadata` helper in `oidc/tests.rs` always adds `authorization_endpoint`.

## Reproduction

With `pnpr@0.1.0-alpha.11` and a provider configured as in `OIDC.md`,
send `PUT /~<registry>/<package>` with
`Authorization: Bearer pnpr_workload_<jwt>`,
where the JWT has `iss: https://token.actions.githubusercontent.com`,
current `iat`/`exp`,
and any signature.
Response: `500`, logged as `Internal error: OIDC provider unavailable`.

## Suggested fix

For providers without `login`, discovery needs only `issuer` and `jwks_uri`.
A prototype makes `metadata` return the key set plus optional full metadata,
fetches `issuer` and `jwks_uri` for workload-only providers,
checks the issuer,
and fetches the key set with `CoreJsonWebKeySet::fetch_async`.
It adds a test whose mock issuer serves GitHub's document shape;
that test fails on `main` with `Internal { reason: "OIDC provider unavailable" }` and passes with the change.
Patch: attach `doc/troubleshooting/pnpr-oidc-github-actions-discovery.patch` or open it as a pull request.

Written by an agent (Claude Code, claude-opus-5).
~~~
