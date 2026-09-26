# First publication of a Rust crate to crates.io

Use this when a crate in this repository has never been published,
for example `monochromatic-jsonc-edit` 0.1.0 in `package/rust-module/jsonc-edit`.

crates.io Trusted Publishing,
the route `.github/workflows/cargo-publish.yml` already uses for `forbidden-strings`,
`monochromatic-nested-wayland-session` and `forbidden-regex`,
cannot be configured for a crate that does not exist yet.
The registry's own documentation states the prerequisite:
"Your crate must already be published to crates.io (initial publish requires an API token)"
(<https://crates.io/docs/trusted-publishing>,
read 2026-09-25).
So the very first version of every crate here is published once with a personal API token,
and Trusted Publishing takes over afterwards.

Bridges attempted before this handoff,
on 2026-09-25 for `monochromatic-jsonc-edit` 0.1.0:

- The token already stored in `~/.cargo/credentials.toml` was used for
   `cargo publish --no-verify`;
   crates.io answered `status 403 Forbidden` with `authentication failed`,
   so that credential no longer authorizes publishing.
- `gh secret list` in this repository returned seven secrets,
   none of them a crates.io or cargo token,
   so no workflow secret can substitute for a personal token.
- `rust-lang/crates-io-auth-action` (OIDC) cannot bootstrap,
   because Trusted Publishing requires the crate to exist first.
- Browser automation was not used:
   creating an API token needs an interactive crates.io sign-in through GitHub,
   and a freshly minted token is a secret that policy keeps out of the agent conversation.

Division of labor after this runbook:
you create the token,
sign cargo in,
and configure Trusted Publishing in the crates.io dashboard.
Everything else,
the real `cargo publish`,
registry verification,
a disposable consumer build against the published crate,
and the workflow dispatch that proves the OIDC route,
is agent work.

## Crate and version covered

- Crate name:
   `monochromatic-jsonc-edit`
- Version:
   `0.1.0`
- Path:
   `package/rust-module/jsonc-edit`
- Workflow:
   `.github/workflows/cargo-publish.yml`,
   jobs `je-detect` and `je-publish-crate`
- License:
   `LGPL-3.0-or-later`,
   with `LICENSES/LGPL-3.0-or-later.txt` and `LICENSES/GPL-3.0-or-later.txt` shipped in the package

For another crate,
substitute its name,
version,
path and workflow job prefix throughout.

### Setup

Status:
TODO

Prerequisites,
each verifiable on a clean machine:

1. A Linux host with this repository checked out and on `main`,
   at a commit that contains the version you intend to publish.
   Check with `git -C <repo> log --oneline -1` and
   `grep '^version' <repo>/package/rust-module/jsonc-edit/Cargo.toml`.
2. The Rust toolchain this repository pins,
   installed by running `mise install rust` from the repository root.
   Check with `mise exec rust -- cargo --version`,
   which must print a version rather than an error.
3. Network access to `crates.io`,
   `static.crates.io` and `index.crates.io`.
   Check with `curl -sS -o /dev/null -w '%{http_code}\n' -A 'setup-check' https://crates.io/api/v1/crates/serde`,
   which must print `200`.
4. A browser signed in to the crates.io account that owns this repository's other crates,
   reached through GitHub sign-in.
   Check by opening <https://crates.io/> and confirming your avatar in the top-right corner
   rather than a **Log in** button.
5. Owner rights on the crate,
   which a first publication establishes automatically for the publishing account.

### Steps

Status:
TODO

1. Open <https://crates.io/settings/tokens>.
   Expected outcome:
   the **API Tokens** page for your account,
   listing any existing tokens.
2. Click **New Token**.
   Expected outcome:
   a token creation form appears.
3. Type the name `monochromatic-jsonc-edit-bootstrap` in the **Name** field.
   Expected outcome:
   the name is accepted;
   it is only a label,
   but naming it after the crate makes revocation unambiguous later.
4. Set **Expiration** to the shortest offered period,
   one day where the form offers it.
   Expected outcome:
   the form shows the chosen expiry.
   A bootstrap token never needs to live longer than the publish.
5. Select the **publish-new** scope and the **publish-update** scope.
   Expected outcome:
   both scopes are checked,
   and no other scope is.
   `publish-new` creates the crate;
   `publish-update` is needed if the first attempt fails partway and you retry.
6. Click **Generate Token**.
   Expected outcome:
   the new token appears in the list and its secret value is shown once,
   as a string beginning with `cio`.
7. Copy that secret value.
   Do not paste it into the agent conversation,
   an issue,
   a commit message or a shell history entry you intend to share.
8. In a terminal at the repository root,
   run `cargo login`.
   Expected outcome:
   the prompt `please paste your API token, then press Enter:` appears.
9. Paste the token and press **Enter**.
   Expected outcome:
   the prompt returns with no `error:` line.
   Cargo stores the token in `~/.cargo/credentials.toml` with mode `600`.
10. Run `cd package/rust-module/jsonc-edit && cargo publish --dry-run --no-verify`.
    Expected outcome:
    `Packaged 31 files`,
    then `Uploading monochromatic-jsonc-edit v0.1.0`,
    then `warning: aborting upload due to dry run`,
    and no `403`.
    A `403 Forbidden` here means the login did not take;
    repeat from step 8.
11. Tell the agent that the dry run passed.
    The agent then runs `cargo publish --no-verify`,
    verifies the crate on the registry,
    and builds a disposable consumer against the published version.
    If you prefer to publish yourself,
    run `cargo publish --no-verify` in `package/rust-module/jsonc-edit`;
    expected outcome is `Uploading monochromatic-jsonc-edit v0.1.0` with no error line.
12. Open <https://crates.io/crates/monochromatic-jsonc-edit/settings>.
    Expected outcome:
    the crate's settings page,
    which only exists once step 11 succeeded.
13. Click the **Trusted Publishing** tab.
    Expected outcome:
    a page describing trusted publishers,
    with an **Add** button and no publisher listed yet.
14. Click **Add** and select **GitHub Actions**.
    Expected outcome:
    four fields appear:
    **Repository owner**,
    **Repository name**,
    **Workflow filename** and **Environment**.
15. Fill **Repository owner** with `Aquaticat`,
    **Repository name** with `Monochromatic`,
    **Workflow filename** with `cargo-publish.yml`,
    and leave **Environment** empty.
    Expected outcome:
    the fields hold exactly those values.
    This workflow does not use GitHub environments,
    so an environment name here would never match and every publish would fail.
16. Click **Save**.
    Expected outcome:
    a GitHub Actions publisher row appears,
    showing `Aquaticat/Monochromatic`,
    `cargo-publish.yml` and an empty environment.
17. Open <https://crates.io/settings/tokens> again and click **Revoke** on
    `monochromatic-jsonc-edit-bootstrap`.
    Expected outcome:
    the token disappears from the list.
    From now on the workflow authenticates with a 30-minute OIDC token instead.

### What to check

Status:
TODO

1. The crate exists on the registry.
   Run:

   ```bash
   curl -sS -A 'publish-check' https://crates.io/api/v1/crates/monochromatic-jsonc-edit
   ```

   The body must contain `"name":"monochromatic-jsonc-edit"` and
   `"max_stable_version":"0.1.0"`.
   A `404` means the upload did not land.
2. The version carries the right metadata.
   The same response must contain `"license":"LGPL-3.0-or-later"`,
   `"crate_size"` near `72070`,
   which is the compressed upload size in bytes rather than the
   `286.9KiB` that `cargo package` reports uncompressed,
   and a non-empty `"description"`.
3. Documentation builds.
   Open <https://docs.rs/monochromatic-jsonc-edit/0.1.0/monochromatic_jsonc_edit/>.
   Expected outcome:
   HTTP `200` and a module page listing `parse_jsonc`,
   `emit_jsonc_value`,
   `jsonc_set_comment` and `JsoncNumberIdentity`.
   docs.rs builds asynchronously,
   so a first load may still return `404` while the build is queued;
   measured on 2026-09-26,
   the page served `200` within minutes of the upload.
   The `/crate/.../status` route is not a public JSON endpoint:
   it returned an HTML `404` for this crate even after the docs page worked.
4. A downstream crate can consume it.
   The agent performs this check in a disposable directory under `~/temp/agent`,
   with `monochromatic-jsonc-edit = "0.1.0"` resolved from the registry rather than a path.
   Expected outcome:
   the consumer compiles and its assertions pass against the downloaded crate.
5. Trusted Publishing works end to end.
   Run:

   ```bash
   gh workflow run cargo-publish.yml --ref main -f crate=monochromatic-jsonc-edit -f dry-run=true
   ```

   Then open the run and confirm the `je-publish-crate` job reached
   `Publish (dry run)` and printed `warning: aborting upload due to dry run`.
   A later real version is published by bumping `version` in
   `package/rust-module/jsonc-edit/Cargo.toml`,
   pushing to `main`,
   and letting the `je-detect` job notice the bump;
   or by dispatching the same workflow with **dry-run** unchecked.

### Restore

Status:
TODO

1. Revoke the bootstrap token if step 17 was skipped:
   open <https://crates.io/settings/tokens> and click **Revoke** on
   `monochromatic-jsonc-edit-bootstrap`.
2. Remove the stored credential from this machine with `cargo logout`.
   Expected outcome:
   `~/.cargo/credentials.toml` no longer holds a `token` entry for `crates.io`.
   Skip this if another crate on this machine still publishes by token.
3. Delete the Trusted Publisher only if the crate must stop being publishable from CI:
   crate **Settings**,
   **Trusted Publishing** tab,
   then the delete control on the GitHub Actions row.
4. A published version cannot simply be deleted.
   crates.io keeps every uploaded version permanently,
   and removal is a policy decision handled through the crates.io team rather than a setting.
   Before republishing a broken 0.1.0,
   yank it instead:
   `cargo yank --version 0.1.0 monochromatic-jsonc-edit`,
   which keeps the version downloadable for existing lockfiles while stopping new resolutions.
   Then bump the version in `Cargo.toml` and publish again.
5. Local build state created by the checks lives in
   `package/rust-module/jsonc-edit/target` and in the disposable consumer directory under
   `~/temp/agent`.
   Both are untracked and safe to delete.
